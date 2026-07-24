'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { PhotoGallery, PhotoItem } from '@/components/PhotoGallery';
import { DetailedMemberProfile, uploadProfilePhotoAction, deleteProfilePhotoAction } from './actions';
import { getOrCreateConversation } from '@/app/messages/actions';
import { useToast } from '@/components/Toast';

interface Props {
  currentUserProfile: { id: string; full_name: string; role: string };
  targetProfile: DetailedMemberProfile;
  initialPhotos: PhotoItem[];
  isOwner: boolean;
  isAdmin: boolean;
}

const VOICE_COLORS: Record<string, string> = {
  Soprano: '#6366f1',
  Alto: '#7c3aed',
  Tenor: '#0ea5e9',
  Bass: '#0b4d24',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  director: 'Director',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  member: 'Choir Member',
};

export const MemberProfileClient: React.FC<Props> = ({
  currentUserProfile,
  targetProfile,
  initialPhotos,
  isOwner,
  isAdmin,
}) => {
  const router = useRouter();
  const { addToast } = useToast();
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [messagingLoading, setMessagingLoading] = useState(false);

  const voiceColor = VOICE_COLORS[targetProfile.voice_part || ''] || 'var(--primary)';

  const handleUploadPhoto = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await uploadProfilePhotoAction(formData);

    if (res.success) {
      router.refresh();
    }
    return res;
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    const res = await deleteProfilePhotoAction(photoId, storagePath);
    if (res.success) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      router.refresh();
    }
    return res;
  };

  const handleOpenConversation = async () => {
    if (isOwner) {
      addToast({ type: 'warning', title: 'Direct Messaging', message: 'You cannot message yourself.' });
      return;
    }

    setMessagingLoading(true);
    try {
      const res = await getOrCreateConversation(targetProfile.id);
      if (res.error || !res.conversationId) {
        addToast({ type: 'error', title: 'Chat Error', message: res.error || 'Failed to open conversation.' });
      } else {
        router.push(`/messages/${res.conversationId}`);
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Server error' });
    } finally {
      setMessagingLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, padding: '24px 16px 120px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
        {/* Back Link */}
        <div style={{ marginBottom: '16px' }}>
          <Link href="/directory" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
            ← Back to Directory
          </Link>
        </div>

        {/* Profile Card Header (Facebook/Instagram conventions) */}
        <div className="glass-container" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
          {/* Cover Banner */}
          <div style={{
            height: '140px',
            background: targetProfile.cover_url
              ? `url(${targetProfile.cover_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 50%, var(--accent) 100%)',
            position: 'relative'
          }} />

          {/* Profile Details Container */}
          <div style={{ padding: '0 20px 20px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '-44px', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
              {/* 88px circle avatar */}
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: '50%',
                  background: targetProfile.avatar_url ? 'none' : `linear-gradient(135deg, ${voiceColor}, ${voiceColor}99)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '2rem',
                  flexShrink: 0,
                  overflow: 'hidden',
                  border: '3px solid var(--card-bg)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)'
                }}
              >
                {targetProfile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={targetProfile.avatar_url} alt={targetProfile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  targetProfile.full_name.charAt(0).toUpperCase()
                )}
              </div>

              {/* Message CTA & Edit Profile Actions */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {!isOwner && (
                  <button
                    onClick={handleOpenConversation}
                    disabled={messagingLoading}
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '14px', minHeight: '40px' }}
                  >
                    💬 {messagingLoading ? 'Opening Chat...' : 'Direct Message'}
                  </button>
                )}
                {isOwner && (
                  <Link href="/profile" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '14px' }}>
                    ⚙ Edit My Settings
                  </Link>
                )}
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                {/* 20px bold name */}
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                  {targetProfile.full_name}
                </h1>
                {targetProfile.voice_part && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: voiceColor,
                      background: `${voiceColor}15`,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      border: `1px solid ${voiceColor}30`,
                    }}
                  >
                    {targetProfile.voice_part}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                {ROLE_LABELS[targetProfile.role] || targetProfile.role}
              </div>

              {/* Interests Section */}
              {targetProfile.interests && targetProfile.interests.length > 0 && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '6px' }}>
                    MUSICAL INTERESTS & HOBBIES
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {targetProfile.interests.map((interest) => (
                      <span
                        key={interest}
                        style={{
                          background: 'rgba(30,58,138,0.08)',
                          border: '1px solid rgba(30,58,138,0.15)',
                          color: 'var(--primary)',
                          borderRadius: '16px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}
                      >
                        ✨ {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Member Meta Details */}
        <div className="glass-container" style={{ padding: '20px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '12px' }}>
            MEMBER DETAILS
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            {targetProfile.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--muted)', minWidth: '80px', fontSize: '13px' }}>Phone:</span>
                <a href={`tel:${targetProfile.phone}`} style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
                  📞 {targetProfile.phone}
                </a>
              </div>
            )}
            {targetProfile.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--muted)', minWidth: '80px', fontSize: '13px' }}>Address:</span>
                <span style={{ color: 'var(--foreground)' }}>📍 {targetProfile.address}</span>
              </div>
            )}
            {targetProfile.birthdate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--muted)', minWidth: '80px', fontSize: '13px' }}>Birthday:</span>
                <span style={{ color: 'var(--foreground)' }}>
                  🎂 {new Date(targetProfile.birthdate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
            {targetProfile.join_date && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--muted)', minWidth: '80px', fontSize: '13px' }}>Joined:</span>
                <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  {new Date(targetProfile.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Phase 3 Photo Gallery Integration */}
        <div className="glass-container" style={{ padding: '20px' }}>
          <PhotoGallery
            photos={photos}
            isOwner={isOwner}
            isAdmin={isAdmin}
            onUpload={handleUploadPhoto}
            onDelete={handleDeletePhoto}
          />
        </div>
      </main>
    </div>
  );
};
