'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SongCategory } from '@/app/admin/songs/SongForm';
import { CategoryItem } from '@/app/admin/categories/actions';
import { Music, Search, ChevronRight, ChevronDown, ChevronUp, X, BookOpen, SortAsc, Layers, ListFilter, Filter } from 'lucide-react';
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
  { id: 'offertory-presentation', name: 'Offertory / Presentation Song', matchKeywords: ['offertory / presentation song', 'offertory / presentation', 'offertory', 'presentation song', 'offertory song'] },
  { id: 'sanctus', name: 'Sanctus', matchKeywords: ['sanctus', 'holy, holy, holy', 'holy holy holy'] },
  { id: 'memorial-acclamation', name: 'Memorial Acclamation', matchKeywords: ['memorial acclamation'] },
  { id: 'great-amen', name: 'Great Amen', matchKeywords: ['great amen', 'amen'] },
  { id: 'lords-prayer', name: "Lord's Prayer", matchKeywords: ["lord's prayer", 'lords prayer', 'our father'] },
  { id: 'lamb-of-god', name: 'Lamb of God', matchKeywords: ['lamb of god', 'agnus dei'] },
  { id: 'communion-song', name: 'Communion Song', matchKeywords: ['communion song', 'communion'] },
  { id: 'recessional-closing', name: 'Recessional / Closing Song', matchKeywords: ['recessional / closing song', 'recessional / closing', 'recessional', 'closing song', 'sending forth'] },
];

