'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';

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
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeletePhoto, setConfirmDeletePhoto] = useState<PhotoItem | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', margin: 0 }}>
            PHOTO GALLERY ({photos.length}/8)
          </h3>
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
            <span>{uploading ? '⏳ Uploading...' : '📷 Add Photo'}</span>
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
        /* Instagram 3-column square 1:1 aspect ratio thumbnail grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {photos.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedPhoto(p)}
              style={{
                position: 'relative',
                paddingTop: '100%', // 1:1 Aspect Ratio
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'pointer',
                background: 'rgba(0,0,0,0.05)',
                border: '1px solid var(--glass-border)',
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
          ))}
        </div>
      )}

      {/* Full-Screen Edge-to-Edge Lightbox Modal rendered via Portal onto document.body */}
      {mounted && selectedPhoto && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.94)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            backdropFilter: 'blur(10px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPhoto(null);
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <span style={{ color: '#fff', fontSize: '13px', opacity: 0.8 }}>
              {new Date(selectedPhoto.created_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                background: 'rgba(255,255,255,0.25)',
                border: 'none',
                color: '#fff',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close photo"
            >
              ✕
            </button>
          </div>

          {/* Full-bleed Photo View */}
          <div
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}
            onClick={() => setSelectedPhoto(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.publicUrl}
              alt="Full view"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '100%',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            />
          </div>

          {/* Footer Actions */}
          {(isOwner || isAdmin) && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '24px', zIndex: 10 }}>
              <button
                onClick={() => setConfirmDeletePhoto(selectedPhoto)}
                disabled={deletingId === selectedPhoto.id}
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  padding: '10px 20px',
                  fontSize: '14px',
                  borderRadius: '20px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                🗑 Delete Photo
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
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
