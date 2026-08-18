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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '600px', height: '600px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '500px', height: '500px' }}></div>

      <Navbar profile={profile} />

      <main style={{ flex: 1, padding: '24px 16px 120px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Web Push Prompt */}
          <PushNotificationManager />

          {/* ── Facebook/Instagram Style Profile Header Card ── */}
          <div className="glass-container anim-header" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Cover Banner */}
            <div style={{
              height: '160px',
              background: coverUrl
                ? 'none'
                : 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 50%, var(--accent) 100%)',
              backgroundColor: 'var(--primary)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {coverUrl && (
                <Image
                  src={coverUrl}
                  alt="Cover Banner"
                  fill
                  priority
                  fetchPriority="high"
                  sizes="(max-width: 800px) 100vw, 800px"
                  style={{
                    objectFit: 'cover',
                    objectPosition: `center ${repositioningCover ? tempPosition : coverPosition}`,
                    transition: repositioningCover ? 'none' : 'object-position 0.15s ease',
                    zIndex: 0,
                  }}
                />
              )}
              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />

              {/* Cover Action Buttons */}
              <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px', zIndex: 5 }}>
                {coverUrl && !repositioningCover && (
                  <button
                    onClick={() => {
                      setTempPosition(coverPosition);
                      setRepositioningCover(true);
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      background: 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      border: 'none',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Move size={14} /> Reposition
                  </button>
                )}

                {!repositioningCover && (
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      background: 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(8px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      border: 'none',
                      borderRadius: '20px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <Camera size={14} /> {uploadingCover ? 'Uploading...' : 'Change Cover'}
                  </button>
                )}
              </div>

              {/* Cover Reposition Control Overlay Bar */}
              {repositioningCover && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 'auto 0 0 0',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(6px)',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    color: '#fff',
                    zIndex: 10
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Adjust Position:</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '240px' }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={parseInt(tempPosition) || 50}
                      onChange={(e) => setTempPosition(`${e.target.value}%`)}
                      style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent)' }}
                    />
                    <span style={{ fontSize: '0.75rem', width: '36px', textAlign: 'right' }}>{tempPosition}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => handleSaveCoverPosition(tempPosition)}
                      className="btn btn-primary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setTempPosition(coverPosition);
                        setRepositioningCover(false);
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px', color: '#fff', background: 'rgba(255,255,255,0.2)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Content Container */}
            <div style={{ padding: '0 20px 20px', position: 'relative' }}>
              {/* Avatar Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-44px', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <Avatar
                  src={profile.avatar_url}
                  name={profile.full_name}
                  size="2xl"
                  border="3px solid var(--card-bg)"
                  shadow
                  priority
                />

                {/* Profile Quick Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Link href="/messages" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    💬 Messages
                  </Link>
                  <Link href="/profile" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    ⚙ Edit Profile
                  </Link>
                </div>
              </div>

              {/* Name & Badges */}
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 4px 0' }}>
                  {profile.full_name}
                </h1>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {profile.voice_part && (
                    <span className="badge" style={{ background: 'rgba(30,58,138,0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem' }}>
                      🎵 {profile.voice_part}
                    </span>
                  )}
                  <span className="badge" style={{ background: 'rgba(197,160,89,0.15)', color: 'var(--accent)', fontWeight: 700, fontSize: '0.78rem', textTransform: 'capitalize' }}>
                    {profile.role.replace('_', ' ')}
                  </span>
                </div>

                {/* Interests Section */}
                <div style={{ marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                      ✨ Musical Interests & Hobbies
                    </span>
                    {!addingInterest && (
                      <button
                        onClick={() => setAddingInterest(true)}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                      >
                        + Add Interest
                      </button>
                    )}
                  </div>

                  {addingInterest && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="e.g. Sacred Music, Sight Reading, Guitar"
                        value={newInterestInput}
                        onChange={(e) => setNewInterestInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddInterest(newInterestInput);
                        }}
                        style={{ flex: 1, padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card-bg)', color: 'var(--foreground)' }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleAddInterest(newInterestInput)}
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setAddingInterest(false)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Interest Suggestions if empty */}
                  {interests.length === 0 && !addingInterest && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {['Sacred Music', 'A Cappella', 'Sight Reading', 'Youth Choir', 'Liturgical Dance', 'Organ & Piano'].map((sug) => (
                        <button
                          key={sug}
                          onClick={() => handleAddInterest(sug)}
                          style={{
                            background: 'rgba(30,58,138,0.05)',
                            border: '1px stroke var(--border)',
                            borderRadius: '16px',
                            padding: '4px 10px',
                            fontSize: '0.78rem',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          + {sug}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Render Interest Badges */}
                  {interests.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {interests.map((interest) => (
                        <span
                          key={interest}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(30,58,138,0.08)',
                            border: '1px solid rgba(30,58,138,0.15)',
                            color: 'var(--primary)',
                            borderRadius: '16px',
                            padding: '4px 10px',
                            fontSize: '0.8rem',
                            fontWeight: 600
                          }}
                        >
                          ✨ {interest}
                          <button
                            onClick={() => handleRemoveInterest(interest)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.85rem', padding: '0 0 0 4px', lineHeight: 1 }}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📢 Choir Announcements ({activeVisibleAnnouncements.length})
                </h2>
              </div>

              {activeVisibleAnnouncements.map((ann) => {
                const isUrgent = ann.priority === 'urgent';
                return (
                  <div
                    key={ann.id}
                    className="glass-container anim-card"
                    style={{
                      position: 'relative',
                      padding: '20px',
                      borderRadius: '16px',
                      borderLeft: isUrgent ? '6px solid var(--error)' : '6px solid var(--primary)',
                      background: isUrgent
                        ? 'linear-gradient(135deg, rgba(159,28,28,0.08) 0%, rgba(197,160,89,0.1) 100%)'
                        : 'var(--glass-bg)',
                      boxShadow: isUrgent ? '0 4px 20px rgba(220,38,38,0.15)' : undefined,
                    }}
                  >
                    <button
                      onClick={() => handleDismissAnnouncement(ann.id)}
                      style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        background: 'none',
                        border: 'none',
                        fontSize: '1.2rem',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                        padding: '4px 8px',
                      }}
                      aria-label="Dismiss announcement"
                    >
                      &times;
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                      {isUrgent ? (
                        <span className="badge" style={{ background: 'var(--error)', color: '#fff', fontWeight: 700 }}>
                          🚨 URGENT
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(11,77,36,0.1)', color: 'var(--primary)', fontWeight: 600 }}>
                          📢 ANNOUNCEMENT
                        </span>
                      )}
                      {ann.is_pinned && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 700 }}>
                          📌 Pinned
                        </span>
                      )}
                      {ann.starts_at && (
                        <span className="badge" style={{ background: 'rgba(30,58,138,0.08)', color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600 }}>
                          🗓️ Schedule: {new Date(ann.starts_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                      <span suppressHydrationWarning style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 'auto', marginRight: '24px' }}>
                        Posted {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: isUrgent ? 'var(--error)' : 'var(--primary)', margin: '0 0 8px 0' }}>
                      {ann.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--foreground)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
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
              className="glass-container anim-card"
              style={{
                padding: '20px',
                borderRadius: '16px',
                border: pendingSignatures.some((s) => ['pending', 'rejected'].includes(s.status))
                  ? '1.5px solid rgba(220,38,38,0.3)'
                  : undefined,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                    📄 Assigned Waivers &amp; Documents ({pendingSignatures.length})
                  </h3>
                  {pendingSignatures.some((s) => ['pending', 'rejected'].includes(s.status)) && (
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(220,38,38,0.12)',
                        color: '#dc2626',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                      }}
                    >
                      Action Needed
                    </span>
                  )}
                </div>

                <Link
                  href="/my-documents"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  View All Documents →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingSignatures.map((sig) => {
                  const isUrgent = sig.status === 'pending' || sig.status === 'rejected';

                  return (
                    <div
                      key={sig.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        background: isUrgent
                          ? 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(197,160,89,0.08) 100%)'
                          : 'rgba(255,255,255,0.6)',
                        border: isUrgent
                          ? '1.5px solid rgba(220,38,38,0.25)'
                          : '1px solid var(--glass-border)',
                        flexWrap: 'wrap',
                        gap: '12px',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: isUrgent ? 'rgba(220,38,38,0.15)' : 'rgba(11,77,36,0.1)',
                            color: isUrgent ? '#dc2626' : 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flexShrink: 0,
                          }}
                        >
                          {isUrgent ? '✍️' : '📄'}
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--foreground)' }}>
                              {sig.documents?.title || 'Waiver Document'}
                            </strong>
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
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
                          <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
                            Assigned: {new Date(sig.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Link
                          href={`/sign/${sig.id}`}
                          className={isUrgent ? 'btn btn-primary' : 'btn btn-secondary'}
                          style={{
                            fontSize: '0.85rem',
                            padding: isUrgent ? '9px 18px' : '8px 14px',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            minHeight: '40px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: isUrgent ? '#dc2626' : undefined,
                            borderColor: isUrgent ? '#dc2626' : undefined,
                            color: isUrgent ? '#ffffff' : undefined,
                            boxShadow: isUrgent ? '0 4px 12px rgba(220,38,38,0.25)' : undefined,
                            borderRadius: '10px',
                          }}
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
                            className="btn btn-secondary"
                            style={{ fontSize: '0.78rem', padding: '8px 12px', color: 'var(--muted)', minHeight: '40px', borderRadius: '10px' }}
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
          <div className="glass-container anim-card" style={{ padding: '20px', borderRadius: '16px' }}>
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
            <Link href="/calendar" className="glass-container anim-card" style={{ padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '14px' }}>
              <span style={{ fontSize: '1.8rem' }}>📅</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>Calendar & Birthdays</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Rehearsals & celebrations</p>
              </div>
            </Link>

            <Link href="/directory" className="glass-container anim-card" style={{ padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '14px' }}>
              <span style={{ fontSize: '1.8rem' }}>👥</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>Member Directory</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Roster & contact details</p>
              </div>
            </Link>

            <Link href="/repertoire" className="glass-container anim-card" style={{ padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px', borderRadius: '14px' }}>
              <span style={{ fontSize: '1.8rem' }}>🎶</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>Song Repertoire</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Tracks & sheet music</p>
              </div>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
};

export default DashboardClient;
