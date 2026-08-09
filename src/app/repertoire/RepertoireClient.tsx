'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SongCategory } from '@/app/admin/songs/SongForm';
import { CategoryItem } from '@/app/admin/categories/actions';
import { Music, Search, ChevronRight, ChevronDown, ChevronUp, X, BookOpen, SortAsc, Layers, ListFilter } from 'lucide-react';
import gsap from 'gsap';
import { useClientCache } from '@/context/ClientCacheContext';

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
  categories?: SongCategory[];
  lyrics: string | null;
}

interface RepertoireClientProps {
  currentUserProfile: Profile;
  songs: Song[];
  availableCategories: CategoryItem[];
  query: string;
  categoriesParam?: string;
}

// Direct list of the 13 Mass Part names
const MASS_PART_SECTIONS = [
  { id: 'entrance-song', name: 'Entrance Song', matchKeywords: ['entrance song', 'entrance'] },
  { id: 'kyrie', name: 'Kyrie', matchKeywords: ['kyrie', 'lord have mercy', 'lord, have mercy'] },
  { id: 'gloria', name: 'Gloria', matchKeywords: ['gloria', 'glory to god'] },
  { id: 'responsorial-psalm', name: 'Responsorial Psalm', matchKeywords: ['responsorial psalm', 'psalm'] },
  { id: 'gospel-acclamation', name: 'Gospel Acclamation', matchKeywords: ['gospel acclamation', 'gospel acclamation (alleluia or praise to you)', 'gospel', 'alleluia', 'praise to you'] },
  { id: 'offertory-presentation', name: 'Offertory / Presentation', matchKeywords: ['offertory / presentation song', 'offertory', 'presentation song', 'offertory song'] },
  { id: 'sanctus', name: 'Sanctus', matchKeywords: ['sanctus', 'holy, holy, holy', 'holy holy holy'] },
  { id: 'memorial-acclamation', name: 'Memorial Acclamation', matchKeywords: ['memorial acclamation'] },
  { id: 'great-amen', name: 'Great Amen', matchKeywords: ['great amen', 'amen'] },
  { id: 'lords-prayer', name: "Lord's Prayer", matchKeywords: ["lord's prayer", 'lords prayer', 'our father'] },
  { id: 'lamb-of-god', name: 'Lamb of God', matchKeywords: ['lamb of god', 'agnus dei'] },
  { id: 'communion-song', name: 'Communion Song', matchKeywords: ['communion song', 'communion'] },
  { id: 'recessional-closing', name: 'Recessional / Closing', matchKeywords: ['recessional / closing song', 'recessional', 'closing song', 'sending forth'] },
];

const matchesMassPart = (song: Song, targetName: string, keywords: string[]): boolean => {
  const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
  if (song.category) songCatNames.push(song.category.toLowerCase());

  const targetLower = targetName.toLowerCase();

  return songCatNames.some((cat) => {
    if (cat === targetLower) return true;
    return keywords.some((kw) => cat.includes(kw));
  });
};

