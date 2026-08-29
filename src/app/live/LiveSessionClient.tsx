'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChordProRenderer, ChordProControls, usePersistedFontSize, usePersistedFontWeight } from '@/components/ChordProRenderer';
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

  // Persisted accessibility controls for font size & weight in Live Sync
  const [fontSize, setFontSize] = usePersistedFontSize('choir_live_fontsize', 18);
  const [fontWeight, setFontWeight] = usePersistedFontWeight('choir_live_fontweight', 600);

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

  const pendingNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNavigateToSong = (songId: string | null) => {
    if (!session || !songId) return;
    const newSong = songs.find((s) => s.id === songId) || null;
    
    // 1. Optimistic Local Update (Instant feedback for director)
    setActiveSong(newSong);

    // 2. Debounce backend update to prevent HTTP 429 Rate Limit error on rapid clicks
    if (pendingNavTimerRef.current) {
      clearTimeout(pendingNavTimerRef.current);
    }

    pendingNavTimerRef.current = setTimeout(async () => {
      try {
        await updateLiveSession(session.id, { active_song_id: songId });
      } catch (err) {
        console.error('Error updating live session song:', err);
      }
    }, 250); // 250ms debounce delay
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
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      {(!session?.is_active || isDirector) && (
        <>
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <Navbar profile={profile}>
            {/* Live status pill */}
            <span
              className="flex items-center gap-1.5 rounded-full py-1 px-2.5 text-xs font-bold"
              style={{
                background: `${statusColor}15`,
                border: `1px solid ${statusColor}40`,
                color: statusColor,
              }}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full inline-block ${connStatus === 'connected' ? 'animate-pulse' : ''}`}
                style={{ background: statusColor }}
              />
              {statusLabel}
            </span>
          </Navbar>
        </>
      )}

      <main className={`flex-1 ${(!session?.is_active || isDirector) ? 'py-6 px-4' : 'py-4 px-3'} max-w-[820px] mx-auto w-full pb-20`}>
        {/* Session ended or no session */}
        {(!session || !session.is_active) ? (
          <div className="glass-container live-anim text-center py-20 px-6">
            <div className="text-6xl mb-4">📺</div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-3">
              No Live Session Active
            </h1>
            <p className="text-muted text-base mb-7">
              {isDirector
                ? 'Go to Sequences to start a live session for the choir.'
                : 'Wait for the Director to start the live session.'}
            </p>
            {isDirector ? (
              <Link href="/admin/sequences" className="btn btn-primary !min-h-[48px]">
                Go to Sequences →
              </Link>
            ) : (
              <div className="text-muted text-sm">This page will automatically update when a session starts.</div>
            )}
          </div>
        ) : (
          <>
            {/* Setlist Navigation Bar for Director */}
            {isDirector && activeSequenceItems.length > 0 && (
              <div className="live-anim bg-white border border-primary/15 rounded-2xl p-4 sm:py-4 sm:px-5 mb-4 flex items-center justify-between gap-4 flex-wrap shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-[0.85rem] font-bold text-primary uppercase tracking-wider">Setlist Nav:</span>
                  <span className="text-xs sm:text-[0.82rem] text-muted">
                    {currentIndex !== -1 ? `Song ${currentIndex + 1} of ${activeSequenceItems.length}` : 'No active song selected'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => prevItem && handleNavigateToSong(prevItem.song_id)}
                    disabled={!prevItem}
                    className={`btn btn-secondary !min-h-[40px] !py-1.5 !px-3 text-xs sm:text-[0.82rem] ${!prevItem ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    ◀ Prev
                  </button>
                  
                  <select
                    value={activeSong?.id || ''}
                    onChange={(e) => handleNavigateToSong(e.target.value || null)}
                    className="input-field !py-2 !px-3 text-xs sm:text-[0.85rem] text-foreground !min-h-[40px] font-semibold"
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
                    className={`btn btn-primary !min-h-[40px] !py-1.5 !px-3 text-xs sm:text-[0.82rem] ${!nextItem ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}

            {/* Active song display */}
            {!activeSong ? (
              <div className="glass-container live-anim text-center py-15 px-6 mb-5">
                <div className="text-4xl mb-3">🎶</div>
                <h2 className="text-primary font-bold mb-2">Session Active</h2>
                <p className="text-muted">Waiting for the Director to select the first song…</p>
              </div>
            ) : (
              <div className="live-anim">
                {/* Simplified Member Top Control Bar */}
                {!isDirector && (
                  <div className="live-anim flex justify-between items-center mb-4 gap-3 flex-wrap">
                    <Link href="/dashboard" className="btn btn-secondary !min-h-[40px] !py-2 !px-4 text-xs sm:text-[0.82rem] flex items-center gap-1.5">
                      ← Exit Sync
                    </Link>
                    <div className="flex items-center gap-2">
                      {/* Live status pill for members (since they don't have navbar) */}
                      <span
                        className="flex items-center gap-1.5 rounded-full py-1.5 px-3 text-xs font-bold mr-2"
                        style={{
                          background: `${statusColor}15`,
                          border: `1px solid ${statusColor}40`,
                          color: statusColor,
                        }}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full inline-block ${connStatus === 'connected' ? 'animate-pulse' : ''}`}
                          style={{ background: statusColor }}
                        />
                        {statusLabel}
                      </span>
                      <button
                        onClick={() => setLocalShowChords(p => {
                          const current = p !== null ? p : (session?.show_chords ?? true);
                          return !current;
                        })}
                        className={`btn btn-secondary !min-h-[40px] !py-2 !px-3.5 text-xs sm:text-[0.82rem] ${
                          isChordsVisible ? '!border-primary !text-primary' : ''
                        }`}
                      >
                        {isChordsVisible ? '🎸 Chords: On' : '📝 Chords: Off'}
                      </button>
                      <button
                        onClick={() => setManualScroll(p => !p)}
                        className={`btn btn-secondary !min-h-[40px] !py-2 !px-3.5 text-xs sm:text-[0.82rem] ${
                          manualScroll ? '!border-primary !text-primary' : ''
                        }`}
                      >
                        {manualScroll ? '⏸ Manual' : '⏩ Auto-scroll'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Song header (Director only) */}
                {isDirector && (
                  <div className="glass-container p-6 mb-4">
                    <div className="live-meta-row flex justify-between items-center gap-3 flex-wrap">
                      <div>
                        <div className="flex gap-2 flex-wrap mb-2">
                          {activeSongMassRole && (
                            <span className="inline-block text-[0.7rem] font-bold uppercase tracking-wider text-primary bg-primary/7 py-0.5 px-2 rounded-full border border-primary/20">
                              {activeSongMassRole}
                            </span>
                          )}
                          {(activeSong.categories && activeSong.categories.length > 0
                            ? activeSong.categories
                            : activeSong.category
                            ? [{ id: activeSong.category, name: activeSong.category }]
                            : []
                          ).map((cat: any) => (
                            <span key={cat.id || cat.name} className="inline-block text-[0.7rem] font-bold uppercase tracking-wider text-amber-700 bg-amber-700/6 py-0.5 px-2 rounded-full border border-amber-700/20">
                              {cat.name}
                            </span>
                          ))}
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-primary m-0">{activeSong.title}</h1>
                        {activeSong.composer && <p className="text-muted text-xs sm:text-sm mt-1">{activeSong.composer}</p>}
                      </div>
                      {/* Scroll and Chord controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setManualScroll(p => !p)}
                          className={`btn btn-secondary !min-h-[44px] !py-2 !px-3.5 text-xs sm:text-[0.82rem] ${
                            manualScroll ? '!border-primary !text-primary' : ''
                          }`}
                        >
                          {manualScroll ? '⏸ Manual' : '⏩ Auto-scroll'}
                        </button>
                        <button
                          onClick={handleToggleChords}
                          className={`btn btn-secondary !min-h-[44px] !py-2 !px-3.5 text-xs sm:text-[0.82rem] ${
                            (session.show_chords ?? true) ? '!border-primary !text-primary' : ''
                          }`}
                          title="Global chords toggle for all members"
                        >
                          {(session.show_chords ?? true) ? '🎸 Chords: On' : '📝 Chords: Off'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lyrics Container */}
                <div className="bg-white border border-primary/12 rounded-3xl p-5 sm:p-8 md:p-10 shadow-sm overflow-x-auto">
                  
                  {/* Clean distraction-free header inside sheet for members */}
                  {!isDirector && (
                    <div className="border-b border-primary/8 pb-4 mb-6">
                      <div className="flex gap-2 flex-wrap mb-1.5">
                        {activeSongMassRole && (
                          <span className="inline-block text-[0.65rem] font-bold uppercase tracking-wider text-primary bg-primary/7 py-0.5 px-2 rounded-full border border-primary/20">
                            {activeSongMassRole}
                          </span>
                        )}
                        {activeSong.category && (
                          <span className="inline-block text-[0.65rem] font-bold uppercase tracking-wider text-amber-700 bg-amber-700/6 py-0.5 px-2 rounded-full border border-amber-700/20">
                            {activeSong.category}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-primary m-0">{activeSong.title}</h2>
                      {activeSong.composer && <p className="text-muted text-xs mt-1 m-0">by {activeSong.composer}</p>}
                    </div>
                  )}

                  {/* Live Customizer Bar for Font Size, Weight & Key */}
                  <div className="mb-4">
                    <ChordProControls
                      semitones={session.director_semitones}
                      onSemitonesChange={async (st) => {
                        if (isDirector) {
                          setSession(p => p ? { ...p, director_semitones: st } : null);
                          await updateLiveSession(session.id, { director_semitones: st });
                        }
                      }}
                      fontSize={fontSize}
                      onFontSizeChange={setFontSize}
                      fontWeight={fontWeight}
                      onFontWeightChange={setFontWeight}
                      showChords={isChordsVisible}
                      onShowChordsChange={(val) => {
                        setLocalShowChords(val);
                        if (isDirector) {
                          updateLiveSession(session.id, { show_chords: val });
                        }
                      }}
                    />
                  </div>

                  {activeSong.lyrics ? (
                    <ChordProRenderer
                      lyrics={activeSong.lyrics}
                      semitones={session.director_semitones}
                      fontSize={fontSize}
                      fontWeight={fontWeight}
                      showChords={isChordsVisible}
                    />
                  ) : (
                    <div className="text-center text-muted py-10">
                      No lyrics available for this song.
                    </div>
                  )}
                </div>

                {/* Next Song Preview Card */}
                {nextItem && nextItem.songs && (
                  <div className="live-anim mt-6 bg-white/70 backdrop-blur-xl border border-glass-border rounded-2xl p-6 shadow-sm flex flex-col gap-4">
                    <div className="flex justify-between items-center flex-wrap gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs sm:text-[0.78rem] font-bold text-amber-700 uppercase tracking-wider">
                            ⏭️ Next Up
                          </span>
                          {nextItem.role_in_mass && (
                            <span className="inline-block text-[0.65rem] font-bold uppercase tracking-wider text-primary bg-primary/7 py-0.5 px-1.5 rounded-full border border-primary/15">
                              {MASS_ROLE_LABELS[nextItem.role_in_mass] || nextItem.role_in_mass}
                            </span>
                          )}
                          {(nextItem.songs.categories && nextItem.songs.categories.length > 0
                            ? nextItem.songs.categories
                            : nextItem.songs.category
                            ? [{ id: nextItem.songs.category, name: nextItem.songs.category }]
                            : []
                          ).map((cat: any) => (
                            <span key={cat.id || cat.name} className="inline-block text-[0.65rem] font-bold uppercase tracking-wider text-amber-700 bg-amber-700/6 py-0.5 px-1.5 rounded-full border border-amber-700/15">
                              {cat.name}
                            </span>
                          ))}
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-primary m-0">
                          {nextItem.songs.title}
                        </h3>
                        {nextItem.songs.composer && (
                          <p className="text-muted text-xs mt-0.5 m-0">
                            by {nextItem.songs.composer}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2.5 items-center flex-wrap">
                        <button
                          onClick={() => setShowNextLyrics(p => !p)}
                          className={`btn btn-secondary !min-h-[40px] !py-2 !px-4 text-xs sm:text-[0.82rem] ${
                            showNextLyrics ? '!border-primary !text-primary' : ''
                          }`}
                        >
                          {showNextLyrics ? 'Hide Lyrics Preview' : '👁️ Preview Lyrics'}
                        </button>
                        
                        {isDirector && (
                          <button
                            onClick={() => handleNavigateToSong(nextItem.song_id)}
                            className="btn btn-primary !min-h-[40px] !py-2 !px-4 text-xs sm:text-[0.82rem]"
                          >
                            Switch to Next ▶
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline lyrics preview */}
                    {showNextLyrics && (
                      <div className="bg-white border border-primary/8 rounded-2xl p-5 mt-2 max-h-[400px] overflow-y-auto shadow-inner">
                        {nextItem.songs.lyrics ? (
                          <ChordProRenderer
                            lyrics={nextItem.songs.lyrics}
                            semitones={session.director_semitones}
                            fontSize={16} // slightly smaller font for preview
                            showChords={isChordsVisible}
                          />
                        ) : (
                          <p className="text-muted text-center my-4 text-xs sm:text-sm">
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
    </div>
  );
};

export default LiveSessionClient;
