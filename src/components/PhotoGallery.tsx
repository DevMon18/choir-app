'use client';

import React, { useState } from 'react';
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

      {/* Full-Screen Edge-to-Edge Lightbox Modal */}
      {selectedPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.92)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '16px',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#fff', fontSize: '13px', opacity: 0.8 }}>
              {new Date(selectedPhoto.created_at).toLocaleDateString()}
            </span>
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                fontSize: '18px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          {/* Full-bleed Photo View */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.publicUrl}
              alt="Full view"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
          </div>

          {/* Footer Actions */}
          {(isOwner || isAdmin) && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '16px' }}>
              <button
                onClick={() => setConfirmDeletePhoto(selectedPhoto)}
                disabled={deletingId === selectedPhoto.id}
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  padding: '8px 18px',
                  fontSize: '14px',
                }}
              >
                🗑 Delete Photo
              </button>
            </div>
          )}
        </div>
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