export const RepertoireClient = ({
  currentUserProfile,
  songs: initialSongs,
  availableCategories = [],
  query: initialQuery,
  categoriesParam = '',
}: RepertoireClientProps) => {
  const { data: songs } = useClientCache('repertoire_songs', initialSongs);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchValue, setSearchValue] = useState(initialQuery);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(categoriesParam || 'ALL');

  // Songbook Display Mode: 'MASS_PARTS' (Grouped by Mass Parts) vs 'AZ_INDEX' (Alphabetical Songbook Index)
  const [viewMode, setViewMode] = useState<'MASS_PARTS' | 'AZ_INDEX'>('MASS_PARTS');

  // Selected Mass Part Page Tab ('ALL' or section id like 'communion-song')
  const [activeTab, setActiveTab] = useState<string>('ALL');

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.anim-header', { opacity: 0, y: 15, duration: 0.4, ease: 'power2.out' });
      gsap.from('.anim-section', { opacity: 0, y: 15, duration: 0.4, stagger: 0.05, ease: 'power2.out' });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Keyboard shortcut listener ('/' or 'Cmd+K' to focus search input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync URL search params
  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) params.set('q', searchValue);
        if (selectedCategoryFilter && selectedCategoryFilter !== 'ALL') {
          params.set('categories', selectedCategoryFilter);
        }

        const queryString = params.toString();
        router.replace(`/repertoire${queryString ? `?${queryString}` : ''}`);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchValue, selectedCategoryFilter]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const collapseAllSections = () => {
    const newCollapsed: Record<string, boolean> = {};
    MASS_PART_SECTIONS.forEach((part) => {
      newCollapsed[part.id] = true;
    });
    newCollapsed['other-songs'] = true;
    setCollapsedSections(newCollapsed);
  };

  const expandAllSections = () => {
    setCollapsedSections({});
  };

  const isAdmin = ['super_admin', 'director', 'secretary'].includes(currentUserProfile.role);

  // Multi-field Search & Category Filtering
  const filteredSongs = songs.filter((song) => {
    if (searchValue.trim()) {
      const qLower = searchValue.toLowerCase().trim();
      const titleMatch = song.title.toLowerCase().includes(qLower);
      const composerMatch = song.composer ? song.composer.toLowerCase().includes(qLower) : false;
      const lyricsMatch = song.lyrics ? song.lyrics.toLowerCase().includes(qLower) : false;
      if (!titleMatch && !composerMatch && !lyricsMatch) return false;
    }

    if (selectedCategoryFilter && selectedCategoryFilter !== 'ALL') {
      const songCatIds = (song.categories || []).map((c) => c.id);
      const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
      if (song.category) songCatNames.push(song.category.toLowerCase());

      const targetLower = selectedCategoryFilter.toLowerCase();
      const matchById = songCatIds.includes(selectedCategoryFilter);
      const matchByName = songCatNames.includes(targetLower);

      if (!matchById && !matchByName) return false;
    }

    return true;
  });

  // Track assigned songs to list unassigned ones at bottom
  const assignedSongIds = new Set<string>();
  MASS_PART_SECTIONS.forEach((part) => {
    filteredSongs.forEach((s) => {
      if (matchesMassPart(s, part.name, part.matchKeywords)) {
        assignedSongIds.add(s.id);
      }
    });
  });
  const otherSongs = filteredSongs.filter((s) => !assignedSongIds.has(s.id));

  const isSearching = searchValue.trim().length > 0;

  // Render compact song row
  const renderSongRow = (song: Song) => {
    const tags = song.categories && song.categories.length > 0
      ? song.categories
      : song.category
      ? [{ id: song.category, name: song.category }]
      : [];

    return (
      <Link
        key={song.id}
        href={`/repertoire/${song.id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.88)',
          border: '1px solid var(--glass-border)',
          textDecoration: 'none',
          color: 'inherit',
          minHeight: '52px',
          transition: 'all 0.15s ease',
          gap: '12px',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = '#ffffff';
          (e.currentTarget as HTMLElement).style.boxShadow = 'var(--hover-shadow)';
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(30,58,138,0.2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.88)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(30,58,138,0.08)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Music size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h4
              style={{
                fontSize: '0.95rem',
                fontWeight: 700,
                color: 'var(--primary)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {song.title}
            </h4>
            {song.composer && (
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--muted)',
                  margin: '2px 0 0 0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {song.composer}
              </p>
            )}
          </div>
        </div>

        {/* Right side info: Badges & Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--primary)',
                    background: 'rgba(30,58,138,0.08)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(30,58,138,0.12)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {tags.length > 2 && (
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', alignSelf: 'center' }}>
                  +{tags.length - 2}
                </span>
              )}
            </div>
          )}

          {song.lyrics && (
            <span
              title="ChordPro lyrics available"
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--accent)',
                background: 'rgba(217,119,6,0.08)',
                padding: '2px 8px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              Chords
            </span>
          )}

          <ChevronRight size={18} style={{ color: 'var(--muted)' }} />
        </div>
      </Link>
    );
  };

  // Group songs alphabetically for A-Z Songbook Index Mode
  const alphabetMap: Record<string, Song[]> = {};
  if (viewMode === 'AZ_INDEX') {
    const sorted = [...filteredSongs].sort((a, b) => a.title.localeCompare(b.title));
    sorted.forEach((song) => {
      const letter = song.title.charAt(0).toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!alphabetMap[key]) alphabetMap[key] = [];
      alphabetMap[key].push(song);
    });
  }

  // Filter sections by active tab
  const displaySections = activeTab === 'ALL'
    ? MASS_PART_SECTIONS
    : MASS_PART_SECTIONS.filter((p) => p.id === activeTab);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, padding: '24px 16px 40px', maxWidth: '1040px', margin: '0 auto', width: '100%' }}>
        {/* Header & Songbook Title */}
        <div className="anim-header" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <BookOpen size={22} style={{ color: 'var(--primary)' }} />
              <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                Choir Songbook Repertoire
              </h1>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: 0 }}>
              Flip directly to any Mass Part page or browse the A-Z Index without endless scrolling.
            </p>
          </div>

          {/* View Mode Toggle: Mass Parts vs A-Z Hymnal Index */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.06)', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => { setViewMode('MASS_PARTS'); setActiveTab('ALL'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'MASS_PARTS' ? '#ffffff' : 'transparent',
                color: viewMode === 'MASS_PARTS' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: viewMode === 'MASS_PARTS' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers size={15} />
              Mass Parts View
            </button>
            <button
              onClick={() => setViewMode('AZ_INDEX')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'AZ_INDEX' ? '#ffffff' : 'transparent',
                color: viewMode === 'AZ_INDEX' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: viewMode === 'AZ_INDEX' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <SortAsc size={15} />
              A-Z Hymnal Index
            </button>
          </div>
        </div>

        {/* Search Bar & Category Dropdown */}
        <div className="anim-header" style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '260px' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}
            />
            <input
              ref={searchInputRef}
              type="text"
              className="input-field"
              placeholder="Search title, composer, or lyrics… (/)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ paddingLeft: '40px', paddingRight: searchValue ? '40px' : '16px', width: '100%', minHeight: '44px', fontSize: '0.9rem' }}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div style={{ position: 'relative', flex: '0 0 auto', minWidth: '200px' }}>
            <select
              className="input-field"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Repertoire Categories ({songs.length})</option>
              <optgroup label="Mass Parts">
                {MASS_PART_SECTIONS.map((part) => (
                  <option key={part.id} value={part.name}>
                    {part.name}
                  </option>
                ))}
              </optgroup>
              {availableCategories.length > 0 && (
                <optgroup label="Other Tags">
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.song_count ?? 0})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Quick Collapse / Expand All Buttons */}
          {viewMode === 'MASS_PARTS' && activeTab === 'ALL' && !isSearching && (
            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              <button
                onClick={collapseAllSections}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  background: 'rgba(0,0,0,0.05)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Collapse All
              </button>
              <button
                onClick={expandAllSections}
                style={{
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  background: 'rgba(0,0,0,0.05)',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Expand All
              </button>
            </div>
          )}
        </div>

        {/* 📖 SONGBOOK MASS PART INDEX TABS (Page-by-Page Songbook Strip) */}
        {viewMode === 'MASS_PARTS' && !isSearching && (
          <div
            className="anim-header"
            style={{
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '8px',
              scrollbarWidth: 'thin',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <button
              onClick={() => setActiveTab('ALL')}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 700,
                border: activeTab === 'ALL' ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.1)',
                background: activeTab === 'ALL' ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                color: activeTab === 'ALL' ? '#ffffff' : 'var(--foreground)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: activeTab === 'ALL' ? '0 2px 8px rgba(30,58,138,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              All Pages ({filteredSongs.length})
            </button>

            {MASS_PART_SECTIONS.map((part) => {
              const count = filteredSongs.filter((s) => matchesMassPart(s, part.name, part.matchKeywords)).length;
              const isActive = activeTab === part.id;
              return (
                <button
                  key={part.id}
                  onClick={() => setActiveTab(part.id)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: isActive ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.08)',
                    background: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                    color: isActive ? '#ffffff' : 'var(--foreground)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    boxShadow: isActive ? '0 2px 8px rgba(30,58,138,0.25)' : 'none',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{part.name}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(30,58,138,0.08)',
                      color: isActive ? '#ffffff' : 'var(--primary)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            {otherSongs.length > 0 && (
              <button
                onClick={() => setActiveTab('other-songs')}
                style={{
                  padding: '8px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: activeTab === 'other-songs' ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.08)',
                  background: activeTab === 'other-songs' ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                  color: activeTab === 'other-songs' ? '#ffffff' : 'var(--foreground)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Other Repertoire</span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: activeTab === 'other-songs' ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                    color: activeTab === 'other-songs' ? '#ffffff' : 'var(--muted)',
                  }}
                >
                  {otherSongs.length}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Results Counter Banner when searching */}
        {isSearching && (
          <div style={{ marginBottom: '16px', fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
            Found {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'} matching "{searchValue.trim()}"
          </div>
        )}

        {/* Repertoire Content: Empty State */}
        {filteredSongs.length === 0 ? (
          <div className="glass-container anim-section" style={{ textAlign: 'center', padding: '50px 20px' }}>
            <Music size={42} style={{ margin: '0 auto 12px', color: 'var(--muted)' }} />
            <p style={{ color: 'var(--muted)', fontSize: '1rem', margin: 0 }}>
              {searchValue || selectedCategoryFilter !== 'ALL'
                ? 'No songs match your search query or selected category filter.'
                : 'No songs in the repertoire yet.'}
            </p>
            {isAdmin && !searchValue && (
              <Link href="/admin/songs" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-block' }}>
                Add the first song
              </Link>
            )}
          </div>
        ) : viewMode === 'AZ_INDEX' ? (
          /* 🔤 ALPHABETICAL A-Z HYMNAL INDEX VIEW */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {Object.keys(alphabetMap).sort().map((letter) => {
              const letterSongs = alphabetMap[letter];
              return (
                <div
                  key={letter}
                  className="glass-container anim-section"
                  style={{
                    borderRadius: '14px',
                    overflow: 'hidden',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 18px',
                      background: 'rgba(30,58,138,0.06)',
                      borderBottom: '1px solid var(--glass-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {letter}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
                      {letterSongs.length} {letterSongs.length === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                  <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.25)' }}>
                    {letterSongs.map((song) => renderSongRow(song))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 📖 LITURGICAL MASS PARTS VIEW (Page-by-Page / Accordion) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {displaySections.map((part) => {
              const partSongs = filteredSongs.filter((s) => matchesMassPart(s, part.name, part.matchKeywords));

              // If searching, hide sections with 0 matches
              if (isSearching && partSongs.length === 0) return null;

              const isCollapsed = isSearching ? false : !!collapsedSections[part.id];

              return (
                <div
                  key={part.id}
                  id={`part-${part.id}`}
                  className="glass-container anim-section"
                  style={{
                    borderRadius: '14px',
                    overflow: 'hidden',
                    border: '1px solid var(--glass-border)',
                    boxShadow: 'var(--card-shadow)',
                  }}
                >
                  {/* Section Header */}
                  <div
                    onClick={() => toggleSection(part.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.75)',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <BookOpen size={18} style={{ color: 'var(--primary)' }} />
                      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                        {part.name}
                      </h2>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: partSongs.length > 0 ? 'rgba(30,58,138,0.1)' : 'rgba(0,0,0,0.05)',
                          color: partSongs.length > 0 ? 'var(--primary)' : 'var(--muted)',
                          padding: '2px 10px',
                          borderRadius: '12px',
                        }}
                      >
                        {partSongs.length} {partSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      {isCollapsed ? <ChevronDown size={18} style={{ color: 'var(--muted)' }} /> : <ChevronUp size={18} style={{ color: 'var(--muted)' }} />}
                    </div>
                  </div>

                  {/* Section Songs List */}
                  {!isCollapsed && (
                    <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.25)' }}>
                      {partSongs.length > 0 ? (
                        partSongs.map((song) => renderSongRow(song))
                      ) : (
                        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, fontStyle: 'italic', padding: '4px 0' }}>
                          No songs tagged for {part.name} yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Other Repertoire Songs Section */}
            {(activeTab === 'ALL' || activeTab === 'other-songs') && otherSongs.length > 0 && (
              <div
                className="glass-container anim-section"
                style={{
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid var(--glass-border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div
                  onClick={() => toggleSection('other-songs')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.75)',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Music size={18} style={{ color: 'var(--foreground)' }} />
                    <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                      Other Repertoire Songs
                    </h2>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        background: 'rgba(0,0,0,0.05)',
                        color: 'var(--muted)',
                        padding: '2px 10px',
                        borderRadius: '12px',
                      }}
                    >
                      {otherSongs.length} {otherSongs.length === 1 ? 'song' : 'songs'}
                    </span>
                    {collapsedSections['other-songs'] ? <ChevronDown size={18} style={{ color: 'var(--muted)' }} /> : <ChevronUp size={18} style={{ color: 'var(--muted)' }} />}
                  </div>
                </div>

                {!collapsedSections['other-songs'] && (
                  <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.25)' }}>
                    {otherSongs.map((song) => renderSongRow(song))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default RepertoireClient;
