'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamicImport from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import {
  uploadProfilePhotoAction,
  deleteProfilePhotoAction,
  uploadCoverPhotoAction,
  updateInterestsAction,
  updateCoverPositionAction,
} from '@/app/directory/[id]/actions';
import gsap from 'gsap';
import { Camera, Move, Check, X, Plus, Tag, Megaphone, UserCheck, Shield, Settings, Sparkles, MessageSquare, ClipboardList } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useClientCache } from '@/context/ClientCacheContext';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

const PushNotificationManager = dynamicImport(
  () => import('@/components/PushNotificationManager').then((m) => m.PushNotificationManager),
  { ssr: false }
);

const PhotoGallery = dynamicImport(
  () => import('@/components/PhotoGallery').then((m) => m.PhotoGallery),
  { ssr: false }
);

import type { PhotoItem } from '@/components/PhotoGallery';

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  priority: 'normal' | 'urgent';
  is_pinned: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  voice_part?: string;
  avatar_url?: string | null;
  cover_url?: string | null;
  cover_position?: string | null;
  interests?: string[];
  created_at: string;
}

export interface PendingSignatureItem {
  id: string;
  status: 'pending' | 'submitted' | 'verified' | 'verified_manual' | 'rejected';
  is_archived?: boolean;
  created_at: string;
  documents: {
    id: string;
    title: string;
    type: string;
    expires_at: string | null;
  };
}

interface ProfileOverviewClientProps {
  profile: Profile;
  initialPhotos?: PhotoItem[];
  isAdmin: boolean;
  announcements?: AnnouncementItem[];
  pendingSignatures?: PendingSignatureItem[];
}

