'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

  // ✅ FIX: Store photos and selectedIndex in refs so navigation handlers are stable
  // (don't change identity on every render), preventing listener re-attach on every keystroke.
  const photosRef = useRef(photos);
  const selectedIndexRef = useRef(selectedIndex);
  photosRef.current = photos;
  selectedIndexRef.current = selectedIndex;

  const handlePrevPhoto = useCallback(() => {
    if (selectedIndexRef.current === null || photosRef.current.length <= 1) return;
    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : photosRef.current.length - 1));
  }, []);

  const handleNextPhoto = useCallback(() => {
    if (selectedIndexRef.current === null || photosRef.current.length <= 1) return;
    setSelectedIndex((prev) => (prev! < photosRef.current.length - 1 ? prev! + 1 : 0));
  }, []);

  // Keyboard navigation for Lightbox — listener attached/detached only when lightbox opens/closes
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
  }, [selectedIndex, handlePrevPhoto, handleNextPhoto]);

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
    <div className="mt-4">
      {/* Gallery Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted m-0">
            PHOTO GALLERY ({photos.length}/8)
          </h3>

          {/* Grid View Page Controls */}
          {totalGridPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setGridPage((p) => Math.max(0, p - 1))}
                disabled={gridPage === 0}
                className="bg-transparent border border-border rounded-md p-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center hover:bg-black/5 transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] text-muted font-semibold">
                {gridPage + 1}/{totalGridPages}
              </span>
              <button
                onClick={() => setGridPage((p) => Math.min(totalGridPages - 1, p + 1))}
                disabled={gridPage >= totalGridPages - 1}
                className="bg-transparent border border-border rounded-md p-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center hover:bg-black/5 transition-colors"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {isOwner && photos.length < 8 && (
          <label
            className={`btn btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 ${
              uploading ? 'cursor-wait' : 'cursor-pointer'
            }`}
          >
            <Camera size={14} />
            <span>{uploading ? 'Uploading...' : 'Add Photo'}</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="p-6 rounded-xl bg-black/[0.02] border border-dashed border-glass-border text-center text-muted text-xs sm:text-sm">
          No photos in gallery yet.
        </div>
      ) : (
        /* Max 3-column square 1:1 aspect ratio thumbnail grid */
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="grid grid-cols-3 gap-2"
        >
          {visiblePhotos.map((p, idx) => {
            const actualIndex = gridPage * MAX_PER_PAGE + idx;
            return (
              <div
                key={p.id}
                onClick={() => setSelectedIndex(actualIndex)}
                className="relative pt-[100%] rounded-xl overflow-hidden cursor-pointer bg-black/5 border border-glass-border shadow-sm group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.publicUrl}
                  alt="Profile photo"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
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
          className="fixed inset-0 z-[999999] bg-black/95 flex flex-col justify-between p-4 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedIndex(null);
          }}
        >
          {/* Top Control Bar ABOVE Image */}
          <div className="flex justify-between items-center z-[100] w-full py-1 px-2">
            <span className="text-white/85 text-xs sm:text-sm font-medium">
              {selectedIndex! + 1} / {photos.length} · {new Date(selectedPhoto.created_at).toLocaleDateString()}
            </span>

            {/* Action Buttons ABOVE the image */}
            <div className="flex items-center gap-2.5">
              {isOwner && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeletePhoto(selectedPhoto);
                  }}
                  disabled={deletingId === selectedPhoto.id}
                  title="Delete Photo"
                  className="bg-red-500/85 hover:bg-red-600 text-white border-0 py-2 px-4 text-xs sm:text-sm rounded-full font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-lg shadow-red-500/30 transition-transform active:scale-95 disabled:opacity-50"
                >
                  <Trash2 size={15} />
                  <span>{deletingId === selectedPhoto.id ? 'Deleting...' : 'Delete'}</span>
                </button>
              )}

              <button
                onClick={() => setSelectedIndex(null)}
                className="bg-white/20 hover:bg-white/30 border-0 text-white w-9 h-9 rounded-full cursor-pointer flex items-center justify-center transition-colors"
                aria-label="Close photo"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Center Lightbox Photo Container */}
          <div
            className="relative flex-1 flex items-center justify-center py-3"
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
                className="absolute left-3 top-1/2 -translate-y-1/2 z-[100] bg-black/55 hover:bg-black/75 border border-white/25 text-white w-11 h-11 rounded-full cursor-pointer flex items-center justify-center backdrop-blur-sm transition-all"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.publicUrl}
              alt="Full view"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[84vh] object-contain rounded-lg shadow-2xl"
            />

            {/* Next Arrow Button */}
            {photos.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextPhoto();
                }}
                title="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 z-[100] bg-black/55 hover:bg-black/75 border border-white/25 text-white w-11 h-11 rounded-full cursor-pointer flex items-center justify-center backdrop-blur-sm transition-all"
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
