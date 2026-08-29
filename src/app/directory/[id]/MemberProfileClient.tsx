'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
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

    if (res.success && res.photo) {
      setPhotos((prev) => [res.photo, ...prev]);
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
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-6 px-4 pb-[120px] max-w-[720px] mx-auto w-full">
        {/* Back Link */}
        <div className="mb-4">
          <Link href="/directory" className="btn btn-secondary !py-1.5 !px-3 text-[13px]">
            ← Back to Directory
          </Link>
        </div>

        {/* Profile Card Header (Facebook/Instagram conventions) */}
        <div className="glass-container p-0 overflow-hidden mb-4">
          {/* Cover Banner */}
          <div
            className="h-[140px] bg-primary relative overflow-hidden"
            style={{
              background: targetProfile.cover_url
                ? 'none'
                : 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 50%, var(--accent) 100%)',
            }}
          >
            {targetProfile.cover_url && (
              <Image
                src={targetProfile.cover_url}
                alt="Profile Cover Banner"
                fill
                priority
                fetchPriority="high"
                sizes="(max-width: 720px) 100vw, 720px"
                className="object-cover z-0"
                style={{
                  objectPosition: `center ${targetProfile.cover_position || '50%'}`,
                }}
              />
            )}
          </div>

          {/* Profile Details Container */}
          <div className="p-0 px-5 pb-5 relative">
            <div className="flex items-end justify-between -mt-11 mb-3.5 flex-wrap gap-3">
              {/* 88px circle avatar */}
              <Avatar
                src={targetProfile.avatar_url}
                name={targetProfile.full_name}
                size="2xl"
                border="3px solid var(--card-bg)"
                shadow
                priority
              />

              {/* Message CTA & Edit Profile Actions */}
              <div className="flex gap-2.5 flex-wrap">
                {!isOwner && (
                  <button
                    onClick={handleOpenConversation}
                    disabled={messagingLoading}
                    className="btn btn-primary !py-2 !px-4 text-sm !min-h-[40px]"
                  >
                    💬 {messagingLoading ? 'Opening Chat...' : 'Direct Message'}
                  </button>
                )}
                {isOwner && (
                  <Link href="/profile" className="btn btn-secondary !py-2 !px-4 text-sm">
                    ⚙ Edit My Settings
                  </Link>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* 20px bold name */}
                <h1 className="text-xl font-bold text-primary m-0">
                  {targetProfile.full_name}
                </h1>
                {targetProfile.voice_part && (
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full"
                    style={{
                      color: voiceColor,
                      backgroundColor: `${voiceColor}15`,
                      border: `1px solid ${voiceColor}30`,
                    }}
                  >
                    {targetProfile.voice_part}
                  </span>
                )}
              </div>

              <div className="text-[13px] text-muted mb-3">
                {ROLE_LABELS[targetProfile.role] || targetProfile.role}
              </div>

              {/* Interests Section */}
              {targetProfile.interests && targetProfile.interests.length > 0 && (
                <div className="mt-3 border-t border-glass-border pt-2.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5">
                    MUSICAL INTERESTS & HOBBIES
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {targetProfile.interests.map((interest) => (
                      <span
                        key={interest}
                        className="bg-blue-900/8 border border-blue-900/15 text-primary rounded-2xl py-1 px-2.5 text-xs font-semibold"
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
        <div className="glass-container p-5 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
            MEMBER DETAILS
          </h2>

          <div className="flex flex-col gap-2.5 text-sm">
            {targetProfile.phone && (
              <div className="flex items-center gap-2">
                <span className="text-muted min-w-[80px] text-[13px]">Phone:</span>
                <a href={`tel:${targetProfile.phone}`} className="text-primary font-medium no-underline">
                  📞 {targetProfile.phone}
                </a>
              </div>
            )}
            {targetProfile.address && (
              <div className="flex items-center gap-2">
                <span className="text-muted min-w-[80px] text-[13px]">Address:</span>
                <span className="text-foreground">📍 {targetProfile.address}</span>
              </div>
            )}
            {targetProfile.birthdate && (
              <div className="flex items-center gap-2">
                <span className="text-muted min-w-[80px] text-[13px]">Birthday:</span>
                <span className="text-foreground">
                  🎂 {new Date(targetProfile.birthdate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                </span>
              </div>
            )}
            {targetProfile.join_date && (
              <div className="flex items-center gap-2">
                <span className="text-muted min-w-[80px] text-[13px]">Joined:</span>
                <span className="text-muted text-[13px]">
                  {new Date(targetProfile.join_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Phase 3 Photo Gallery Integration */}
        <div className="glass-container p-5">
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