const ProfileOverviewClient = ({
  profile,
  initialPhotos = [],
  isAdmin,
  announcements = [],
  pendingSignatures = [],
}: ProfileOverviewClientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { addToast } = useToast();

  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.cover_url || null);
  const [coverPosition, setCoverPosition] = useState<string>(profile.cover_position || '50%');
  const [repositioningCover, setRepositioningCover] = useState(false);
  const [tempPosition, setTempPosition] = useState(coverPosition);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Interests state
  const [interests, setInterests] = useState<string[]>(profile.interests || []);
  const [addingInterest, setAddingInterest] = useState(false);
  const [newInterestInput, setNewInterestInput] = useState('');

  // Sinking Fund / Dues quick snapshot (computed client side)
  const isOfficer = ['super_admin', 'director', 'secretary', 'treasurer'].includes(profile.role);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll('.anim-card'),
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
      );
    }
  }, []);

  // Sync profile photos in realtime
  useRealtimeSync({
    channelName: `profile-photos-${profile.id}`,
    tables: [{ table: 'profile_photos', filter: `user_id=eq.${profile.id}` }],
    onEvent: () => {
      router.refresh();
    },
  });

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast({ title: 'Upload Failed', type: 'error', message: 'Cover image must be under 5MB.' });
      return;
    }

    setUploadingCover(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await uploadCoverPhotoAction(formData);
    setUploadingCover(false);

    if (res.success && res.coverUrl) {
      setCoverUrl(res.coverUrl);
      setCoverPosition('50%');
      addToast({ title: 'Cover Updated', type: 'success', message: 'New cover banner uploaded.' });
      router.refresh();
    } else {
      addToast({ title: 'Error', type: 'error', message: res.error || 'Failed to upload cover banner.' });
    }
  };

  const handleSaveCoverPosition = async (pos: string) => {
    setCoverPosition(pos);
    setRepositioningCover(false);
    const res = await updateCoverPositionAction(pos);
    if (res.success) {
      addToast({ title: 'Position Saved', type: 'success', message: 'Banner position updated.' });
    } else {
      addToast({ title: 'Error', type: 'error', message: res.error || 'Failed to save position.' });
    }
  };

  const handleAddInterest = async (tag: string) => {
    const cleanTag = tag.trim();
    if (!cleanTag) return;
    if (interests.includes(cleanTag)) {
      setAddingInterest(false);
      setNewInterestInput('');
      return;
    }

    const updated = [...interests, cleanTag];
    setInterests(updated);
    setAddingInterest(false);
    setNewInterestInput('');

    const res = await updateInterestsAction(updated);
    if (!res.success) {
      addToast({ title: 'Error', type: 'error', message: res.error || 'Failed to save interest.' });
      setInterests(interests);
    }
  };

  const handleRemoveInterest = async (tagToRemove: string) => {
    const updated = interests.filter((t) => t !== tagToRemove);
    setInterests(updated);
    const res = await updateInterestsAction(updated);
    if (!res.success) {
      addToast({ title: 'Error', type: 'error', message: res.error || 'Failed to remove interest.' });
      setInterests(interests);
    }
  };

  return (
    <div className="page-shell">
      <Navbar profile={profile} />

      <main className="page-container" ref={containerRef}>
        <div className="max-w-[800px] mx-auto flex flex-col gap-6">

          {/* Profile Overview Card */}
          <div className="glass-container anim-card overflow-hidden p-0 relative shadow-sm border border-slate-200">
            {/* Banner Section */}
            <div
              className={`h-40 sm:h-52 w-full relative overflow-hidden ${
                coverUrl
                  ? 'bg-slate-900'
                  : 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-950'
              }`}
            >
              {coverUrl && (
                <Image
                  src={coverUrl}
                  alt="Cover Banner"
                  fill
                  priority
                  sizes="(max-width: 800px) 100vw, 800px"
                  className={`object-cover z-0 ${repositioningCover ? '' : 'transition-[object-position] duration-150 ease-out'}`}
                  style={{
                    objectPosition: `center ${repositioningCover ? tempPosition : coverPosition}`,
                  }}
                />
              )}
              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                accept="image/*"
                className="hidden"
              />

              {/* Cover Action Buttons */}
              <div className="absolute top-3 right-3 flex gap-2 z-[5]">
                {coverUrl && !repositioningCover && (
                  <button
                    onClick={() => {
                      setTempPosition(coverPosition);
                      setRepositioningCover(true);
                    }}
                    className="btn btn-secondary !py-1.5 !px-3 text-xs bg-white/85 backdrop-blur-md shadow-sm !border-none !rounded-full inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800"
                  >
                    <Move size={13} /> Reposition
                  </button>
                )}

                {!repositioningCover && (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="btn btn-secondary !py-1.5 !px-3 text-xs bg-white/85 backdrop-blur-md shadow-sm !border-none !rounded-full inline-flex items-center gap-1.5 cursor-pointer font-bold text-slate-800"
                  >
                    <Camera size={13} /> {uploadingCover ? 'Uploading...' : 'Change Cover'}
                  </button>
                )}
              </div>

              {/* Reposition Control Overlay */}
              {repositioningCover && (
                <div className="absolute inset-x-0 bottom-0 bg-black/80 backdrop-blur-sm py-2.5 px-4 flex items-center justify-between gap-3 text-white z-10">
                  <span className="text-xs font-semibold">Adjust Banner Position:</span>
                  <div className="flex items-center gap-2 flex-1 max-w-[240px]">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={parseInt(tempPosition) || 50}
                      onChange={(e) => setTempPosition(`${e.target.value}%`)}
                      className="w-full cursor-pointer accent-emerald-500"
                    />
                    <span className="text-xs w-9 text-right font-mono">{tempPosition}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSaveCoverPosition(tempPosition)}
                      className="btn btn-primary !py-1 !px-3 text-xs !rounded-xl"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setTempPosition(coverPosition);
                        setRepositioningCover(false);
                      }}
                      className="btn btn-secondary !py-1 !px-3 text-xs !rounded-xl !text-white !bg-white/20"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Content Container */}
            <div className="px-5 pb-5 relative">
              {/* Avatar Row */}
              <div className="flex justify-between items-end -mt-11 mb-3.5 flex-wrap gap-3">
                <Avatar
                  src={profile.avatar_url}
                  name={profile.full_name}
                  size={88}
                  className="border-3 border-white shadow-md bg-white"
                  priority
                />

                {/* Profile Quick Action Buttons */}
                <div className="flex gap-2 flex-wrap items-center">
                  <Link
                    href="/dashboard"
                    className="btn btn-secondary !py-2 !px-3.5 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Sparkles size={14} className="text-primary" /> Feed
                  </Link>
                  <Link
                    href="/tasks"
                    className="btn btn-secondary !py-2 !px-3.5 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <ClipboardList size={14} /> Tasks
                  </Link>
                  <Link
                    href="/messages"
                    className="btn btn-secondary !py-2 !px-3.5 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <MessageSquare size={14} /> Messages
                  </Link>
                  <Link
                    href="/profile/settings"
                    className="btn btn-primary !py-2 !px-3.5 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Settings size={14} /> Profile Settings
                  </Link>
                </div>
              </div>

              {/* Name & Badges */}
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 mb-0.5 tracking-tight">
                  {profile.full_name}
                </h1>
                <p className="text-xs text-slate-500 font-medium">{profile.email}</p>

                <div className="flex items-center gap-2 flex-wrap mt-2">
                  {profile.voice_part && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                      🎵 {profile.voice_part}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 capitalize">
                    {profile.role.replace('_', ' ')}
                  </span>
                  <Link
                    href="/dues"
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    💰 Sinking Fund Dues &rarr;
                  </Link>
                  <Link
                    href="/profile/my-contributions"
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    ⭐ Contributions &amp; Points &rarr;
                  </Link>
                </div>

                {/* Interests Section */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Musical Interests &amp; Hobbies
                    </span>
                    {!addingInterest && (
                      <button
                        onClick={() => setAddingInterest(true)}
                        className="bg-transparent border-0 text-primary text-xs font-bold cursor-pointer p-0 hover:underline"
                      >
                        + Add Interest
                      </button>
                    )}
                  </div>

                  {addingInterest && (
                    <div className="flex gap-1.5 mb-2.5">
                      <input
                        type="text"
                        placeholder="e.g. Sacred Music, Sight Reading, Guitar"
                        value={newInterestInput}
                        onChange={(e) => setNewInterestInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddInterest(newInterestInput);
                        }}
                        className="flex-1 py-1.5 px-3 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddInterest(newInterestInput)}
                        className="btn btn-primary !py-1 !px-3 text-xs"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingInterest(false);
                          setNewInterestInput('');
                        }}
                        className="btn btn-secondary !py-1 !px-3 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {interests.length === 0 && !addingInterest ? (
                      <span className="text-xs text-slate-400 italic">No interests added yet.</span>
                    ) : (
                      interests.map((interest) => (
                        <span
                          key={interest}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          <Tag size={11} className="text-slate-400" />
                          <span>{interest}</span>
                          <button
                            onClick={() => handleRemoveInterest(interest)}
                            className="bg-transparent border-none p-0 text-slate-400 hover:text-red-500 cursor-pointer ml-0.5"
                            title="Remove tag"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Signatures Banner */}
          {pendingSignatures.length > 0 && (
            <div className="glass-container anim-card p-4 sm:p-5 border-l-4 border-l-amber-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                  <Megaphone size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    You have {pendingSignatures.length} document signature{pendingSignatures.length > 1 ? 's' : ''} pending
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Please review and sign required choir documents to keep your profile active.
                  </p>
                </div>
              </div>

              <Link
                href={`/sign/${pendingSignatures[0].id}`}
                className="btn btn-primary !py-2 !px-4 text-xs font-bold whitespace-nowrap self-stretch sm:self-auto text-center"
              >
                Sign Now &rarr;
              </Link>
            </div>
          )}

          {/* Photo Gallery Section */}
          <div className="glass-container anim-card p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Camera size={18} className="text-primary" />
                  <span>Personal Gallery</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Photos showcased on your choir profile and member directory card.
                </p>
              </div>
            </div>

            <PhotoGallery
              photos={photos}
              isOwner={true}
              isAdmin={isAdmin}
              onUpload={async (file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                const res = await uploadProfilePhotoAction(formData);
                if (res.success) router.refresh();
                return res;
              }}
              onDelete={async (photoId: string, storagePath: string) => {
                const res = await deleteProfilePhotoAction(photoId, storagePath);
                if (res.success) {
                  setPhotos((prev) => prev.filter((p) => p.id !== photoId));
                  router.refresh();
                }
                return res;
              }}
            />
          </div>

        </div>
      </main>
    </div>
  );
};

export default ProfileOverviewClient;