const matchesMassPart = (song: Song, targetName: string, keywords: string[]): boolean => {
  const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
  if (song.category) songCatNames.push(song.category.toLowerCase());

  const targetLower = targetName.toLowerCase();

  return songCatNames.some((cat) => {
    if (cat === targetLower || cat.includes(targetLower) || targetLower.includes(cat)) return true;
    return keywords.some((kw) => cat.includes(kw) || kw.includes(cat));
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

  // Initial Category & Tab State
  const initialCategory = categoriesParam || 'ALL';
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(initialCategory);

  // Helper functions for 2-way synchronization between Tabs and Dropdown
  const getTabIdFromCategory = (catName: string): string => {
    if (!catName || catName === 'ALL') return 'ALL';
    const found = MASS_PART_SECTIONS.find((p) => p.name.toLowerCase() === catName.toLowerCase());
    return found ? found.id : 'ALL';
  };

  const getCategoryNameFromTabId = (tabId: string): string => {
    if (!tabId || tabId === 'ALL' || tabId === 'other-songs') return 'ALL';
    const found = MASS_PART_SECTIONS.find((p) => p.id === tabId);
    return found ? found.name : 'ALL';
  };

  // Songbook Display Mode: 'MASS_PARTS' (Grouped by Mass Parts) vs 'AZ_INDEX' (Alphabetical Songbook Index)
  const [viewMode, setViewMode] = useState<'MASS_PARTS' | 'AZ_INDEX'>('MASS_PARTS');

  // Selected Mass Part Page Tab ('ALL' or section id like 'communion-song')
  const [activeTab, setActiveTab] = useState<string>(() => getTabIdFromCategory(initialCategory));

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const [isPending, startTransition] = useTransition();

  // 2-Way Synchronized Handler: Tapping a Tab pill updates Dropdown value
  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    const catName = getCategoryNameFromTabId(tabId);
    setSelectedCategoryFilter(catName);
  };

  // 2-Way Synchronized Handler: Selecting a Dropdown option updates Tab pill
  const handleSelectDropdownCategory = (val: string) => {
    setSelectedCategoryFilter(val);
    const tabId = getTabIdFromCategory(val);
    setActiveTab(tabId);
  };

  // Filter popover state
  const [openFilterCardId, setOpenFilterCardId] = useState<string | null>(null);

  // Multi-select category tags state (array of active tag names)
  const [selectedCategoryTags, setSelectedCategoryTags] = useState<string[]>([]);

  // Card-level pagination state: mapping card section ID to current page (1-indexed, 5 items per page)
  const [cardPages, setCardPages] = useState<Record<string, number>>({});

  useEffect(() => {
    setCardPages({});
  }, [searchValue, selectedCategoryTags, selectedCategoryFilter, activeTab]);

  const getCardPage = (cardId: string): number => cardPages[cardId] || 1;
  const setCardPage = (cardId: string, page: number) => {
    setCardPages((prev) => ({ ...prev, [cardId]: page }));
  };

  // Helper to check if a category name corresponds to a Mass Part section
  const isMassPartName = (name: string): boolean => {
    const n = name.toLowerCase();
    return MASS_PART_SECTIONS.some(
      (part) => part.name.toLowerCase() === n || part.id === n || part.matchKeywords.includes(n)
    );
  };

  // Collect all non-Mass Part category tag names across all songs and availableCategories
  const tagCategoryNames = Array.from(
    new Set([
      ...availableCategories.map((c) => c.name),
      ...songs.flatMap((s) => [
        ...(s.categories || []).map((c) => c.name),
        ...(s.category ? [s.category] : []),
      ]),
    ])
  ).filter((name): name is string => Boolean(name) && !isMassPartName(name));

  const toggleCategoryTag = (tagName: string) => {
    setSelectedCategoryTags((prev) =>
      prev.includes(tagName)
        ? prev.filter((t) => t !== tagName)
        : [...prev, tagName]
    );
  };

  const clearCategoryTags = () => {
    setSelectedCategoryTags([]);
  };

  const songMatchesSelectedTags = (song: Song, selectedTags: string[]): boolean => {
    if (selectedTags.length === 0) return true;
    const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
    if (song.category) songCatNames.push(song.category.toLowerCase());

    return selectedTags.some((tag) =>
      songCatNames.some((cat) => cat === tag.toLowerCase() || cat.includes(tag.toLowerCase()) || tag.toLowerCase().includes(cat))
    );
  };

  // 2-Way Synchronized Handler: Clear all filters
  const handleClearAllFilters = () => {
    setSearchValue('');
    setSelectedCategoryFilter('ALL');
    setActiveTab('ALL');
    setSelectedCategoryTags([]);
  };

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
      const massPart = MASS_PART_SECTIONS.find(
        (p) => p.name.toLowerCase() === selectedCategoryFilter.toLowerCase() || p.id === selectedCategoryFilter
      );

      if (massPart) {
        if (!matchesMassPart(song, massPart.name, massPart.matchKeywords)) return false;
      } else {
        const songCatIds = (song.categories || []).map((c) => c.id);
        const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
        if (song.category) songCatNames.push(song.category.toLowerCase());

        const targetLower = selectedCategoryFilter.toLowerCase();
        const matchById = songCatIds.includes(selectedCategoryFilter);
        const matchByName = songCatNames.some((cat) => cat === targetLower || cat.includes(targetLower) || targetLower.includes(cat));

        if (!matchById && !matchByName) return false;
      }
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(30,58,138,0.08)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            <Music size={17} />
          </div>
          
          {/* Main Title & Meta Sub-row */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <h4
              style={{
                fontSize: '0.96rem',
                fontWeight: 700,
                color: 'var(--primary)',
                margin: 0,
                lineHeight: 1.35,
                wordBreak: 'break-word',
              }}
            >
              {song.title}
            </h4>

            {/* Sub-row: Composer & Category Badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {song.composer && (
                <span
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--muted)',
                    fontWeight: 500,
                    marginRight: '4px',
                  }}
                >
                  {song.composer}
                </span>
              )}

              {tags.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        color: 'var(--primary)',
                        background: 'rgba(30,58,138,0.08)',
                        padding: '1px 7px',
                        borderRadius: '10px',
                        border: '1px solid rgba(30,58,138,0.12)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {tags.length > 3 && (
                    <span style={{ fontSize: '0.66rem', color: 'var(--muted)', fontWeight: 600 }}>
                      +{tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {song.lyrics && (
                <span
                  title="ChordPro lyrics available"
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    background: 'rgba(217,119,6,0.08)',
                    padding: '1px 7px',
                    borderRadius: '10px',
                    border: '1px solid rgba(217,119,6,0.15)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Chords
                </span>
              )}
            </div>
          </div>
        </div>

        <ChevronRight size={18} style={{ color: 'var(--muted)', flexShrink: 0, alignSelf: 'center' }} />
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
          </div>          {/* Category Dropdown (Mass Parts Only) */}
          <div style={{ position: 'relative', flex: '0 0 auto', minWidth: '220px' }}>
            <select
              className="input-field"
              value={selectedCategoryFilter}
              onChange={(e) => handleSelectDropdownCategory(e.target.value)}
              style={{
                width: '100%',
                minHeight: '44px',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--foreground)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Mass Parts ({songs.length} songs)</option>
              {MASS_PART_SECTIONS.map((part) => (
                <option key={part.id} value={part.name}>
                  {part.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button if active */}
          {(searchValue || selectedCategoryFilter !== 'ALL' || selectedCategoryTags.length > 0) && (
            <button
              onClick={handleClearAllFilters}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--muted)',
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                minHeight: '44px',
                cursor: 'pointer',
              }}
            >
              Clear Filter
            </button>
          )}

          {/* Quick Collapse / Expand All Buttons */}
          {viewMode === 'MASS_PARTS' && selectedCategoryFilter === 'ALL' && !isSearching && (
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

              // Collect all unique category tags for songs in this section
              const sectionCategoryTags = Array.from(
                new Set(
                  partSongs.flatMap((s) => [
                    ...(s.categories || []).map((c) => c.name),
                    ...(s.category ? [s.category] : []),
                  ])
                )
              );

              // Filter songs by multi-select category tags
              const tagFilteredPartSongs = partSongs.filter((s) => songMatchesSelectedTags(s, selectedCategoryTags));
              const ITEMS_PER_PAGE = 5;
              const totalPartSongs = tagFilteredPartSongs.length;
              const totalPartPages = Math.ceil(totalPartSongs / ITEMS_PER_PAGE) || 1;
              const currentPartPage = Math.min(getCardPage(part.id), totalPartPages);
              const paginatedPartSongs = tagFilteredPartSongs.slice(
                (currentPartPage - 1) * ITEMS_PER_PAGE,
                currentPartPage * ITEMS_PER_PAGE
              );

              return (
                <div
                  key={part.id}
                  id={`part-${part.id}`}
                  className="glass-container anim-section"
                  style={{
                    borderRadius: '14px',
                    overflow: 'visible',
                    position: 'relative',
                    zIndex: openFilterCardId === part.id ? 100 : 1,
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
                      borderRadius: isCollapsed ? '14px' : '14px 14px 0 0',
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
                          background: tagFilteredPartSongs.length > 0 ? 'rgba(30,58,138,0.1)' : 'rgba(0,0,0,0.05)',
                          color: tagFilteredPartSongs.length > 0 ? 'var(--primary)' : 'var(--muted)',
                          padding: '2px 10px',
                          borderRadius: '12px',
                        }}
                      >
                        {tagFilteredPartSongs.length} {tagFilteredPartSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      {isCollapsed ? <ChevronDown size={18} style={{ color: 'var(--muted)' }} /> : <ChevronUp size={18} style={{ color: 'var(--muted)' }} />}
                    </div>
                  </div>

                  {/* Section Songs List & Category Tags with Filter Funnel Button */}
                  {!isCollapsed && (
                    <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.25)', borderRadius: '0 0 14px 14px' }}>
                      {/* Category Tags Line with Funnel Filter Button (Rendered on ALL Mass Part Cards) */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            CATEGORY TAGS:
                          </span>
                          {sectionCategoryTags.length > 0 ? (
                            sectionCategoryTags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  background: 'rgba(30,58,138,0.06)',
                                  color: 'var(--primary)',
                                  letterSpacing: '0.02em',
                                  cursor: 'default',
                                  userSelect: 'none',
                                }}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'var(--muted)' }}>None</span>
                          )}
                        </div>

                        {/* Funnel Filter Button on ALL Mass Part Cards */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFilterCardId((prev) => (prev === part.id ? null : part.id));
                            }}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: selectedCategoryTags.length > 0 ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.12)',
                              background: selectedCategoryTags.length > 0 ? 'rgba(30,58,138,0.1)' : '#ffffff',
                              color: selectedCategoryTags.length > 0 ? 'var(--primary)' : 'var(--foreground)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                            title="Filter card by multiple category tags"
                          >
                            <Filter size={13} style={{ color: selectedCategoryTags.length > 0 ? 'var(--primary)' : 'var(--muted)' }} />
                            <span>Filter</span>
                            {selectedCategoryTags.length > 0 && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'var(--primary)', color: '#ffffff', padding: '0 5px', borderRadius: '8px' }}>
                                {selectedCategoryTags.length}
                              </span>
                            )}
                          </button>

                          {/* Multi-Select Category Tags Popover inside Card listing ALL System Categories */}
                          {openFilterCardId === part.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                right: 0,
                                zIndex: 9999,
                                width: '230px',
                                background: '#ffffff',
                                borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.12)',
                                boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '4px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>Filter Categories</span>
                                {selectedCategoryTags.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={clearCategoryTags}
                                    style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '180px', overflowY: 'auto' }}>
                                {tagCategoryNames.length > 0 ? (
                                  tagCategoryNames.map((catName) => {
                                    const isChecked = selectedCategoryTags.includes(catName);
                                    return (
                                      <label
                                        key={catName}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          fontSize: '0.78rem',
                                          fontWeight: 500,
                                          color: 'var(--foreground)',
                                          cursor: 'pointer',
                                          padding: '3px 6px',
                                          borderRadius: '6px',
                                          userSelect: 'none',
                                          background: isChecked ? 'rgba(30,58,138,0.06)' : 'transparent',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleCategoryTag(catName)}
                                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                                        />
                                        <span>{catName}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', padding: '4px 6px' }}>
                                    No non-Mass Part category tags created yet.
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {paginatedPartSongs.length > 0 ? (
                        <>
                          {paginatedPartSongs.map((song) => renderSongRow(song))}

                          {/* Card Pagination Bar */}
                          {totalPartPages > 1 && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: '8px',
                                paddingTop: '10px',
                                borderTop: '1px solid rgba(0,0,0,0.06)',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                                Showing {(currentPartPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPartPage * ITEMS_PER_PAGE, totalPartSongs)} of {totalPartSongs}
                              </span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  disabled={currentPartPage <= 1}
                                  onClick={() => setCardPage(part.id, currentPartPage - 1)}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    border: '1px solid rgba(0,0,0,0.12)',
                                    background: currentPartPage <= 1 ? 'rgba(0,0,0,0.03)' : '#ffffff',
                                    color: currentPartPage <= 1 ? 'var(--muted)' : 'var(--foreground)',
                                    cursor: currentPartPage <= 1 ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Prev
                                </button>

                                {Array.from({ length: totalPartPages }, (_, i) => i + 1).map((pageNum) => (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => setCardPage(part.id, pageNum)}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '8px',
                                      fontSize: '0.75rem',
                                      fontWeight: pageNum === currentPartPage ? 700 : 500,
                                      border: pageNum === currentPartPage ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.12)',
                                      background: pageNum === currentPartPage ? 'var(--primary)' : '#ffffff',
                                      color: pageNum === currentPartPage ? '#ffffff' : 'var(--foreground)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {pageNum}
                                  </button>
                                ))}

                                <button
                                  type="button"
                                  disabled={currentPartPage >= totalPartPages}
                                  onClick={() => setCardPage(part.id, currentPartPage + 1)}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    border: '1px solid rgba(0,0,0,0.12)',
                                    background: currentPartPage >= totalPartPages ? 'rgba(0,0,0,0.03)' : '#ffffff',
                                    color: currentPartPage >= totalPartPages ? 'var(--muted)' : 'var(--foreground)',
                                    cursor: currentPartPage >= totalPartPages ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, fontStyle: 'italic', padding: '4px 0' }}>
                          No songs match the selected tag filter.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Other Repertoire Songs Section */}
            {(activeTab === 'ALL' || activeTab === 'other-songs') && otherSongs.length > 0 && (() => {
              const otherCategoryTags = Array.from(
                new Set(
                  otherSongs.flatMap((s) => [
                    ...(s.categories || []).map((c) => c.name),
                    ...(s.category ? [s.category] : []),
                  ])
                )
              );
              const tagFilteredOtherSongs = otherSongs.filter((s) => songMatchesSelectedTags(s, selectedCategoryTags));
              const ITEMS_PER_PAGE = 5;
              const totalOtherSongs = tagFilteredOtherSongs.length;
              const totalOtherPages = Math.ceil(totalOtherSongs / ITEMS_PER_PAGE) || 1;
              const currentOtherPage = Math.min(getCardPage('other-songs'), totalOtherPages);
              const paginatedOtherSongs = tagFilteredOtherSongs.slice(
                (currentOtherPage - 1) * ITEMS_PER_PAGE,
                currentOtherPage * ITEMS_PER_PAGE
              );
              const isCollapsed = !!collapsedSections['other-songs'];

              return (
                <div
                  className="glass-container anim-section"
                  style={{
                    borderRadius: '14px',
                    overflow: 'visible',
                    position: 'relative',
                    zIndex: openFilterCardId === 'other-songs' ? 100 : 1,
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
                      borderRadius: isCollapsed ? '14px' : '14px 14px 0 0',
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
                          background: tagFilteredOtherSongs.length > 0 ? 'rgba(30,58,138,0.1)' : 'rgba(0,0,0,0.05)',
                          color: tagFilteredOtherSongs.length > 0 ? 'var(--primary)' : 'var(--muted)',
                          padding: '2px 10px',
                          borderRadius: '12px',
                        }}
                      >
                        {tagFilteredOtherSongs.length} {tagFilteredOtherSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      {isCollapsed ? <ChevronDown size={18} style={{ color: 'var(--muted)' }} /> : <ChevronUp size={18} style={{ color: 'var(--muted)' }} />}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.25)', borderRadius: '0 0 14px 14px' }}>
                      {/* Category Tags Line with Funnel Filter Button */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px', paddingBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            CATEGORY TAGS:
                          </span>
                          {otherCategoryTags.length > 0 ? (
                            otherCategoryTags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  background: 'rgba(30,58,138,0.06)',
                                  color: 'var(--primary)',
                                  letterSpacing: '0.02em',
                                  cursor: 'default',
                                  userSelect: 'none',
                                }}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.72rem', fontStyle: 'italic', color: 'var(--muted)' }}>None</span>
                          )}
                        </div>

                        {/* Funnel Filter Button inside Card */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFilterCardId((prev) => (prev === 'other-songs' ? null : 'other-songs'));
                            }}
                            style={{
                              padding: '3px 10px',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              border: selectedCategoryTags.length > 0 ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.12)',
                              background: selectedCategoryTags.length > 0 ? 'rgba(30,58,138,0.1)' : '#ffffff',
                              color: selectedCategoryTags.length > 0 ? 'var(--primary)' : 'var(--foreground)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }}
                            title="Filter card by multiple category tags"
                          >
                            <Filter size={13} style={{ color: selectedCategoryTags.length > 0 ? 'var(--primary)' : 'var(--muted)' }} />
                            <span>Filter</span>
                            {selectedCategoryTags.length > 0 && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, background: 'var(--primary)', color: '#ffffff', padding: '0 5px', borderRadius: '8px' }}>
                                {selectedCategoryTags.length}
                              </span>
                            )}
                          </button>

                          {/* Multi-Select Category Tags Popover */}
                          {openFilterCardId === 'other-songs' && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                right: 0,
                                zIndex: 9999,
                                width: '230px',
                                background: '#ffffff',
                                borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.12)',
                                boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                                padding: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '4px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>Filter Categories</span>
                                {selectedCategoryTags.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={clearCategoryTags}
                                    style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '180px', overflowY: 'auto' }}>
                                {tagCategoryNames.length > 0 ? (
                                  tagCategoryNames.map((catName) => {
                                    const isChecked = selectedCategoryTags.includes(catName);
                                    return (
                                      <label
                                        key={catName}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          fontSize: '0.78rem',
                                          fontWeight: 500,
                                          color: 'var(--foreground)',
                                          cursor: 'pointer',
                                          padding: '3px 6px',
                                          borderRadius: '6px',
                                          userSelect: 'none',
                                          background: isChecked ? 'rgba(30,58,138,0.06)' : 'transparent',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleCategoryTag(catName)}
                                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                                        />
                                        <span>{catName}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic', padding: '4px 6px' }}>
                                    No non-Mass Part category tags created yet.
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {paginatedOtherSongs.length > 0 ? (
                        <>
                          {paginatedOtherSongs.map((song) => renderSongRow(song))}

                          {/* Card Pagination Bar */}
                          {totalOtherPages > 1 && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginTop: '8px',
                                paddingTop: '10px',
                                borderTop: '1px solid rgba(0,0,0,0.06)',
                                gap: '8px',
                                flexWrap: 'wrap',
                              }}
                            >
                              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 600 }}>
                                Showing {(currentOtherPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentOtherPage * ITEMS_PER_PAGE, totalOtherSongs)} of {totalOtherSongs}
                              </span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <button
                                  type="button"
                                  disabled={currentOtherPage <= 1}
                                  onClick={() => setCardPage('other-songs', currentOtherPage - 1)}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    border: '1px solid rgba(0,0,0,0.12)',
                                    background: currentOtherPage <= 1 ? 'rgba(0,0,0,0.03)' : '#ffffff',
                                    color: currentOtherPage <= 1 ? 'var(--muted)' : 'var(--foreground)',
                                    cursor: currentOtherPage <= 1 ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Prev
                                </button>

                                {Array.from({ length: totalOtherPages }, (_, i) => i + 1).map((pageNum) => (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => setCardPage('other-songs', pageNum)}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '8px',
                                      fontSize: '0.75rem',
                                      fontWeight: pageNum === currentOtherPage ? 700 : 500,
                                      border: pageNum === currentOtherPage ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.12)',
                                      background: pageNum === currentOtherPage ? 'var(--primary)' : '#ffffff',
                                      color: pageNum === currentOtherPage ? '#ffffff' : 'var(--foreground)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {pageNum}
                                  </button>
                                ))}

                                <button
                                  type="button"
                                  disabled={currentOtherPage >= totalOtherPages}
                                  onClick={() => setCardPage('other-songs', currentOtherPage + 1)}
                                  style={{
                                    padding: '3px 10px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    border: '1px solid rgba(0,0,0,0.12)',
                                    background: currentOtherPage >= totalOtherPages ? 'rgba(0,0,0,0.03)' : '#ffffff',
                                    color: currentOtherPage >= totalOtherPages ? 'var(--muted)' : 'var(--foreground)',
                                    cursor: currentOtherPage >= totalOtherPages ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: 0, fontStyle: 'italic', padding: '4px 0' }}>
                          No songs match the selected tag filter.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </main>
    </div>
  );
};

export default RepertoireClient;
