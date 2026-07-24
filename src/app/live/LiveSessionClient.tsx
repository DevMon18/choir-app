'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import Link from 'next/link';
import { logout } from '../actions';
import { updateLiveSession } from '../admin/sequences/actions';
import { Navbar } from '@/components/Navbar';
import gsap from 'gsap';

interface Profile { id: string; full_name: string; role: string; }

interface Song {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  categories?: { id: string; name: string }[];
  lyrics: string | null;
}

interface LiveSession {
  id: string;
  sequence_id: string | null;
  active_song_id: string | null;
  director_semitones: number;
  scroll_speed: number;
  is_active: boolean;
  show_chords?: boolean;
}

const MASS_ROLE_LABELS: Record<string, string> = {
  entrance: 'Entrance Song',
  kyrie: 'Kyrie (Lord, Have Mercy)',
  gloria: 'Gloria (Glory to God)',
  psalm: 'Responsorial Psalm',
  gospel: 'Gospel Acclamation (Alleluia)',
  offertory: 'Offertory Song (Preparation of the Gifts)',
  sanctus: 'Sanctus (Holy, Holy, Holy)',
  memorial: 'Memorial Acclamation',
  amen: 'Great Amen',
  agnus: 'Agnus Dei (Lamb of God)',
  communion: 'Communion Song',
  recessional: 'Recessional Song (Closing/Sending Forth)',
};

interface Props {
  profile: Profile;
  initialSession: LiveSession | null;
  initialSong: Song | null;
  songs: Song[]; // all songs keyed by id for fast lookup
  activeSequenceItems?: any[];
}

type ConnStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export const LiveSessionClient = ({ profile, initialSession, initialSong, songs, activeSequenceItems = [] }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const [session, setSession] = useState<LiveSession | null>(initialSession);
  const [activeSong, setActiveSong] = useState<Song | null>(initialSong);
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');
  const [manualScroll, setManualScroll] = useState(false);
  const [localShowChords, setLocalShowChords] = useState<boolean | null>(null);
  const [showNextLyrics, setShowNextLyrics] = useState(false);

  // Reset next lyrics preview when the active song changes
  useEffect(() => {
    setShowNextLyrics(false);
  }, [activeSong?.id]);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);

  const activeItem = activeSong ? activeSequenceItems.find(i => i.song_id === activeSong.id) : null;
  const activeSongMassRole = activeItem?.role_in_mass ? MASS_ROLE_LABELS[activeItem.role_in_mass] : null;

  const isDirector = ['super_admin', 'director'].includes(profile.role);
  const isChordsVisible = localShowChords !== null ? localShowChords : (session?.show_chords ?? true);

  const currentIndex = activeSong ? activeSequenceItems.findIndex(i => i.song_id === activeSong.id) : -1;
  const prevItem = currentIndex > 0 ? activeSequenceItems[currentIndex - 1] : null;
  const nextItem = currentIndex !== -1 && currentIndex < activeSequenceItems.length - 1 ? activeSequenceItems[currentIndex + 1] : null;

  const handleNavigateToSong = async (songId: string | null) => {
    if (!session || !songId) return;
    const newSong = songs.find(s => s.id === songId) || null;
    setActiveSong(newSong);
    await updateLiveSession(session.id, { active_song_id: songId });
  };

  // ── Wake Lock ──────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      /* silently ignore — not critical */
    }
  }, []);

  useEffect(() => {
    acquireWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, [acquireWakeLock]);

  // ── Realtime subscription ─────────────────────────────
  const subscribe = useCallback(() => {
    setConnStatus('connecting');
    const channel = supabase
      .channel('live-session')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_sessions' },
        (payload) => {
          reconnectDelay.current = 1000; // reset on successful message
          const row = payload.new as LiveSession;
          setSession(row);
          if (!row.is_active) {
            setActiveSong(null);
            return;
          }
          if (row.active_song_id) {
            const song = songs.find(s => s.id === row.active_song_id) ?? null;
            setActiveSong(song);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnStatus('connected');
          reconnectDelay.current = 1000;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnStatus('reconnecting');
          channel.unsubscribe();
          reconnectTimerRef.current = setTimeout(() => {
            reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
            subscribe();
          }, reconnectDelay.current);
        }
      });

    return channel;
  }, [songs, supabase]);

  useEffect(() => {
    const channel = subscribe();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      channel.unsubscribe();
    };
  }, [subscribe]);

  // Entry animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo('.live-anim', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleToggleChords = async () => {
    if (!session) return;
    const nextVal = !(session.show_chords ?? true);
    setSession(prev => prev ? { ...prev, show_chords: nextVal } : null);
    await updateLiveSession(session.id, { show_chords: nextVal });
  };

  // ── Status indicator ───────────────────────────────────
  const statusColor = { connected: '#059669', connecting: '#d97706', reconnecting: '#d97706', disconnected: '#dc2626' }[connStatus];
  const statusLabel = { connected: 'Live', connecting: 'Connecting…', reconnecting: 'Reconnecting…', disconnected: 'Disconnected' }[connStatus];

  // Scroll speed mapping
  const scrollPxPerSec = session ? [0, 20, 40, 80][session.scroll_speed] ?? 40 : 40;

  // Auto-scroll
  useEffect(() => {
    if (manualScroll || !session || scrollPxPerSec === 0) return;
    const iv = setInterval(() => {
      window.scrollBy({ top: scrollPxPerSec / 30, behavior: 'auto' });
    }, 33);
    return () => clearInterval(iv);
  }, [manualScroll, scrollPxPerSec, session]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      {(!session?.is_active || isDirector) && (
        <>
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <Navbar profile={profile}>
            {/* Live status pill */}
            <span style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: `${statusColor}15`, border: `1px solid ${statusColor}40`,
              borderRadius: '99px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700, color: statusColor,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block', animation: connStatus === 'connected' ? 'pulse 2s infinite' : 'none' }} />
              {statusLabel}
            </span>
          </Navbar>
        </>
      )}

      <main style={{ flex: 1, padding: (!session?.is_active || isDirector) ? '24px 16px' : '16px 12px', maxWidth: '820px', margin: '0 auto', width: '100%', paddingBottom: '80px' }}>
        {/* Session ended or no session */}
        {(!session || !session.is_active) ? (
          <div className="glass-container live-anim" style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📺</div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px' }}>
              No Live Session Active
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '1rem', marginBottom: '28px' }}>
              {isDirector
                ? 'Go to Sequences to start a live session for the choir.'
                : 'Wait for the Director to start the live session.'}
            </p>
            {isDirector ? (
              <Link href="/admin/sequences" className="btn btn-primary" style={{ minHeight: '48px' }}>
                Go to Sequences →
              </Link>
            ) : (
              <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>This page will automatically update when a session starts.</div>
            )}
          </div>
        ) : (
          <>
            {/* Setlist Navigation Bar for Director */}
            {isDirector && activeSequenceItems.length > 0 && (
              <div className="live-anim" style={{ background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.15)', borderRadius: '16px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Setlist Nav:</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                    {currentIndex !== -1 ? `Song ${currentIndex + 1} of ${activeSequenceItems.length}` : 'No active song selected'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => prevItem && handleNavigateToSong(prevItem.song_id)}
                    disabled={!prevItem}
                    className="btn btn-secondary"
                    style={{ minHeight: '40px', padding: '6px 12px', fontSize: '0.82rem', opacity: !prevItem ? 0.4 : 1, cursor: !prevItem ? 'not-allowed' : 'pointer' }}
                  >
                    ◀ Prev
                  </button>
                  
                  <select
                    value={activeSong?.id || ''}
                    onChange={(e) => handleNavigateToSong(e.target.value || null)}
                    style={{
                      background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
                      padding: '8px 12px', fontSize: '0.85rem', color: 'var(--foreground)',
                      minHeight: '40px', outline: 'none', fontWeight: 600
                    }}
                  >
                    <option value="" disabled>-- Select Song --</option>
                    {activeSequenceItems.map((item, idx) => (
                      <option key={item.id} value={item.song_id || ''}>
                        {idx + 1}. {item.role_in_mass ? `[${MASS_ROLE_LABELS[item.role_in_mass] || item.role_in_mass}] ` : ''}{item.songs?.title || 'Unknown Title'}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    onClick={() => nextItem && handleNavigateToSong(nextItem.song_id)}
                    disabled={!nextItem}
                    className="btn btn-primary"
                    style={{ minHeight: '40px', padding: '6px 12px', fontSize: '0.82rem', opacity: !nextItem ? 0.4 : 1, cursor: !nextItem ? 'not-allowed' : 'pointer' }}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}

            {/* Active song display */}
            {!activeSong ? (
              <div className="glass-container live-anim" style={{ textAlign: 'center', padding: '60px 24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎶</div>
                <h2 style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '8px' }}>Session Active</h2>
                <p style={{ color: 'var(--muted)' }}>Waiting for the Director to select the first song…</p>
              </div>
            ) : (
              <div className="live-anim">
                {/* Simplified Member Top Control Bar */}
                {!isDirector && (
                  <div className="live-anim" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                    <Link href="/dashboard" className="btn btn-secondary" style={{ minHeight: '40px', padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ← Exit Sync
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Live status pill for members (since they don't have navbar) */}
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: `${statusColor}15`, border: `1px solid ${statusColor}40`,
                        borderRadius: '99px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700, color: statusColor,
                        marginRight: '8px'
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block', animation: connStatus === 'connected' ? 'pulse 2s infinite' : 'none' }} />
                        {statusLabel}
                      </span>
                      <button
                        onClick={() => setLocalShowChords(p => {
                          const current = p !== null ? p : (session?.show_chords ?? true);
                          return !current;
                        })}
                        className="btn btn-secondary"
                        style={{
                          minHeight: '40px', padding: '8px 14px', fontSize: '0.82rem',
                          borderColor: isChordsVisible ? 'var(--primary)' : undefined,
                          color: isChordsVisible ? 'var(--primary)' : undefined
                        }}
                      >
                        {isChordsVisible ? '🎸 Chords: On' : '📝 Chords: Off'}
                      </button>
                      <button
                        onClick={() => setManualScroll(p => !p)}
                        className="btn btn-secondary"
                        style={{ minHeight: '40px', padding: '8px 14px', fontSize: '0.82rem', borderColor: manualScroll ? 'var(--primary)' : undefined, color: manualScroll ? 'var(--primary)' : undefined }}
                      >
                        {manualScroll ? '⏸ Manual' : '⏩ Auto-scroll'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Song header (Director only) */}
                {isDirector && (
                  <div className="glass-container" style={{ padding: '24px', marginBottom: '16px' }}>
                    <div className="live-meta-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {activeSongMassRole && (
                            <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', background: 'rgba(11,77,36,0.07)', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(11,77,36,0.2)' }}>
                              {activeSongMassRole}
                            </span>
                          )}
                          {(activeSong.categories && activeSong.categories.length > 0
                            ? activeSong.categories
                            : activeSong.category
                            ? [{ id: activeSong.category, name: activeSong.category }]
                            : []
                          ).map((cat: any) => (
                            <span key={cat.id || cat.name} style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', background: 'rgba(180,83,9,0.06)', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(180,83,9,0.2)' }}>
                              {cat.name}
                            </span>
                          ))}
                        </div>
                        <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>{activeSong.title}</h1>
                        {activeSong.composer && <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '4px' }}>{activeSong.composer}</p>}
                      </div>
                      {/* Scroll and Chord controls */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setManualScroll(p => !p)}
                          className="btn btn-secondary"
                          style={{ minHeight: '44px', padding: '8px 14px', fontSize: '0.82rem', borderColor: manualScroll ? 'var(--primary)' : undefined, color: manualScroll ? 'var(--primary)' : undefined }}
                        >
                          {manualScroll ? '⏸ Manual' : '⏩ Auto-scroll'}
                        </button>
                        <button
                          onClick={handleToggleChords}
                          className="btn btn-secondary"
                          style={{
                            minHeight: '44px', padding: '8px 14px', fontSize: '0.82rem',
                            borderColor: (session.show_chords ?? true) ? 'var(--primary)' : undefined,
                            color: (session.show_chords ?? true) ? 'var(--primary)' : undefined
                          }}
                          title="Global chords toggle for all members"
                        >
                          {(session.show_chords ?? true) ? '🎸 Chords: On' : '📝 Chords: Off'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lyrics Container */}
                <div style={{ background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.12)', borderRadius: '24px', padding: 'clamp(20px, 4vw, 40px)', boxShadow: 'var(--card-shadow)', overflowX: 'auto' }}>
                  
                  {/* Clean distraction-free header inside sheet for members */}
                  {!isDirector && (
                    <div style={{ borderBottom: '1px solid rgba(11, 77, 36, 0.08)', paddingBottom: '16px', marginBottom: '24px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        {activeSongMassRole && (
                          <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', background: 'rgba(11,77,36,0.07)', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(11,77,36,0.2)' }}>
                            {activeSongMassRole}
                          </span>
                        )}
                        {activeSong.category && (
                          <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', background: 'rgba(180,83,9,0.06)', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(180,83,9,0.2)' }}>
                            {activeSong.category}
                          </span>
                        )}
                      </div>
                      <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>{activeSong.title}</h2>
                      {activeSong.composer && <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>by {activeSong.composer}</p>}
                    </div>
                  )}

                  {activeSong.lyrics ? (
                    <ChordProRenderer
                      lyrics={activeSong.lyrics}
                      semitones={session.director_semitones}
                      fontSize={18} // slightly larger font size for lyrics on the music stand!
                      showChords={isChordsVisible}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>
                      No lyrics available for this song.
                    </div>
                  )}
                </div>

                {/* Next Song Preview Card */}
                {nextItem && nextItem.songs && (
                  <div 
                    className="live-anim" 
                    style={{ 
                      marginTop: '24px', 
                      background: 'var(--glass-bg)', 
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid var(--glass-border)', 
                      borderRadius: '20px', 
                      padding: '24px', 
                      boxShadow: 'var(--card-shadow)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            ⏭️ Next Up
                          </span>
                          {nextItem.role_in_mass && (
                            <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)', background: 'rgba(11,77,36,0.07)', padding: '1px 6px', borderRadius: '99px', border: '1px solid rgba(11,77,36,0.15)' }}>
                              {MASS_ROLE_LABELS[nextItem.role_in_mass] || nextItem.role_in_mass}
                            </span>
                          )}
                          {(nextItem.songs.categories && nextItem.songs.categories.length > 0
                            ? nextItem.songs.categories
                            : nextItem.songs.category
                            ? [{ id: nextItem.songs.category, name: nextItem.songs.category }]
                            : []
                          ).map((cat: any) => (
                            <span key={cat.id || cat.name} style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', background: 'rgba(180,83,9,0.06)', padding: '1px 6px', borderRadius: '99px', border: '1px solid rgba(180,83,9,0.15)' }}>
                              {cat.name}
                            </span>
                          ))}
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                          {nextItem.songs.title}
                        </h3>
                        {nextItem.songs.composer && (
                          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
                            by {nextItem.songs.composer}
                          </p>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setShowNextLyrics(p => !p)}
                          className="btn btn-secondary"
                          style={{ 
                            minHeight: '40px', 
                            padding: '8px 16px', 
                            fontSize: '0.82rem', 
                            borderColor: showNextLyrics ? 'var(--primary)' : undefined, 
                            color: showNextLyrics ? 'var(--primary)' : undefined 
                          }}
                        >
                          {showNextLyrics ? 'Hide Lyrics Preview' : '👁️ Preview Lyrics'}
                        </button>
                        
                        {isDirector && (
                          <button
                            onClick={() => handleNavigateToSong(nextItem.song_id)}
                            className="btn btn-primary"
                            style={{ minHeight: '40px', padding: '8px 16px', fontSize: '0.82rem' }}
                          >
                            Switch to Next ▶
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline lyrics preview */}
                    {showNextLyrics && (
                      <div 
                        style={{ 
                          background: '#ffffff', 
                          border: '1px solid rgba(11, 77, 36, 0.08)', 
                          borderRadius: '16px', 
                          padding: '20px', 
                          marginTop: '8px', 
                          maxHeight: '400px', 
                          overflowY: 'auto',
                          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)'
                        }}
                      >
                        {nextItem.songs.lyrics ? (
                          <ChordProRenderer
                            lyrics={nextItem.songs.lyrics}
                            semitones={session.director_semitones}
                            fontSize={16} // slightly smaller font for preview
                            showChords={isChordsVisible}
                          />
                        ) : (
                          <p style={{ color: 'var(--muted)', textAlign: 'center', margin: '16px 0', fontSize: '0.9rem' }}>
                            No lyrics available for this song.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* CSS pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};

export default LiveSessionClient;
