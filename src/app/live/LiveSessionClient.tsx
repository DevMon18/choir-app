'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChordProRenderer, usePersistedFontSize, usePersistedFontWeight } from '@/components/ChordProRenderer';
import Link from 'next/link';
import { updateLiveSession, substituteSequenceSong } from '../admin/sequences/actions';
import { Navbar } from '@/components/Navbar';
import { useToast } from '@/components/Toast';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Radio,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ListMusic,
  Maximize2,
  Minimize2,
  Tv,
  Search,
  X,
  Music,
  Check,
  FolderOpen,
  SlidersHorizontal,
} from 'lucide-react';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

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
  kyrie: 'Kyrie',
  gloria: 'Gloria',
  psalm: 'Responsorial Psalm',
  gospel: 'Gospel Acclamation',
  offertory: 'Offertory / Presentation',
  sanctus: 'Sanctus',
  memorial: 'Memorial Acclamation',
  amen: 'Great Amen',
  agnus: 'Lamb of God',
  communion: 'Communion Song',
  recessional: 'Recessional / Closing',
};

const MASS_PART_CATEGORIES = [
  { id: 'ALL', name: 'All Songs' },
  { id: 'entrance-song', name: 'Entrance Song', matchKeywords: ['entrance song', 'entrance'] },
  { id: 'kyrie', name: 'Kyrie', matchKeywords: ['kyrie', 'lord have mercy', 'lord, have mercy'] },
  { id: 'gloria', name: 'Gloria', matchKeywords: ['gloria', 'glory to god'] },
  { id: 'responsorial-psalm', name: 'Responsorial Psalm', matchKeywords: ['responsorial psalm', 'psalm'] },
  { id: 'gospel-acclamation', name: 'Gospel Acclamation', matchKeywords: ['gospel acclamation', 'gospel', 'alleluia', 'praise to you'] },
  { id: 'offertory-presentation', name: 'Offertory / Presentation', matchKeywords: ['offertory / presentation song', 'offertory / presentation', 'offertory', 'presentation song', 'offertory song'] },
  { id: 'sanctus', name: 'Sanctus', matchKeywords: ['sanctus', 'holy, holy, holy', 'holy holy holy'] },
  { id: 'memorial-acclamation', name: 'Memorial Acclamation', matchKeywords: ['memorial acclamation'] },
  { id: 'great-amen', name: 'Great Amen', matchKeywords: ['great amen', 'amen'] },
  { id: 'lords-prayer', name: "Lord's Prayer", matchKeywords: ["lord's prayer", 'lords prayer', 'our father'] },
  { id: 'lamb-of-god', name: 'Lamb of God', matchKeywords: ['lamb of god', 'agnus dei'] },
  { id: 'communion-song', name: 'Communion Song', matchKeywords: ['communion song', 'communion'] },
  { id: 'recessional-closing', name: 'Recessional / Closing', matchKeywords: ['recessional / closing song', 'recessional / closing', 'recessional', 'closing song', 'sending forth'] },
];

const isSameCategoryOrRole = (roleKeyOrLabel: string | null, catName: string): boolean => {
  if (!roleKeyOrLabel || !catName) return false;
  const r = roleKeyOrLabel.toLowerCase().trim();
  const c = catName.toLowerCase().trim();
  if (r === c || r.includes(c) || c.includes(r)) return true;

  const matchingDef = MASS_PART_CATEGORIES.find(
    (p) => p.id === r || p.name.toLowerCase() === r || (p.matchKeywords && p.matchKeywords.some((kw) => r.includes(kw) || kw.includes(r)))
  );
  if (matchingDef && matchingDef.matchKeywords) {
    return matchingDef.matchKeywords.some((kw) => c.includes(kw) || kw.includes(c)) || matchingDef.name.toLowerCase() === c;
  }
  return false;
};

const matchesCategory = (song: Song, partDef: typeof MASS_PART_CATEGORIES[0], activeSequenceItems?: any[]): boolean => {
  if (partDef.id === 'ALL') return true;
  const songCatNames = (song.categories || []).map((c) => (c.name || '').toLowerCase().trim());
  if (song.category) songCatNames.push(song.category.toLowerCase().trim());

  if (activeSequenceItems && activeSequenceItems.length > 0) {
    const seqItems = activeSequenceItems.filter((i) => i.song_id === song.id);
    seqItems.forEach((i) => {
      if (i.role_in_mass) {
        const label = MASS_ROLE_LABELS[i.role_in_mass] || i.role_in_mass;
        songCatNames.push(label.toLowerCase().trim());
        songCatNames.push(i.role_in_mass.toLowerCase().trim());
      }
    });
  }

  const targetLower = partDef.name.toLowerCase().trim();
  const targetId = partDef.id.toLowerCase().trim();
  const keywords = (partDef as any).matchKeywords || [];

  return songCatNames.some((cat) => {
    if (!cat) return false;
    if (cat === targetLower || cat === targetId || cat.includes(targetLower) || targetLower.includes(cat)) return true;
    return keywords.some((kw: string) => cat.includes(kw) || kw.includes(cat));
  });
};

interface Props {
  profile: Profile;
  initialSession: LiveSession | null;
  initialSong: Song | null;
  songs: Song[];
  activeSequenceItems?: any[];
}

type ConnStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export const LiveSessionClient = ({
  profile,
  initialSession,
  initialSong,
  songs,
  activeSequenceItems: initialSequenceItems = [],
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { addToast } = useToast();

  const [session, setSession] = useState<LiveSession | null>(initialSession);
  const [activeSequenceItems, setActiveSequenceItems] = useState<any[]>(initialSequenceItems);
  const [globalActiveSong, setGlobalActiveSong] = useState<Song | null>(initialSong);
  const [previewSongId, setPreviewSongId] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<ConnStatus>('connecting');
  const [manualScroll, setManualScroll] = useState(false);
  const [localShowChords, setLocalShowChords] = useState<boolean | null>(null);
  const [showNextLyrics, setShowNextLyrics] = useState(false);
  const [showFormattingControls, setShowFormattingControls] = useState(false);

  // Search Repertoire Modal State
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [modalSelectedCategory, setModalSelectedCategory] = useState('ALL');

  // Persisted accessibility controls for font size & weight in Live Sync (Default: 16px, Medium 500)
  const [fontSize, setFontSize] = usePersistedFontSize('choir_live_fontsize', 16);
  const [fontWeight, setFontWeight] = usePersistedFontWeight('choir_live_fontweight', 500);

  const isDirector = ['super_admin', 'director'].includes(profile.role);

  // Auto-focus search input when modal opens
  useEffect(() => {
    if (isSearchModalOpen) {
      // Auto-select category if current song has a matching role
      const currentItem = activeSequenceItems.find(i => i.song_id === globalActiveSong?.id);
      if (currentItem?.role_in_mass) {
        const found = MASS_PART_CATEGORIES.find(c => c.id === currentItem.role_in_mass || c.matchKeywords?.some(k => k.includes(currentItem.role_in_mass.toLowerCase())));
        if (found) setModalSelectedCategory(found.id);
      }

      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setModalSearchQuery('');
    }
  }, [isSearchModalOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  // Determine current displayed song: If member is previewing, show that; otherwise show global active song
  const isPreviewMode = !isDirector && previewSongId !== null && previewSongId !== globalActiveSong?.id;
  const displayedSong = useMemo(() => {
    if (isPreviewMode && previewSongId) {
      return songs.find((s) => s.id === previewSongId) || globalActiveSong;
    }
    return globalActiveSong;
  }, [isPreviewMode, previewSongId, songs, globalActiveSong]);

  // Reset next lyrics preview when displayed song changes
  useEffect(() => {
    setShowNextLyrics(false);
  }, [displayedSong?.id]);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);

  // Check if current displayed song contains ChordPro bracket chords [G], [Em], etc.
  const hasChords = useMemo(() => {
    if (!displayedSong?.lyrics) return false;
    return /\[[A-G][#b]?[^\]]*\]/.test(displayedSong.lyrics);
  }, [displayedSong?.lyrics]);

  // Effective chords visibility
  const isChordsVisible = localShowChords !== null ? localShowChords : (session?.show_chords ?? true);

  // Sequence position & role resolution based on displayed song
  const activeItem = displayedSong ? activeSequenceItems.find((i) => i.song_id === displayedSong.id) : null;
  
  const activeSongMassRole = useMemo(() => {
    if (activeItem?.role_in_mass) {
      return MASS_ROLE_LABELS[activeItem.role_in_mass] || activeItem.role_in_mass;
    }
    if (!displayedSong) return null;
    // Derive role from displayedSong categories if not in sequence items
    const rawCats = (displayedSong.categories || []).map((c: any) => (c.name || '').toLowerCase().trim());
    if (displayedSong.category) rawCats.push(displayedSong.category.toLowerCase().trim());
    for (const cat of rawCats) {
      const match = MASS_PART_CATEGORIES.find(
        (p) =>
          p.id !== 'ALL' &&
          (p.name.toLowerCase() === cat ||
            p.name.toLowerCase().includes(cat) ||
            cat.includes(p.name.toLowerCase()) ||
            (p.matchKeywords && p.matchKeywords.some((kw) => cat.includes(kw) || kw.includes(cat))))
      );
      if (match) return match.name;
    }
    return null;
  }, [activeItem, displayedSong]);

  // Determine sequence index (direct song match or liturgical mass role match)
  const currentIndex = useMemo(() => {
    if (!displayedSong) return -1;
    const directIdx = activeSequenceItems.findIndex((i) => i.song_id === displayedSong.id);
    if (directIdx !== -1) return directIdx;

    if (activeSongMassRole) {
      const roleIdx = activeSequenceItems.findIndex(
        (i) => i.role_in_mass && isSameCategoryOrRole(activeSongMassRole, MASS_ROLE_LABELS[i.role_in_mass] || i.role_in_mass)
      );
      if (roleIdx !== -1) return roleIdx;
    }

    return -1;
  }, [displayedSong, activeSequenceItems, activeSongMassRole]);

  const prevItem = currentIndex > 0 ? activeSequenceItems[currentIndex - 1] : null;
  const nextItem = currentIndex !== -1 && currentIndex < activeSequenceItems.length - 1 ? activeSequenceItems[currentIndex + 1] : null;

  // Helper to deduplicate mass role and category badges deterministically
  const uniqueBadges = useMemo(() => {
    const seen = new Set<string>();
    const badges: { id: string; name: string; type: 'role' | 'category' }[] = [];

    if (activeSongMassRole) {
      seen.add(activeSongMassRole.toLowerCase().trim());
      badges.push({ id: `role-${activeSongMassRole}`, name: activeSongMassRole, type: 'role' });
    }

    const rawCats = displayedSong?.categories && displayedSong.categories.length > 0
      ? displayedSong.categories
      : displayedSong?.category
      ? [{ id: displayedSong.category, name: displayedSong.category }]
      : [];

    rawCats.forEach((cat) => {
      const key = cat.name.toLowerCase().trim();
      if (!seen.has(key) && !isSameCategoryOrRole(activeSongMassRole, cat.name)) {
        seen.add(key);
        badges.push({ id: cat.id || `cat-${cat.name}`, name: cat.name, type: 'category' });
      }
    });

    return badges;
  }, [activeSongMassRole, displayedSong]);

  // Next Up deduplicated badges
  const nextItemBadges = useMemo(() => {
    if (!nextItem?.songs) return [];
    const seen = new Set<string>();
    const badges: { id: string; name: string; type: 'role' | 'category' }[] = [];

    const roleName = nextItem.role_in_mass ? MASS_ROLE_LABELS[nextItem.role_in_mass] || nextItem.role_in_mass : null;
    if (roleName) {
      seen.add(roleName.toLowerCase().trim());
      badges.push({ id: `role-${roleName}`, name: roleName, type: 'role' });
    }

    const rawCats = nextItem.songs.categories && nextItem.songs.categories.length > 0
      ? nextItem.songs.categories
      : nextItem.songs.category
      ? [{ id: nextItem.songs.category, name: nextItem.songs.category }]
      : [];

    rawCats.forEach((cat: any) => {
      const key = (cat.name || '').toLowerCase().trim();
      if (key && !seen.has(key) && !isSameCategoryOrRole(roleName, cat.name)) {
        seen.add(key);
        badges.push({ id: cat.id || `cat-${cat.name}`, name: cat.name, type: 'category' });
      }
    });

    return badges;
  }, [nextItem]);

  // Helper to determine the default category filter matching the current song's mass role or category
  const getCategoryForDisplayedSong = (): string => {
    if (activeSongMassRole) {
      const roleLower = activeSongMassRole.toLowerCase().trim();
      const match = MASS_PART_CATEGORIES.find(
        (p) =>
          p.id !== 'ALL' &&
          (p.id === roleLower ||
            p.name.toLowerCase() === roleLower ||
            p.name.toLowerCase().includes(roleLower) ||
            roleLower.includes(p.name.toLowerCase()) ||
            (p.matchKeywords && p.matchKeywords.some((kw) => roleLower.includes(kw) || kw.includes(roleLower))))
      );
      if (match) return match.id;
    }

    if (displayedSong) {
      const rawCats = (displayedSong.categories || []).map((c: any) => (c.name || '').toLowerCase().trim());
      if (displayedSong.category) rawCats.push(displayedSong.category.toLowerCase().trim());
      for (const cat of rawCats) {
        if (!cat) continue;
        const match = MASS_PART_CATEGORIES.find(
          (p) =>
            p.id !== 'ALL' &&
            (p.name.toLowerCase() === cat ||
              p.name.toLowerCase().includes(cat) ||
              cat.includes(p.name.toLowerCase()) ||
              (p.matchKeywords && p.matchKeywords.some((kw) => cat.includes(kw) || kw.includes(cat))))
        );
        if (match) return match.id;
      }
    }
    return 'ALL';
  };

  const handleOpenSearchModal = (overrideCategoryId?: string) => {
    const targetCategory = overrideCategoryId || getCategoryForDisplayedSong();
    setModalSelectedCategory(targetCategory);
    setModalSearchQuery('');
    setIsSearchModalOpen(true);
  };

  const pendingNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Authoritative Director navigation (broadcasts to all connected choir members & synchronizes sequence)
  const handleDirectorNavigate = (songId: string | null) => {
    if (!session || !songId) return;
    const newSong = songs.find((s) => s.id === songId) || null;

    // 1. Optimistic Local Update for active song
    setGlobalActiveSong(newSong);
    setPreviewSongId(null);
    setIsSearchModalOpen(false);

    // 2. Synchronize Sequence: If session is bound to a sequence and the song is substituted or not in sequence
    if (session.sequence_id && newSong && !activeSequenceItems.some((i) => i.song_id === newSong.id)) {
      const targetItem = activeItem || (activeSongMassRole ? activeSequenceItems.find(i => i.role_in_mass === activeSongMassRole || MASS_ROLE_LABELS[i.role_in_mass] === activeSongMassRole) : null);
      const targetRoleId = targetItem?.role_in_mass || null;

      if (targetItem) {
        setActiveSequenceItems((prev) =>
          prev.map((item) => (item.id === targetItem.id ? { ...item, song_id: newSong.id, songs: newSong } : item))
        );
      } else {
        setActiveSequenceItems((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            sequence_id: session.sequence_id,
            song_id: newSong.id,
            order_index: prev.length,
            role_in_mass: null,
            songs: newSong,
          },
        ]);
      }

      // Persist sequence update in background
      substituteSequenceSong(
        session.sequence_id,
        newSong.id,
        targetItem?.id || null,
        targetRoleId
      ).catch((err) => console.error('Error synchronizing sequence item:', err));
    }

    // 3. Debounce backend update to prevent HTTP 429 Rate Limit error on rapid clicks
    if (pendingNavTimerRef.current) {
      clearTimeout(pendingNavTimerRef.current);
    }

    pendingNavTimerRef.current = setTimeout(async () => {
      try {
        const res = await updateLiveSession(session.id, { active_song_id: songId });
        if (res?.error) {
          addToast({ type: 'error', title: 'Sync Error', message: res.error });
        }
      } catch (err) {
        console.error('Error updating live session song:', err);
      }
    }, 200);
  };

  // Member local preview (does not mutate global live session)
  const handleMemberPreview = (songId: string | null) => {
    setIsSearchModalOpen(false);
    if (!songId) {
      setPreviewSongId(null);
      return;
    }
    if (songId === globalActiveSong?.id) {
      setPreviewSongId(null);
    } else {
      setPreviewSongId(songId);
      const s = songs.find((item) => item.id === songId);
      if (s) {
        addToast({
          type: 'info',
          title: 'Previewing Song',
          message: `Previewing "${s.title}" (Choir live is "${globalActiveSong?.title || 'None'}")`,
        });
      }
    }
  };

  const handleReturnToLiveSong = () => {
    setPreviewSongId(null);
  };

  // ── Wake Lock ──────────────────────────────────────────
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      /* silently ignore */
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
          reconnectDelay.current = 1000;
          const row = payload.new as LiveSession;
          setSession(row);
          if (!row.is_active) {
            setGlobalActiveSong(null);
            setPreviewSongId(null);
            return;
          }
          if (row.active_song_id) {
            const song = songs.find((s) => s.id === row.active_song_id) ?? null;
            setGlobalActiveSong(song);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sequence_items' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            const song = songs.find((s) => s.id === updated.song_id) ?? null;
            setActiveSequenceItems((prev) =>
              prev.map((item) =>
                item.id === updated.id
                  ? { ...item, song_id: updated.song_id, songs: song || item.songs }
                  : item
              )
            );
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as any;
            const song = songs.find((s) => s.id === inserted.song_id) ?? null;
            setActiveSequenceItems((prev) => {
              if (prev.some((item) => item.id === inserted.id)) return prev;
              const nextList = [...prev, { ...inserted, songs: song }];
              return nextList.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
            });
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as any;
            setActiveSequenceItems((prev) => prev.filter((item) => item.id !== deleted.id));
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
      gsap.fromTo(
        '.live-anim',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
      );
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleToggleChords = async () => {
    if (!hasChords) return;
    const nextVal = !isChordsVisible;
    setLocalShowChords(nextVal);
    if (isDirector && session) {
      setSession((prev) => (prev ? { ...prev, show_chords: nextVal } : null));
      await updateLiveSession(session.id, { show_chords: nextVal });
    }
  };

  const handleSemitonesChange = async (st: number) => {
    if (!session) return;
    if (isDirector) {
      setSession((prev) => (prev ? { ...prev, director_semitones: st } : null));
      await updateLiveSession(session.id, { director_semitones: st });
    }
  };

  // Status visual tokens
  const statusColor = {
    connected: '#059669',
    connecting: '#d97706',
    reconnecting: '#d97706',
    disconnected: '#dc2626',
  }[connStatus];

  const statusLabel = {
    connected: 'Live Sync Connected',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    disconnected: 'Disconnected',
  }[connStatus];

  // Scroll speed calculation & Auto-scroll
  const scrollPxPerSec = session ? [0, 20, 40, 80][session.scroll_speed] ?? 40 : 40;

  useEffect(() => {
    if (manualScroll || !session || scrollPxPerSec === 0) return;
    const iv = setInterval(() => {
      window.scrollBy({ top: scrollPxPerSec / 30, behavior: 'auto' });
    }, 33);
    return () => clearInterval(iv);
  }, [manualScroll, scrollPxPerSec, session]);

  const semitones = session?.director_semitones ?? 0;

  // Filter songs in Repertoire search modal
  const filteredModalSongs = useMemo(() => {
    const q = modalSearchQuery.toLowerCase().trim();
    const selectedCategoryDef = MASS_PART_CATEGORIES.find((c) => c.id === modalSelectedCategory) || MASS_PART_CATEGORIES[0];

    return songs.filter((s) => {
      // Category filter
      if (modalSelectedCategory !== 'ALL') {
        const matches = matchesCategory(s, selectedCategoryDef, activeSequenceItems);
        if (!matches) return false;
      }

      // Query filter
      if (!q) return true;

      const titleMatch = (s.title || '').toLowerCase().includes(q);
      const composerMatch = (s.composer || '').toLowerCase().includes(q);
      const lyricsMatch = (s.lyrics || '').toLowerCase().includes(q);
      const categoryMatch = (s.categories || []).some((c) => (c.name || '').toLowerCase().includes(q)) || (s.category || '').toLowerCase().includes(q);

      return titleMatch || composerMatch || lyricsMatch || categoryMatch;
    });
  }, [songs, modalSearchQuery, modalSelectedCategory, activeSequenceItems]);

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative bg-[#f8f6f0]">
      {/* Top Navbar */}
      <div className="shrink-0 z-30">
        <Navbar profile={profile} />
      </div>

      <main className="flex-1 max-w-[880px] mx-auto w-full px-3 sm:px-5 py-3 sm:py-5 pb-24">
        {/* State 1: No Live Session Active */}
        {!session || !session.is_active ? (
          <div className="glass-container live-anim text-center py-16 px-6 rounded-2xl bg-white border border-glass-border shadow-sm">
            <div className="text-5xl mb-3">📺</div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary mb-2">
              No Live Session Active
            </h1>
            <p className="text-muted text-sm sm:text-base max-w-md mx-auto mb-6">
              {isDirector
                ? 'Select a sequence to initiate a synchronized live performance session for the choir.'
                : 'Waiting for the Choir Director to initiate the live session.'}
            </p>
            {isDirector ? (
              <Link href="/admin/sequences" className="btn btn-primary !min-h-[46px] !px-6">
                Go to Sequences →
              </Link>
            ) : (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted bg-black/5 py-1.5 px-3.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Auto-refreshes when director starts live session</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Live Connection Status & Member Preview Notice Banner */}
            {isPreviewMode && (
              <div className="live-anim bg-amber-50 border border-amber-300 rounded-xl p-3 sm:px-4 flex items-center justify-between gap-3 flex-wrap shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-base">👁️</span>
                  <div>
                    <strong className="text-xs sm:text-sm font-bold text-amber-900 block leading-tight">
                      Preview Mode: {displayedSong?.title}
                    </strong>
                    <span className="text-[11px] text-amber-800">
                      Live for Choir: <strong>{globalActiveSong?.title || 'None'}</strong>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleReturnToLiveSong}
                  className="btn btn-primary !bg-amber-700 !border-amber-700 !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-none"
                >
                  <RotateCcw size={13} />
                  <span>Back to Live Song</span>
                </button>
              </div>
            )}

            {/* UNIFIED ACTIVE SONG PERFORMANCE VIEWPORT */}
            <div className="live-anim rounded-2xl bg-white border border-primary/15 shadow-sm overflow-hidden flex flex-col">
              {/* 1. Header Toolbar (Navigation, Search Repertoire Trigger & Live Status) */}
              <div className="p-3 sm:p-4 border-b border-primary/10 bg-[#faf9f5] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
                {/* Setlist Navigation Control Group */}
                <div className="flex-1 w-full md:w-auto flex items-center gap-2">
                  {isDirector ? (
                    <div className="flex-1 flex items-center rounded-xl bg-white border border-primary/20 shadow-2xs p-0.5 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => prevItem && handleDirectorNavigate(prevItem.song_id)}
                        disabled={!prevItem}
                        aria-label="Previous song in setlist"
                        className={`inline-flex items-center justify-center py-1.5 px-2.5 sm:px-3 text-xs sm:text-sm font-bold rounded-lg transition-colors shrink-0 ${
                          !prevItem
                            ? 'text-muted/30 cursor-not-allowed'
                            : 'text-primary hover:bg-primary/8 active:scale-95 cursor-pointer'
                        }`}
                      >
                        <ChevronLeft size={16} />
                        <span className="hidden xs:inline">Prev</span>
                      </button>

                      <div className="w-[1px] h-6 bg-primary/15 self-center shrink-0" />

                      <select
                        value={displayedSong?.id || ''}
                        onChange={(e) => handleDirectorNavigate(e.target.value || null)}
                        aria-label="Select active song in sequence"
                        className="appearance-none bg-transparent border-none text-xs sm:text-sm font-bold text-primary py-1.5 px-2 outline-none cursor-pointer flex-1 min-w-0 text-center truncate"
                      >
                        <option value="" disabled>-- Select Song --</option>
                        {displayedSong && !activeSequenceItems.some((i) => i.song_id === displayedSong.id) && (
                          <option value={displayedSong.id}>
                            {currentIndex !== -1 ? `${currentIndex + 1}. ` : ''}
                            {activeSongMassRole ? `[${activeSongMassRole}] ` : ''}
                            {displayedSong.title}
                          </option>
                        )}
                        {activeSequenceItems.map((item, idx) => (
                          <option key={item.id} value={item.song_id || ''}>
                            {idx + 1}. {item.role_in_mass ? `[${MASS_ROLE_LABELS[item.role_in_mass] || item.role_in_mass}] ` : ''}
                            {item.songs?.title || 'Unknown Title'}
                          </option>
                        ))}
                      </select>

                      <div className="w-[1px] h-6 bg-primary/15 self-center shrink-0" />

                      <button
                        type="button"
                        onClick={() => nextItem && handleDirectorNavigate(nextItem.song_id)}
                        disabled={!nextItem}
                        aria-label="Next song in setlist"
                        className={`inline-flex items-center justify-center py-1.5 px-2.5 sm:px-3 text-xs sm:text-sm font-bold rounded-lg transition-colors shrink-0 ${
                          !nextItem
                            ? 'text-muted/30 cursor-not-allowed'
                            : 'text-primary hover:bg-primary/8 active:scale-95 cursor-pointer'
                        }`}
                      >
                        <span className="hidden xs:inline">Next</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  ) : (
                    /* Member Navigation / Preview selector */
                    <div className="flex-1 flex items-center rounded-xl bg-white border border-primary/20 shadow-2xs p-0.5 overflow-hidden">
                      <select
                        value={displayedSong?.id || ''}
                        onChange={(e) => handleMemberPreview(e.target.value || null)}
                        aria-label="Preview song in sequence"
                        className="appearance-none bg-transparent border-none text-xs sm:text-sm font-bold text-primary py-1.5 px-3 outline-none cursor-pointer flex-1 min-w-0 text-center truncate"
                      >
                        {displayedSong && !activeSequenceItems.some((i) => i.song_id === displayedSong.id) && (
                          <option value={displayedSong.id}>
                            {currentIndex !== -1 ? `${currentIndex + 1}. ` : ''}
                            {activeSongMassRole ? `[${activeSongMassRole}] ` : ''}
                            {displayedSong.title}
                            {displayedSong.id === globalActiveSong?.id ? ' (Live Now)' : ''}
                          </option>
                        )}
                        {activeSequenceItems.map((item, idx) => (
                          <option key={item.id} value={item.song_id || ''}>
                            {idx + 1}. {item.role_in_mass ? `[${MASS_ROLE_LABELS[item.role_in_mass] || item.role_in_mass}] ` : ''}
                            {item.songs?.title || 'Unknown Title'}
                            {item.song_id === globalActiveSong?.id ? ' (Live Now)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Sub-row on mobile/tablet portrait / inline on desktop: Search & Live Connection Indicator */}
                <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
                  {/* Search Repertoire Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenSearchModal()}
                    className="btn btn-secondary !min-h-[36px] !py-1.5 !px-3 text-xs font-bold inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-white hover:bg-primary/6 active:scale-95 cursor-pointer shadow-2xs text-primary flex-1 md:flex-initial justify-center"
                    title={isDirector ? 'Search and select any song from repertoire' : 'Search and preview any song from repertoire'}
                  >
                    <Search size={14} />
                    <span>{isDirector ? 'Change Song' : 'Browse Repertoire'}</span>
                  </button>

                  {/* Live Connection Indicator */}
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full py-1 px-3 text-xs font-bold shadow-2xs shrink-0"
                    style={{
                      background: `${statusColor}14`,
                      border: `1px solid ${statusColor}35`,
                      color: statusColor,
                    }}
                    title={statusLabel}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${connStatus === 'connected' ? 'animate-pulse' : ''}`}
                      style={{ background: statusColor }}
                    />
                    <span className="hidden sm:inline">{statusLabel}</span>
                    <span className="sm:hidden">{connStatus === 'connected' ? 'Live' : statusLabel}</span>
                  </span>
                </div>
              </div>

              {/* 2. Song Identity & Metadata Header */}
              {displayedSong ? (
                <div className="p-4 sm:p-6 border-b border-primary/10 flex flex-col gap-3.5">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0 pr-0 md:pr-2">
                      {/* Deduplicated Badges */}
                      {uniqueBadges.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {uniqueBadges.map((badge) => (
                            <span
                              key={badge.id}
                              onClick={() => handleOpenSearchModal()}
                              className={`inline-block text-[0.68rem] font-bold uppercase tracking-wider py-0.5 px-2.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                                badge.type === 'role'
                                  ? 'text-primary bg-primary/8 border-primary/25'
                                  : 'text-amber-800 bg-amber-700/8 border-amber-700/25'
                              }`}
                              title="Click to search songs in this category"
                            >
                              {badge.name}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-primary m-0 leading-tight break-words">
                          {displayedSong.title}
                        </h1>
                        {isDirector && (
                          <button
                            type="button"
                            onClick={() => handleOpenSearchModal()}
                            className="p-1.5 rounded-lg hover:bg-primary/8 text-primary/60 hover:text-primary transition-colors cursor-pointer shrink-0"
                            title="Click to search and change active song from repertoire"
                            aria-label="Change song from repertoire"
                          >
                            <Search size={16} />
                          </button>
                        )}
                      </div>

                      {displayedSong.composer && (
                        <p className="text-muted text-xs sm:text-sm mt-1 m-0">
                          by {displayedSong.composer}
                        </p>
                      )}
                    </div>

                    {/* Quick performance utility pills (Auto-scroll, Chords & Format toggle) */}
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowFormattingControls((p) => !p)}
                        className={`btn btn-secondary !min-h-[36px] sm:!min-h-[38px] !py-1.5 !px-2.5 sm:!px-3 text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 rounded-xl transition-colors shrink-0 ${
                          showFormattingControls ? '!border-primary !text-primary !bg-primary/6' : ''
                        }`}
                        title="Toggle text size, boldness, and key controls"
                        aria-expanded={showFormattingControls}
                      >
                        <SlidersHorizontal size={14} />
                        <span>{showFormattingControls ? 'Hide Controls' : 'Aa Controls'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setManualScroll((p) => !p)}
                        className={`btn btn-secondary !min-h-[36px] sm:!min-h-[38px] !py-1.5 !px-2.5 sm:!px-3 text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 rounded-xl shrink-0 ${
                          manualScroll ? '!border-primary !text-primary !bg-primary/6' : ''
                        }`}
                        title="Toggle auto-scroll vs manual scroll"
                      >
                        <span>{manualScroll ? '⏸ Manual' : '⏩ Auto-scroll'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleToggleChords}
                        disabled={!hasChords}
                        className={`btn !min-h-[36px] sm:!min-h-[38px] !py-1.5 !px-2.5 sm:!px-3 text-[11px] sm:text-xs font-bold inline-flex items-center justify-center gap-1.5 rounded-xl transition-colors shrink-0 ${
                          !hasChords
                            ? 'cursor-not-allowed bg-slate-100/90 border border-slate-200 text-slate-500'
                            : isChordsVisible
                            ? 'btn-secondary !border-primary !text-primary !bg-primary/6'
                            : 'btn-secondary'
                        }`}
                        title={
                          !hasChords
                            ? 'No chords available in this song'
                            : isDirector
                            ? 'Toggle chords visibility for choir'
                            : 'Toggle chords visibility on your device'
                        }
                      >
                        <span>
                          {!hasChords ? '🎸 No Chords' : isChordsVisible ? '🎸 Chords: On' : '📝 Chords: Off'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 3. Streamlined Formatting Controls (Transposition + Size + Weight) - Responsive Drawer */}
                  {showFormattingControls && (
                    <div className="pt-3.5 mt-1 border-t border-primary/8 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs bg-[#faf9f5] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:px-6 rounded-b-xl animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* Key Transposition */}
                      <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-white sm:bg-transparent p-2 sm:p-0 rounded-xl border border-primary/10 sm:border-0 shadow-2xs sm:shadow-none">
                        <span className="font-bold text-muted uppercase tracking-wider text-[0.72rem]">
                          Key:
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={!isDirector && !hasChords}
                            onClick={() => handleSemitonesChange(Math.max(-6, semitones - 1))}
                            className="py-1 px-2 rounded-md border border-primary/20 bg-white font-bold text-primary hover:bg-primary/8 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            aria-label="Transpose down 1 semitone"
                          >
                            ♭−
                          </button>
                          <span className="font-bold text-primary min-w-[32px] text-center">
                            {semitones === 0 ? 'Orig' : semitones > 0 ? `+${semitones}` : semitones}
                          </span>
                          <button
                            type="button"
                            disabled={!isDirector && !hasChords}
                            onClick={() => handleSemitonesChange(Math.min(6, semitones + 1))}
                            className="py-1 px-2 rounded-md border border-primary/20 bg-white font-bold text-primary hover:bg-primary/8 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            aria-label="Transpose up 1 semitone"
                          >
                            ♯+
                          </button>
                          {semitones !== 0 && isDirector && (
                            <button
                              type="button"
                              onClick={() => handleSemitonesChange(0)}
                              className="py-0.5 px-1.5 text-[10px] text-muted hover:text-primary underline ml-0.5 cursor-pointer"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Font Size Preset */}
                      <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-white sm:bg-transparent p-2 sm:p-0 rounded-xl border border-primary/10 sm:border-0 shadow-2xs sm:shadow-none">
                        <span className="font-bold text-muted uppercase tracking-wider text-[0.72rem]">
                          Size:
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setFontSize(Math.max(14, fontSize - 2))}
                            className="py-1 px-2 rounded-md border border-primary/20 bg-white font-bold text-primary hover:bg-primary/8 active:scale-95 cursor-pointer"
                            aria-label="Decrease text size"
                          >
                            A−
                          </button>
                          <span className="font-bold text-primary min-w-[32px] text-center">
                            {fontSize}px
                          </span>
                          <button
                            type="button"
                            onClick={() => setFontSize(Math.min(32, fontSize + 2))}
                            className="py-1 px-2 rounded-md border border-primary/20 bg-white font-bold text-primary hover:bg-primary/8 active:scale-95 cursor-pointer"
                            aria-label="Increase text size"
                          >
                            A+
                          </button>
                        </div>
                      </div>

                      {/* Font Boldness Weight */}
                      <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-white sm:bg-transparent p-2 sm:p-0 rounded-xl border border-primary/10 sm:border-0 shadow-2xs sm:shadow-none">
                        <span className="font-bold text-muted uppercase tracking-wider text-[0.72rem]">
                          Weight:
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setFontWeight(Math.max(500, fontWeight - 100))}
                            className="py-1 px-2 rounded-md border border-primary/20 bg-white font-bold text-primary hover:bg-primary/8 active:scale-95 cursor-pointer"
                            aria-label="Decrease text weight"
                          >
                            B−
                          </button>
                          <span
                            className="min-w-[44px] text-center text-primary font-bold text-xs"
                            style={{ fontWeight }}
                          >
                            {fontWeight >= 800 ? 'Black' : fontWeight >= 700 ? 'Bold' : fontWeight >= 600 ? 'Semi' : 'Medium'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setFontWeight(Math.min(900, fontWeight + 100))}
                            className="py-1 px-2 rounded-md border border-primary/20 bg-white font-bold text-primary hover:bg-primary/8 active:scale-95 cursor-pointer"
                            aria-label="Increase text weight"
                          >
                            B+
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 text-center text-muted">
                  <div className="text-4xl mb-2">🎶</div>
                  <h2 className="text-primary font-bold text-lg mb-1">Live Session Active</h2>
                  <p className="text-xs sm:text-sm mb-4">
                    Waiting for the Director to select a song from the sequence…
                  </p>
                  {isDirector && (
                    <button
                      type="button"
                      onClick={() => handleOpenSearchModal('ALL')}
                      className="btn btn-primary !min-h-[42px] !py-2 !px-5 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Search size={14} />
                      <span>Select Song from Repertoire</span>
                    </button>
                  )}
                </div>
              )}

              {/* 4. Lyrics Viewport */}
              {displayedSong && (
                <div className="p-4 sm:p-6 md:p-8 lg:p-10 overflow-x-auto bg-[#fdfcf9]">
                  {displayedSong.lyrics ? (
                    <ChordProRenderer
                      lyrics={displayedSong.lyrics}
                      semitones={semitones}
                      fontSize={fontSize}
                      fontWeight={fontWeight}
                      showChords={isChordsVisible && hasChords}
                    />
                  ) : (
                    <div className="text-center text-muted py-12">
                      <p className="text-sm m-0 font-medium">
                        No lyrics available for this song.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 5. NEXT UP SONG PREVIEW CARD */}
            {nextItem && nextItem.songs && (
              <div className="live-anim rounded-2xl bg-white border border-primary/15 p-4 sm:p-5 shadow-2xs flex flex-col gap-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <span className="text-xs font-bold text-amber-800 uppercase tracking-wider mr-1">
                        ⏭️ Next Up:
                      </span>
                      {nextItemBadges.map((badge) => (
                        <span
                          key={badge.id}
                          className={`inline-block text-[0.65rem] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full border ${
                            badge.type === 'role'
                              ? 'text-primary bg-primary/8 border-primary/20'
                              : 'text-amber-800 bg-amber-700/8 border-amber-700/20'
                          }`}
                        >
                          {badge.name}
                        </span>
                      ))}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-primary m-0 break-words">
                      {nextItem.songs.title}
                    </h3>
                    {nextItem.songs.composer && (
                      <p className="text-muted text-xs mt-0.5 m-0">
                        by {nextItem.songs.composer}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 items-center flex-wrap w-full md:w-auto justify-stretch md:justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowNextLyrics((p) => !p)}
                      className={`btn btn-secondary !min-h-[38px] !py-1.5 !px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 flex-1 md:flex-initial rounded-xl ${
                        showNextLyrics ? '!border-primary !text-primary !bg-primary/6' : ''
                      }`}
                    >
                      <Eye size={14} />
                      <span>{showNextLyrics ? 'Hide Lyrics' : 'Preview Lyrics'}</span>
                    </button>

                    {isDirector ? (
                      <button
                        type="button"
                        onClick={() => handleDirectorNavigate(nextItem.song_id)}
                        className="btn btn-primary !min-h-[38px] !py-1.5 !px-3 text-xs font-bold inline-flex items-center justify-center gap-1 flex-1 md:flex-initial rounded-xl"
                      >
                        <span>Switch to Next</span>
                        <ChevronRight size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMemberPreview(nextItem.song_id)}
                        className="btn btn-primary !min-h-[38px] !py-1.5 !px-3 text-xs font-bold inline-flex items-center justify-center gap-1 flex-1 md:flex-initial rounded-xl"
                      >
                        <span>Preview Song</span>
                        <ChevronRight size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Collapsible Next Song Lyrics Preview */}
                {showNextLyrics && (
                  <div className="bg-[#faf9f5] border border-primary/10 rounded-xl p-4 sm:p-5 mt-1 max-h-[360px] overflow-y-auto">
                    {nextItem.songs.lyrics ? (
                      <ChordProRenderer
                        lyrics={nextItem.songs.lyrics}
                        semitones={semitones}
                        fontSize={Math.max(14, fontSize - 2)}
                        fontWeight={fontWeight}
                        showChords={isChordsVisible}
                      />
                    ) : (
                      <p className="text-muted text-center my-3 text-xs">
                        No lyrics available for this song.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── FULL REPERTOIRE SEARCH & CHANGE SONG MODAL ── */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-[#f8f6f0] border border-primary/20 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-label={isDirector ? 'Search and select song from repertoire' : 'Search and preview song from repertoire'}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-white border-b border-primary/12 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center text-primary">
                  <Music size={18} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-primary m-0 leading-tight">
                    {isDirector ? 'Change Live Song (Repertoire)' : 'Browse Repertoire'}
                  </h2>
                  <p className="text-muted text-xs m-0 mt-0.5">
                    {isDirector
                      ? 'Select any song to instantly change the live song for the entire choir.'
                      : 'Search and preview lyrics or chords on your device.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close search dialog"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search Input Box */}
            <div className="p-3 sm:p-4 bg-white border-b border-primary/10">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  placeholder="Search by song title, composer, lyrics, or category..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-[#faf9f5] border border-primary/20 rounded-xl outline-none focus:border-primary focus:bg-white text-foreground transition-all"
                />
                {modalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setModalSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Mass Part / Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 mt-1 no-scrollbar">
                {MASS_PART_CATEGORIES.map((cat) => {
                  const isSelected = modalSelectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setModalSelectedCategory(cat.id)}
                      className={`whitespace-nowrap px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-white shadow-xs'
                          : 'bg-primary/6 text-primary hover:bg-primary/12 border border-primary/15'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Modal Body: Results List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3">
              {/* Quick Section: Current Sequence Items if search query is empty */}
              {!modalSearchQuery && modalSelectedCategory === 'ALL' && activeSequenceItems.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 mb-2 px-1">
                    <ListMusic size={14} className="text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-primary">
                      Current Setlist Songs ({activeSequenceItems.length})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeSequenceItems.map((item, idx) => {
                      if (!item.songs) return null;
                      const isLive = item.song_id === globalActiveSong?.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isDirector) handleDirectorNavigate(item.song_id);
                            else handleMemberPreview(item.song_id);
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                            isLive
                              ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400'
                              : 'bg-white border-primary/15 hover:border-primary/40 hover:bg-primary/4'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                                #{idx + 1}
                              </span>
                              {item.role_in_mass && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                                  {MASS_ROLE_LABELS[item.role_in_mass] || item.role_in_mass}
                                </span>
                              )}
                              {isLive && (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-600 text-white">
                                  ● Live Now
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs sm:text-sm font-bold text-primary truncate m-0">
                              {item.songs.title}
                            </h4>
                            {item.songs.composer && (
                              <p className="text-[11px] text-muted truncate m-0 mt-0.5">
                                {item.songs.composer}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className={`btn !min-h-[30px] !py-1 !px-2.5 text-[11px] font-bold rounded-lg ${
                              isLive ? 'btn-secondary !text-emerald-700' : 'btn-primary'
                            }`}
                          >
                            {isLive ? 'Active' : isDirector ? 'Select' : 'Preview'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All / Filtered Repertoire Songs Header */}
              <div className="flex items-center justify-between px-1 flex-wrap gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  {modalSelectedCategory !== 'ALL'
                    ? `${MASS_PART_CATEGORIES.find((c) => c.id === modalSelectedCategory)?.name} (${filteredModalSongs.length})`
                    : `Repertoire Catalog (${filteredModalSongs.length} songs)`}
                </span>
                {modalSelectedCategory !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setModalSelectedCategory('ALL')}
                    className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    View All Songs →
                  </button>
                )}
              </div>

              {/* Song List Cards */}
              {filteredModalSongs.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-primary/10">
                  <p className="text-sm font-semibold text-muted m-0">
                    No songs found matching &ldquo;{modalSearchQuery}&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredModalSongs.map((s) => {
                    const isLive = s.id === globalActiveSong?.id;
                    const songHasChords = Boolean(s.lyrics && /\[[A-G][#b]?[^\]]*\]/.test(s.lyrics));

                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (isDirector) handleDirectorNavigate(s.id);
                          else handleMemberPreview(s.id);
                        }}
                        className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isLive
                            ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400'
                            : 'bg-white border-primary/15 hover:border-primary hover:shadow-xs'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            {isLive && (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                Live Now
                              </span>
                            )}
                            {songHasChords && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-primary/8 text-primary border border-primary/20">
                                🎸 Chords
                              </span>
                            )}
                            {(s.categories && s.categories.length > 0
                              ? s.categories
                              : s.category
                              ? [{ id: s.category, name: s.category }]
                              : []
                            ).slice(0, 2).map((cat: any) => (
                              <span
                                key={cat.id || cat.name}
                                className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-700/8 text-amber-800 border border-amber-700/20"
                              >
                                {cat.name}
                              </span>
                            ))}
                          </div>

                          <h3 className="text-sm sm:text-base font-bold text-primary m-0 truncate">
                            {s.title}
                          </h3>
                          {s.composer && (
                            <p className="text-xs text-muted m-0 mt-0.5 truncate">
                              by {s.composer}
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            className={`btn !min-h-[34px] !py-1.5 !px-3 text-xs font-bold inline-flex items-center gap-1 rounded-lg ${
                              isLive
                                ? 'btn-secondary !text-emerald-700 !border-emerald-300'
                                : 'btn-primary'
                            }`}
                          >
                            <span>{isLive ? 'Active' : isDirector ? 'Select for Live' : 'Preview'}</span>
                            {!isLive && <ChevronRight size={13} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-white border-t border-primary/10 flex items-center justify-between text-xs text-muted px-4">
              <span>{filteredModalSongs.length} songs available</span>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="font-semibold text-primary hover:underline cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveSessionClient;
