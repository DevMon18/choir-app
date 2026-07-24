'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { Camera, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react';

export interface PhotoItem {
  id: string;
  storage_path: string;
  created_at: string;
  publicUrl: string;
}

interface Props {
  photos: PhotoItem[];
  isOwner: boolean;
  isAdmin: boolean;
  onUpload: (file: File) => Promise<{ success?: boolean; error?: string }>;
  onDelete: (photoId: string, storagePath: string) => Promise<{ success?: boolean; error?: string }>;
  onPhotosChanged?: () => void;
}

export const PhotoGallery: React.FC<Props> = ({
  photos,
  isOwner,
  isAdmin,
  onUpload,
  onDelete,
  onPhotosChanged,
}) => {
  const { addToast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [gridPage, setGridPage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<PhotoItem | null>(null);
  const [mounted, setMounted] = useState(false);

  // Touch swipe refs
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const MAX_PER_PAGE = 3;
  const totalGridPages = Math.ceil(photos.length / MAX_PER_PAGE) || 1;

  // Keep gridPage valid if photos count decreases
  useEffect(() => {
    if (gridPage >= totalGridPages && totalGridPages > 0) {
      setGridPage(totalGridPages - 1);
    }
  }, [photos.length, totalGridPages, gridPage]);

  const visiblePhotos = photos.slice(gridPage * MAX_PER_PAGE, gridPage * MAX_PER_PAGE + MAX_PER_PAGE);
  const selectedPhoto = selectedIndex !== null && photos[selectedIndex] ? photos[selectedIndex] : null;

  // Keyboard navigation for Lightbox
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevPhoto();
      } else if (e.key === 'ArrowRight') {
        handleNextPhoto();
      } else if (e.key === 'Escape') {
        setSelectedIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, photos.length]);

  const handlePrevPhoto = () => {
    if (selectedIndex === null || photos.length <= 1) return;
    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : photos.length - 1));
  };

  const handleNextPhoto = () => {
    if (selectedIndex === null || photos.length <= 1) return;
    setSelectedIndex((prev) => (prev! < photos.length - 1 ? prev! + 1 : 0));
  };

  // Touch swipe handler for Lightbox & Grid
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;

    if (diff > 50) {
      // Swipe left -> Next
      if (selectedIndex !== null) {
        handleNextPhoto();
      } else if (gridPage < totalGridPages - 1) {
        setGridPage((p) => p + 1);
      }
    } else if (diff < -50) {
      // Swipe right -> Previous
      if (selectedIndex !== null) {
        handlePrevPhoto();
      } else if (gridPage > 0) {
        setGridPage((p) => p - 1);
      }
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 8) {
      addToast({ type: 'error', title: 'Photo Cap Reached', message: 'Maximum 8 photos allowed per profile.' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File Too Large', message: 'Photo must be under 5MB.' });
      return;
    }

    setUploading(true);
    try {
      const res = await onUpload(file);
      if (res.error) {
        addToast({ type: 'error', title: 'Upload Failed', message: res.error });
      } else {
        addToast({ type: 'success', title: 'Photo Uploaded!', message: 'Your photo was added to the gallery.' });
        if (onPhotosChanged) onPhotosChanged();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Upload Error', message: err.message || 'Failed to upload photo.' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeletePhoto) return;
    const photo = confirmDeletePhoto;
    setConfirmDeletePhoto(null);
    setDeletingId(photo.id);

    try {
      const res = await onDelete(photo.id, photo.storage_path);
      if (res.error) {
        addToast({ type: 'error', title: 'Delete Failed', message: res.error });
      } else {
        addToast({ type: 'success', title: 'Photo Deleted', message: 'Photo removed successfully.' });
        
        // Auto-advance photo or close lightbox
        if (photos.length <= 1) {
          setSelectedIndex(null);
        } else if (selectedIndex !== null) {
          setSelectedIndex((prev) => (prev! >= photos.length - 1 ? Math.max(0, photos.length - 2) : prev!));
        }

        if (onPhotosChanged) onPhotosChanged();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Delete Error', message: err.message || 'Failed to delete photo.' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Gallery Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', margin: 0 }}>
            PHOTO GALLERY ({photos.length}/8)
          </h3>

          {/* Grid View Page Controls */}
          {totalGridPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setGridPage((p) => Math.max(0, p - 1))}
                disabled={gridPage === 0}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  cursor: gridPage === 0 ? 'not-allowed' : 'pointer',
                  opacity: gridPage === 0 ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 600 }}>
                {gridPage + 1}/{totalGridPages}
              </span>
              <button
                onClick={() => setGridPage((p) => Math.min(totalGridPages - 1, p + 1))}
                disabled={gridPage >= totalGridPages - 1}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  cursor: gridPage >= totalGridPages - 1 ? 'not-allowed' : 'pointer',
                  opacity: gridPage >= totalGridPages - 1 ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {isOwner && photos.length < 8 && (
          <label
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              cursor: uploading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Camera size={14} />
            <span>{uploading ? 'Uploading...' : 'Add Photo'}</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>

      {photos.length === 0 ? (
        <div
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: 'rgba(0,0,0,0.02)',
            border: '1px dashed var(--glass-border)',
            textAlign: 'center',
            color: 'var(--muted)',
            fontSize: '13px',
          }}
        >
          No photos in gallery yet.
        </div>
      ) : (
        /* Max 3-column square 1:1 aspect ratio thumbnail grid */
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}
        >
          {visiblePhotos.map((p, idx) => {
            const actualIndex = gridPage * MAX_PER_PAGE + idx;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedIndex(actualIndex)}
                style={{
                  position: 'relative',
                  paddingTop: '100%',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'rgba(0,0,0,0.05)',
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.publicUrl}
                  alt="Profile photo"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Edge-to-Edge Lightbox Modal */}
      {mounted && selectedPhoto && createPortal(
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.94)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            backdropFilter: 'blur(12px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedIndex(null);
          }}
        >
          {/* Top Control Bar ABOVE Image */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 100,
              width: '100%',
              padding: '4px 8px',
            }}
          >
            <span style={{ color: '#ffffff', fontSize: '0.85rem', opacity: 0.85, fontWeight: 500 }}>
              {selectedIndex! + 1} / {photos.length} · {new Date(selectedPhoto.created_at).toLocaleDateString()}
            </span>

            {/* Action Buttons ABOVE the image */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeletePhoto(selectedPhoto);
                  }}
                  disabled={deletingId === selectedPhoto.id}
                  title="Delete Photo"
                  style={{
                    background: 'rgba(239, 68, 68, 0.85)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    borderRadius: '20px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <Trash2 size={15} />
                  <span>{deletingId === selectedPhoto.id ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}

              <button
                onClick={() => setSelectedIndex(null)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#fff',
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close photo"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Center Lightbox Photo Container */}
          <div
            style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}
            onClick={() => setSelectedIndex(null)}
          >
            {/* Previous Arrow Button */}
            {photos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevPhoto();
                }}
                title="Previous photo"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 100,
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#ffffff',
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.publicUrl}
              alt="Full view"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: '84vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              }}
            />

            {/* Next Arrow Button */}
            {photos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPhoto();
                }}
                title="Next photo"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 100,
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: '#ffffff',
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Elevated Delete Confirmation Modal */}
      {confirmDeletePhoto && (
        <ConfirmModal
          title="Delete Photo?"
          message="Are you sure you want to delete this photo from your gallery?"
          confirmLabel="Yes, Delete"
          isDanger={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeletePhoto(null)}
        />
      )}
    </div>
  );
};
