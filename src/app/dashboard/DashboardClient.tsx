'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { PushNotificationManager } from '@/components/PushNotificationManager';
import { PhotoGallery, PhotoItem } from '@/components/PhotoGallery';
import { uploadProfilePhotoAction, deleteProfilePhotoAction, uploadCoverPhotoAction, updateInterestsAction } from '../directory/[id]/actions';
import gsap from 'gsap';

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
  interests?: string[];
  created_at: string;
}

interface DashboardClientProps {
  profile: Profile;
  initialPhotos?: PhotoItem[];
  isAdmin: boolean;
  announcements?: AnnouncementItem[];
}

const DashboardClient = ({ profile, initialPhotos = [], isAdmin, announcements = [] }: DashboardClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>(initialPhotos);
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.cover_url || null);
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

  const activeVisibleAnnouncements = useMemo(() => {
    return announcements.filter((a) => !dismissedIds.includes(a.id));
  }, [announcements, dismissedIds]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo('.anim-header', 
        { opacity: 0, y: -20 }, 
        { opacity: 1, y: 0, duration: 0.7 }
      );

      tl.fromTo('.anim-card', 
        { opacity: 0, y: 30, scale: 0.97 }, 
        { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08 },
        '-=0.3'
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
        router.refresh();
      } else {
        alert(res.error || 'Failed to upload cover image.');
      }
    } catch (err: any) {
      alert('Cover upload error: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingCover(false);
      if (e.target) e.target.value = '';
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
      alert('Failed to save interest: ' + res.error);
      setInterests(interests); // revert
    } else {
      router.refresh();
    }
  };

  const handleRemoveInterest = async (interestToRemove: string) => {
    const nextInterests = interests.filter((i) => i !== interestToRemove);
    setInterests(nextInterests);

    const res = await updateInterestsAction(nextInterests);
    if (res.error) {
      alert('Failed to remove interest: ' + res.error);
      setInterests(interests); // revert
    } else {
      router.refresh();
    }
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
              height: '140px',
              background: coverUrl
                ? `url(${coverUrl}) center/cover no-repeat`
                : 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 50%, var(--accent) 100%)',
              position: 'relative'
            }}>
              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverUpload}
                accept="image/*"
                style={{ display: 'none' }}
              />
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="btn btn-secondary"
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  background: 'rgba(255,255,255,0.85)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  border: 'none',
                  borderRadius: '20px'
                }}
              >
                {uploadingCover ? 'Uploading...' : '🖼 Change Cover'}
              </button>
            </div>

            {/* Profile Content Container */}
            <div style={{ padding: '0 20px 20px', position: 'relative' }}>
              {/* Avatar Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-44px', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{
                  position: 'relative',
                  width: '88px',
                  height: '88px',
                  borderRadius: '50%',
                  background: 'var(--card-bg)',
                  border: '3px solid var(--card-bg)',
                  overflow: 'hidden',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt={profile.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : '?'}
                    </span>
                  )}
                </div>

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

          {/* ── My Photo Gallery Section ── */}
          <div className="glass-container anim-card" style={{ padding: '20px' }}>
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

          {/* ── Active Announcements Social Feed ── */}
          {activeVisibleAnnouncements.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                  📢 Choir Announcements
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
                      borderLeft: isUrgent ? '6px solid var(--error)' : '6px solid var(--primary)',
                      background: isUrgent
                        ? 'linear-gradient(135deg, rgba(159,28,28,0.08) 0%, rgba(197,160,89,0.1) 100%)'
                        : 'var(--glass-bg)',
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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
                      <span suppressHydrationWarning style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: 'auto', marginRight: '24px' }}>
                        {new Date(ann.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: isUrgent ? 'var(--error)' : 'var(--primary)', margin: '0 0 8px 0' }}>
                      {ann.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {ann.body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Quick Choir Shortcuts ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <Link href="/calendar" className="glass-container anim-card" style={{ padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>📅</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>Calendar & Birthdays</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Rehearsals & celebrations</p>
              </div>
            </Link>

            <Link href="/directory" className="glass-container anim-card" style={{ padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '1.8rem' }}>👥</span>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>Member Directory</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>Roster & contact details</p>
              </div>
            </Link>

            <Link href="/repertoire" className="glass-container anim-card" style={{ padding: '16px', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
