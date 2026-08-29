'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamicImport from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import { uploadProfilePhotoAction, deleteProfilePhotoAction, uploadCoverPhotoAction, updateInterestsAction, updateCoverPositionAction } from '../directory/[id]/actions';
import gsap from 'gsap';
import { Camera, Move, Check, X, Plus, Tag, Megaphone, UserCheck, Shield } from 'lucide-react';
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
  } | null;
}

interface DashboardClientProps {
  profile: Profile;
  initialPhotos?: PhotoItem[];
  isAdmin: boolean;
  announcements?: AnnouncementItem[];
  pendingSignatures?: PendingSignatureItem[];
}

const DashboardClient = ({ profile: initialProfile, initialPhotos = [], isAdmin, announcements: initialAnnouncements = [], pendingSignatures = [] }: DashboardClientProps) => {
  const { data: profile } = useClientCache(`dashboard_profile_${initialProfile.id}`, initialProfile);
  const { data: announcements } = useClientCache('dashboard_announcements', initialAnnouncements);
  const router = useRouter();
  const { addToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Live real-time sync for member waivers, announcements, and profile state
  useRealtimeSync({
    channelName: `dashboard-sync-${profile.id}`,
    tables: [
      { table: 'document_signatures', filter: `primary_member_id=eq.${profile.id}` },
      { table: 'announcements' },
      { table: 'profiles', filter: `id=eq.${profile.id}` },
    ],
  });

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.cover_url || null);
  const [coverPosition, setCoverPosition] = useState<string>(profile.cover_position || '50%');
  const [repositioningCover, setRepositioningCover] = useState(false);
  const [tempPosition, setTempPosition] = useState<string>(profile.cover_position || '50%');
  const [interests, setInterests] = useState<string[]>(profile.interests || []);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [addingInterest, setAddingInterest] = useState(false);
  const [newInterestInput, setNewInterestInput] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dismissed_announcements');
        if (stored) {
          setDismissedIds(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Error reading dismissed announcements:', err);
      }
    }
  }, []);

  const handleDismissAnnouncement = (id: string) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dismissed_announcements', JSON.stringify(next));
      } catch (err) {
        console.error('Error saving dismissed announcements:', err);
      }
    }
  };

  const announcementsList = (announcements && announcements.length > 0) ? announcements : initialAnnouncements;
  const activeVisibleAnnouncements = useMemo(() => {
    return (announcementsList || []).filter((a) => !dismissedIds.includes(a.id));
  }, [announcementsList, dismissedIds]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.anim-header', 
        { opacity: 0, y: -12, duration: 0.35 }
      );

      tl.from('.anim-card', 
        { opacity: 0, y: 16, scale: 0.98, duration: 0.35, stagger: 0.035 },
        '-=0.15'
      );
    });

    return () => ctx.revert();
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadCoverPhotoAction(formData);

      if (res.success && res.coverUrl) {
        setCoverUrl(res.coverUrl);
        addToast({ type: 'success', title: 'Cover Updated', message: 'Cover photo updated successfully.' });
        router.refresh();
      } else {
        addToast({ type: 'error', title: 'Upload Failed', message: res.error || 'Failed to upload cover image.' });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Cover Upload Error', message: err.message || 'Unknown error during cover upload.' });
    } finally {
      setUploadingCover(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSaveCoverPosition = async (posToSave: string) => {
    setCoverPosition(posToSave);
    setRepositioningCover(false);

    const res = await updateCoverPositionAction(posToSave);
    if (res.error) {
      addToast({ type: 'error', title: 'Save Failed', message: 'Failed to save cover position: ' + res.error });
      setCoverPosition(coverPosition); // revert
    } else {
      addToast({ type: 'success', title: 'Position Saved', message: 'Cover photo position updated.' });
      // No router.refresh() needed — position is local state already updated optimistically
    }
  };

  const handleAddInterest = async (interestToAdd: string) => {
    const trimmed = interestToAdd.trim();
    if (!trimmed || interests.includes(trimmed)) return;

    const nextInterests = [...interests, trimmed];
    setInterests(nextInterests);
    setNewInterestInput('');
    setAddingInterest(false);

    const res = await updateInterestsAction(nextInterests);
    if (res.error) {
      addToast({ type: 'error', title: 'Save Failed', message: 'Failed to save interest: ' + res.error });
      setInterests(interests); // revert
    }
    // No router.refresh() — interests are local state already updated optimistically
  };

  const handleRemoveInterest = async (interestToRemove: string) => {
    const nextInterests = interests.filter((i) => i !== interestToRemove);
    setInterests(nextInterests);

    const res = await updateInterestsAction(nextInterests);
    if (res.error) {
      addToast({ type: 'error', title: 'Update Failed', message: 'Failed to remove interest: ' + res.error });
      setInterests(interests); // revert
    }
    // No router.refresh() — interests are local state already updated optimistically
  };

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[600px] h-[600px]"></div>
      <div className="bg-orb bg-orb-2 w-[500px] h-[500px]"></div>

      <Navbar profile={profile} />

      <main className="flex-1 pt-6 px-4 pb-[120px] max-w-[800px] mx-auto w-full">
        <div className="flex flex-col gap-5">

          {/* Web Push Prompt */}
          <PushNotificationManager />

          {/* ── Facebook/Instagram Style Profile Header Card ── */}
          <div className="glass-container anim-header !p-0 overflow-hidden">
            {/* Cover Banner */}
            <div
              className={`h-40 relative overflow-hidden bg-primary ${
                coverUrl
                  ? ''
                  : 'bg-gradient-to-br from-primary via-[#1e3a8a] to-accent'
              }`}
            >
              {coverUrl && (
                <Image
                  src={coverUrl}
                  alt="Cover Banner"
                  fill
                  priority
                  fetchPriority="high"
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
                    className="btn btn-secondary !py-1.5 !px-3 text-xs bg-white/85 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.15)] !border-none !rounded-full inline-flex items-center gap-1.5"
                  >
                    <Move size={14} /> Reposition
                  </button>
                )}

                {!repositioningCover && (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="btn btn-secondary !py-1.5 !px-3 text-xs bg-white/85 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.15)] !border-none !rounded-full inline-flex items-center gap-1.5"
                  >
                    <Camera size={14} /> {uploadingCover ? 'Uploading...' : 'Change Cover'}
                  </button>
                )}
              </div>

              {/* Cover Reposition Control Overlay Bar */}
              {repositioningCover && (
                <div className="absolute inset-x-0 bottom-0 bg-black/75 backdrop-blur-sm py-2.5 px-4 flex items-center justify-between gap-3 text-white z-10">
                  <span className="text-xs font-semibold">Adjust Position:</span>

                  <div className="flex items-center gap-2 flex-1 max-w-[240px]">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={parseInt(tempPosition) || 50}
                      onChange={(e) => setTempPosition(`${e.target.value}%`)}
                      className="w-full cursor-pointer accent-accent"
                    />
                    <span className="text-xs w-9 text-right">{tempPosition}</span>
                  </div>

                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleSaveCoverPosition(tempPosition)}
                      className="btn btn-primary !py-1 !px-2.5 text-xs !rounded-xl"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setTempPosition(coverPosition);
                        setRepositioningCover(false);
                      }}
                      className="btn btn-secondary !py-1 !px-2.5 text-xs !rounded-xl !text-white !bg-white/20"
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
                  size="2xl"
                  border="3px solid var(--card-bg)"
                  shadow
                  priority
                />

                {/* Profile Quick Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Link href="/tasks" className="btn btn-secondary !py-2 !px-3.5 text-sm inline-flex items-center gap-1.5">
                    📋 Tasks
                  </Link>
                  <Link href="/messages" className="btn btn-secondary !py-2 !px-3.5 text-sm inline-flex items-center gap-1.5">
                    💬 Messages
                  </Link>
                  <Link href="/profile" className="btn btn-secondary !py-2 !px-3.5 text-sm inline-flex items-center gap-1.5">
                    ⚙ Edit Profile
                  </Link>
                </div>
              </div>

              {/* Name & Badges */}
              <div>
                <h1 className="text-xl font-bold text-foreground mb-1">
                  {profile.full_name}
                </h1>
                
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {profile.voice_part && (
                    <span className="badge !bg-primary/10 !text-primary font-semibold text-xs">
                      🎵 {profile.voice_part}
                    </span>
                  )}
                  <span className="badge !bg-accent/15 !text-accent font-bold text-xs capitalize">
                    {profile.role.replace('_', ' ')}
                  </span>
                </div>

                {/* Interests Section */}
                <div className="mt-4 border-t border-glass-border pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted">
                      ✨ Musical Interests &amp; Hobbies
                    </span>
                    {!addingInterest && (
                      <button
                        onClick={() => setAddingInterest(true)}
                        className="bg-transparent border-0 text-primary text-xs font-semibold cursor-pointer p-0 hover:underline"
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
                        className="flex-1 py-1.5 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:border-primary"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddInterest(newInterestInput)}
                        className="btn btn-primary !py-1.5 !px-3 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setAddingInterest(false)}
                        className="btn btn-secondary !py-1.5 !px-3 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Interest Suggestions if empty */}
                  {interests.length === 0 && !addingInterest && (
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {['Sacred Music', 'A Cappella', 'Sight Reading', 'Youth Choir', 'Liturgical Dance', 'Organ & Piano'].map((sug) => (
                        <button
                          key={sug}
                          onClick={() => handleAddInterest(sug)}
                          className="bg-[#1e3a8a]/5 border border-border rounded-full py-1 px-2.5 text-xs text-primary cursor-pointer transition-all hover:bg-[#1e3a8a]/10"
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Render Interest Badges */}
                  {interests.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {interests.map((interest) => (
                        <span
                          key={interest}
                          className="inline-flex items-center gap-1 bg-[#1e3a8a]/8 border border-[#1e3a8a]/15 text-primary rounded-full py-1 px-2.5 text-xs font-semibold"
                        >
                          ✨ {interest}
                          <button
                            onClick={() => handleRemoveInterest(interest)}
                            className="bg-transparent border-0 cursor-pointer text-muted text-sm pl-1 leading-none hover:text-foreground"
                            aria-label={`Remove ${interest}`}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Active Announcements Social Feed (Elevated Top Priority) ── */}
          {activeVisibleAnnouncements.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground m-0 flex items-center gap-2">
                  📢 Choir Announcements ({activeVisibleAnnouncements.length})
                </h2>
              </div>

              {activeVisibleAnnouncements.map((ann) => {
                const isUrgent = ann.priority === 'urgent';
                return (
                  <div
                    key={ann.id}
                    className={`glass-container anim-card relative p-5 rounded-2xl ${
                      isUrgent
                        ? 'border-l-[6px] border-l-error bg-gradient-to-br from-error/8 to-accent/10 shadow-[0_4px_20px_rgba(220,38,38,0.15)]'
                        : 'border-l-[6px] border-l-primary bg-glass-bg'
                    }`}
                  >
                    <button
                      onClick={() => handleDismissAnnouncement(ann.id)}
                      className="absolute top-3.5 right-3.5 bg-transparent border-0 text-xl text-muted cursor-pointer py-1 px-2 hover:text-foreground"
                      aria-label="Dismiss announcement"
                    >
                      &times;
                    </button>

                    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                      {isUrgent ? (
                        <span className="badge !bg-error text-white font-bold">
                          🚨 URGENT
                        </span>
                      ) : (
                        <span className="badge !bg-primary/10 !text-primary font-semibold">
                          📢 ANNOUNCEMENT
                        </span>
                      )}
                      {ann.is_pinned && (
                        <span className="text-xs text-accent font-bold">
                          📌 Pinned
                        </span>
                      )}
                      {ann.starts_at && (
                        <span className="badge !bg-[#1e3a8a]/8 !text-primary text-xs font-semibold">
                          🗓️ Schedule: {new Date(ann.starts_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                      <span suppressHydrationWarning className="text-xs text-muted ml-auto mr-6">
                        Posted {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className={`text-lg font-bold mb-2 m-0 ${isUrgent ? 'text-error' : 'text-primary'}`}>
                      {ann.title}
                    </h3>
                    <p className="m-0 text-[0.95rem] text-foreground leading-relaxed whitespace-pre-wrap">
                      {ann.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Unified Assigned Waivers & Documents Section ── */}
          {pendingSignatures && pendingSignatures.length > 0 && (
            <div
              className={`glass-container anim-card p-5 rounded-2xl ${
                pendingSignatures.some((s) => ['pending', 'rejected'].includes(s.status))
                  ? 'border-[1.5px] border-error/30'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground m-0">
                    📄 Assigned Waivers &amp; Documents ({pendingSignatures.length})
                  </h3>
                  {pendingSignatures.some((s) => ['pending', 'rejected'].includes(s.status)) && (
                    <span className="badge !bg-error/12 !text-[#dc2626] font-bold text-xs">
                      Action Needed
                    </span>
                  )}
                </div>

                <Link
                  href="/my-documents"
                  className="text-xs font-semibold text-primary no-underline inline-flex items-center gap-1 hover:underline"
                >
                  View All Documents →
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {pendingSignatures.map((sig) => {
                  const isUrgent = sig.status === 'pending' || sig.status === 'rejected';

                  return (
                    <div
                      key={sig.id}
                      className={`flex items-center justify-between p-3.5 sm:px-4 rounded-xl flex-wrap gap-3 transition-all ${
                        isUrgent
                          ? 'bg-gradient-to-br from-error/6 to-accent/8 border-[1.5px] border-error/25'
                          : 'bg-white/60 border border-glass-border'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                        <div
                          className={`w-9.5 h-9.5 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                            isUrgent ? 'bg-error/15 text-error' : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {isUrgent ? '✍️' : '📄'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm sm:text-base text-foreground font-semibold">
                              {sig.documents?.title || 'Waiver Document'}
                            </strong>
                            <span
                              className="badge text-xs font-bold"
                              style={{
                                background:
                                  sig.status === 'pending' ? 'rgba(220,38,38,0.12)' :
                                  sig.status === 'submitted' ? 'rgba(197,160,89,0.18)' :
                                  sig.status === 'rejected' ? 'rgba(220,38,38,0.12)' :
                                  'rgba(11,77,36,0.12)',
                                color:
                                  sig.status === 'pending' ? '#dc2626' :
                                  sig.status === 'submitted' ? 'var(--accent)' :
                                  sig.status === 'rejected' ? '#dc2626' :
                                  'var(--primary)',
                              }}
                            >
                              {sig.status === 'pending' ? '✍️ Action Required' :
                               sig.status === 'submitted' ? '⏳ Submitted' :
                               sig.status === 'rejected' ? '❌ Rejected' :
                               '✅ Verified'}
                            </span>
                          </div>
                          <p className="mt-1 mb-0 text-xs text-muted">
                            Assigned: {new Date(sig.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/sign/${sig.id}`}
                          className={`btn ${
                            isUrgent
                              ? '!bg-[#dc2626] !border-[#dc2626] !text-white shadow-[0_4px_12px_rgba(220,38,38,0.25)] !py-2 !px-4'
                              : 'btn-secondary !py-2 !px-3.5'
                          } text-sm font-bold whitespace-nowrap min-h-[40px] inline-flex items-center !rounded-xl`}
                        >
                          {isUrgent ? 'Sign Waiver Now →' : 'View Submission →'}
                        </Link>

                        {(sig.status === 'verified' || sig.status === 'verified_manual') && (
                          <button
                            type="button"
                            onClick={async () => {
                              const { toggleArchiveSignatureAction } = await import('@/app/my-documents/actions');
                              const res = await toggleArchiveSignatureAction(sig.id);
                              if (res.success) {
                                addToast({ type: 'success', title: 'Waiver Archived', message: 'Moved off your home dashboard feed. Access anytime under My Documents.' });
                                router.refresh();
                              } else if (res.error) {
                                addToast({ type: 'error', title: 'Archive Failed', message: res.error });
                              }
                            }}
                            className="btn btn-secondary text-xs !py-2 !px-3 text-muted min-h-[40px] !rounded-xl"
                            title="Archive waiver off home feed"
                          >
                            📁 Archive
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── My Photo Gallery Section ── */}
          <div className="glass-container anim-card !p-5 !rounded-2xl">
            <PhotoGallery
              photos={photos}
              isOwner={true}
              isAdmin={isAdmin}
              onUpload={async (file: File) => {
                const formData = new FormData();
                formData.append('file', file);
                const res = await uploadProfilePhotoAction(formData);
                if (res.success && res.photo) {
                  setPhotos((prev) => [res.photo, ...prev]);
                  router.refresh();
                }
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

          {/* ── Quick Choir Shortcuts (Desktop View) ── */}
          <div className="dashboard-shortcuts-grid">
            <Link href="/calendar" className="glass-container anim-card !p-4 no-underline text-inherit flex items-center gap-3 !rounded-2xl hover:border-primary/20 transition-all">
              <span className="text-3xl">📅</span>
              <div>
                <h4 className="m-0 text-sm font-bold text-foreground">Calendar &amp; Birthdays</h4>
                <p className="m-0 text-xs text-muted">Rehearsals &amp; celebrations</p>
              </div>
            </Link>

            <Link href="/directory" className="glass-container anim-card !p-4 no-underline text-inherit flex items-center gap-3 !rounded-2xl hover:border-primary/20 transition-all">
              <span className="text-3xl">👥</span>
              <div>
                <h4 className="m-0 text-sm font-bold text-foreground">Member Directory</h4>
                <p className="m-0 text-xs text-muted">Roster &amp; contact details</p>
              </div>
            </Link>

            <Link href="/repertoire" className="glass-container anim-card !p-4 no-underline text-inherit flex items-center gap-3 !rounded-2xl hover:border-primary/20 transition-all">
              <span className="text-3xl">🎶</span>
              <div>
                <h4 className="m-0 text-sm font-bold text-foreground">Song Repertoire</h4>
                <p className="m-0 text-xs text-muted">Tracks &amp; sheet music</p>
              </div>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
};

export default DashboardClient;
