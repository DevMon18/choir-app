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
import { useRepertoire } from '@/hooks/useRepertoire';

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
  const { allSongs: songs } = useRepertoire({
    initialSongs,
  });
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
        className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/90 border border-glass-border text-inherit no-underline min-h-[52px] gap-3 transition-all hover:bg-white hover:shadow-card hover:border-primary/20"
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/8 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
            <Music size={17} />
          </div>
          
          {/* Main Title & Meta Sub-row */}
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h4 className="text-[0.96rem] font-bold text-primary m-0 leading-snug break-words">
              {song.title}
            </h4>

            {/* Sub-row: Composer & Category Badges */}
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {song.composer && (
                <span className="text-xs text-muted font-medium mr-1">
                  {song.composer}
                </span>
              )}

              {tags.length > 0 && (
                <div className="flex gap-1 flex-wrap items-center">
                  {tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag.id}
                      className="text-[0.66rem] font-bold uppercase tracking-wider text-primary bg-primary/8 py-0.5 px-2 rounded-full border border-primary/12 whitespace-nowrap"
                    >
                      {tag.name}
                    </span>
                  ))}
                  {tags.length > 3 && (
                    <span className="text-[0.66rem] text-muted font-semibold">
                      +{tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              {song.lyrics && (
                <span
                  title="ChordPro lyrics available"
                  className="text-[0.66rem] font-bold text-accent bg-accent/8 py-0.5 px-2 rounded-full border border-accent/15 inline-flex items-center gap-0.5 whitespace-nowrap"
                >
                  Chords
                </span>
              )}
            </div>
          </div>
        </div>

        <ChevronRight size={18} className="text-muted flex-shrink-0 self-center" />
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
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-6 px-4 pb-10 max-w-[1040px] mx-auto w-full">
        {/* Header & Songbook Title */}
        <div className="anim-header mb-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={22} className="text-primary" />
              <h1 className="text-2xl sm:text-[1.8rem] font-bold text-primary m-0">
                Choir Songbook Repertoire
              </h1>
            </div>
            <p className="text-muted text-sm m-0">
              Flip directly to any Mass Part page or browse the A-Z Index without endless scrolling.
            </p>
          </div>

          {/* View Mode Toggle: Mass Parts vs A-Z Hymnal Index */}
          <div className="flex gap-1.5 bg-black/6 p-1 rounded-xl">
            <button
              onClick={() => { setViewMode('MASS_PARTS'); setActiveTab('ALL'); }}
              className={`flex items-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                viewMode === 'MASS_PARTS' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted'
              }`}
            >
              <Layers size={15} />
              Mass Parts View
            </button>
            <button
              onClick={() => setViewMode('AZ_INDEX')}
              className={`flex items-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                viewMode === 'AZ_INDEX' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted'
              }`}
            >
              <SortAsc size={15} />
              A-Z Hymnal Index
            </button>
          </div>
        </div>

        {/* Search Bar & Category Dropdown */}
        <div className="anim-header mb-5 flex flex-wrap gap-3 items-center">
          {/* Search Input */}
          <div className="relative flex-[1_1_280px] min-w-[260px]">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              className="input-field pl-10 pr-10 w-full min-h-[44px] text-sm"
              placeholder="Search title, composer, or lyrics… (/)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-muted cursor-pointer p-1 flex items-center justify-center"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Dropdown (Mass Parts Only) */}
          <div className="relative flex-none min-w-[220px]">
            <select
              className="input-field w-full min-h-[44px] text-sm font-semibold text-foreground cursor-pointer"
              value={selectedCategoryFilter}
              onChange={(e) => handleSelectDropdownCategory(e.target.value)}
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
              className="py-2 px-3.5 rounded-xl text-xs font-semibold text-muted bg-black/5 border-0 min-h-[44px] cursor-pointer hover:bg-black/10"
            >
              Clear Filter
            </button>
          )}

          {/* Quick Collapse / Expand All Buttons */}
          {viewMode === 'MASS_PARTS' && selectedCategoryFilter === 'ALL' && !isSearching && (
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={collapseAllSections}
                className="py-2 px-3 rounded-xl text-xs font-semibold text-muted bg-black/5 border-0 cursor-pointer whitespace-nowrap hover:bg-black/10"
              >
                Collapse All
              </button>
              <button
                onClick={expandAllSections}
                className="py-2 px-3 rounded-xl text-xs font-semibold text-muted bg-black/5 border-0 cursor-pointer whitespace-nowrap hover:bg-black/10"
              >
                Expand All
              </button>
            </div>
          )}
        </div>

        {/* Results Counter Banner when searching */}
        {isSearching && (
          <div className="mb-4 text-sm text-muted font-semibold">
            Found {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'} matching "{searchValue.trim()}"
          </div>
        )}

        {/* Repertoire Content: Empty State */}
        {filteredSongs.length === 0 ? (
          <div className="glass-container anim-section text-center py-12 px-5">
            <Music size={42} className="mx-auto mb-3 text-muted" />
            <p className="text-muted text-base m-0">
              {searchValue || selectedCategoryFilter !== 'ALL'
                ? 'No songs match your search query or selected category filter.'
                : 'No songs in the repertoire yet.'}
            </p>
            {isAdmin && !searchValue && (
              <Link href="/admin/songs" className="btn btn-primary mt-4 inline-block">
                Add the first song
              </Link>
            )}
          </div>
        ) : viewMode === 'AZ_INDEX' ? (
          /* 🔤 ALPHABETICAL A-Z HYMNAL INDEX VIEW */
          <div className="flex flex-col gap-5">
            {Object.keys(alphabetMap).sort().map((letter) => {
              const letterSongs = alphabetMap[letter];
              return (
                <div
                  key={letter}
                  className="glass-container anim-section rounded-xl overflow-hidden border border-glass-border shadow-card"
                >
                  <div className="py-2.5 px-4.5 bg-primary/6 border-b border-glass-border flex items-center justify-between">
                    <span className="text-lg font-extrabold text-primary">
                      {letter}
                    </span>
                    <span className="text-xs font-semibold text-muted">
                      {letterSongs.length} {letterSongs.length === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                  <div className="p-3 pb-4 flex flex-col gap-2 bg-white/25">
                    {letterSongs.map((song) => renderSongRow(song))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 📖 LITURGICAL MASS PARTS VIEW (Page-by-Page / Accordion) */
          <div className="flex flex-col gap-4">
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
                  className={`glass-container anim-section rounded-xl border border-glass-border shadow-card relative overflow-visible ${
                    openFilterCardId === part.id ? 'z-50' : 'z-0'
                  }`}
                >
                  {/* Section Header */}
                  <div
                    onClick={() => toggleSection(part.id)}
                    className={`flex items-center justify-between py-3.5 px-4.5 cursor-pointer bg-white/75 select-none transition-colors ${
                      isCollapsed ? 'rounded-xl' : 'rounded-t-xl'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen size={18} className="text-primary" />
                      <h2 className="text-base font-bold text-primary m-0">
                        {part.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-semibold py-0.5 px-2.5 rounded-full ${
                          tagFilteredPartSongs.length > 0 ? 'bg-primary/10 text-primary' : 'bg-black/5 text-muted'
                        }`}
                      >
                        {tagFilteredPartSongs.length} {tagFilteredPartSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      {isCollapsed ? <ChevronDown size={18} className="text-muted" /> : <ChevronUp size={18} className="text-muted" />}
                    </div>
                  </div>

                  {/* Section Songs List & Category Tags with Filter Funnel Button */}
                  {!isCollapsed && (
                    <div className="p-3 pb-4 flex flex-col gap-2 bg-white/25 rounded-b-xl">
                      {/* Category Tags Line with Funnel Filter Button (Rendered on ALL Mass Part Cards) */}
                      <div className="flex items-center justify-between gap-2 mb-1.5 pb-2 border-b border-black/6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[0.72rem] font-bold text-muted uppercase tracking-wider">
                            CATEGORY TAGS:
                          </span>
                          {sectionCategoryTags.length > 0 ? (
                            sectionCategoryTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[0.72rem] font-bold py-0.5 px-2 rounded-full bg-primary/6 text-primary tracking-wide cursor-default select-none"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-[0.72rem] italic text-muted">None</span>
                          )}
                        </div>

                        {/* Funnel Filter Button on ALL Mass Part Cards */}
                        <div className="relative flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFilterCardId((prev) => (prev === part.id ? null : part.id));
                            }}
                            className={`py-1 px-2.5 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-sm transition-all ${
                              selectedCategoryTags.length > 0
                                ? 'border border-primary bg-primary/10 text-primary'
                                : 'border border-black/12 bg-white text-foreground hover:bg-slate-50'
                            }`}
                            title="Filter card by multiple category tags"
                          >
                            <Filter size={13} className={selectedCategoryTags.length > 0 ? 'text-primary' : 'text-muted'} />
                            <span>Filter</span>
                            {selectedCategoryTags.length > 0 && (
                              <span className="text-[0.68rem] font-bold bg-primary text-white px-1.5 rounded-full">
                                {selectedCategoryTags.length}
                              </span>
                            )}
                          </button>

                          {/* Multi-Select Category Tags Popover inside Card listing ALL System Categories */}
                          {openFilterCardId === part.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-[calc(100%+6px)] right-0 z-50 w-56 bg-white rounded-xl border border-black/12 shadow-2xl p-2.5 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between border-b border-black/6 pb-1">
                                <span className="text-xs font-bold text-foreground">Filter Categories</span>
                                {selectedCategoryTags.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={clearCategoryTags}
                                    className="text-[0.7rem] font-semibold text-muted bg-transparent border-0 cursor-pointer hover:text-foreground"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
                                {tagCategoryNames.length > 0 ? (
                                  tagCategoryNames.map((catName) => {
                                    const isChecked = selectedCategoryTags.includes(catName);
                                    return (
                                      <label
                                        key={catName}
                                        className={`flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer py-1 px-1.5 rounded-md select-none transition-colors ${
                                          isChecked ? 'bg-primary/6' : 'hover:bg-slate-50'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleCategoryTag(catName)}
                                          className="accent-primary cursor-pointer"
                                        />
                                        <span>{catName}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted italic p-1">
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
                            <div className="flex items-center justify-between mt-2 pt-2.5 border-t border-black/6 gap-2 flex-wrap">
                              <span className="text-xs text-muted font-semibold">
                                Showing {(currentPartPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPartPage * ITEMS_PER_PAGE, totalPartSongs)} of {totalPartSongs}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={currentPartPage <= 1}
                                  onClick={() => setCardPage(part.id, currentPartPage - 1)}
                                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold border ${
                                    currentPartPage <= 1
                                      ? 'border-black/10 bg-black/3 text-muted cursor-not-allowed'
                                      : 'border-black/12 bg-white text-foreground cursor-pointer hover:bg-slate-50'
                                  }`}
                                >
                                  Prev
                                </button>

                                {Array.from({ length: totalPartPages }, (_, i) => i + 1).map((pageNum) => (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => setCardPage(part.id, pageNum)}
                                    className={`py-1 px-2 rounded-lg text-xs cursor-pointer ${
                                      pageNum === currentPartPage
                                        ? 'font-bold border border-primary bg-primary text-white'
                                        : 'font-medium border border-black/12 bg-white text-foreground hover:bg-slate-50'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                ))}

                                <button
                                  type="button"
                                  disabled={currentPartPage >= totalPartPages}
                                  onClick={() => setCardPage(part.id, currentPartPage + 1)}
                                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold border ${
                                    currentPartPage >= totalPartPages
                                      ? 'border-black/10 bg-black/3 text-muted cursor-not-allowed'
                                      : 'border-black/12 bg-white text-foreground cursor-pointer hover:bg-slate-50'
                                  }`}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted m-0 italic py-1">
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
                  className={`glass-container anim-section rounded-xl border border-glass-border shadow-card relative overflow-visible ${
                    openFilterCardId === 'other-songs' ? 'z-50' : 'z-0'
                  }`}
                >
                  <div
                    onClick={() => toggleSection('other-songs')}
                    className={`flex items-center justify-between py-3.5 px-4.5 cursor-pointer bg-white/75 select-none transition-colors ${
                      isCollapsed ? 'rounded-xl' : 'rounded-t-xl'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Music size={18} className="text-foreground" />
                      <h2 className="text-base font-bold text-foreground m-0">
                        Other Repertoire Songs
                      </h2>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`text-xs font-semibold py-0.5 px-2.5 rounded-full ${
                          tagFilteredOtherSongs.length > 0 ? 'bg-primary/10 text-primary' : 'bg-black/5 text-muted'
                        }`}
                      >
                        {tagFilteredOtherSongs.length} {tagFilteredOtherSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      {isCollapsed ? <ChevronDown size={18} className="text-muted" /> : <ChevronUp size={18} className="text-muted" />}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-3 pb-4 flex flex-col gap-2 bg-white/25 rounded-b-xl">
                      {/* Category Tags Line with Funnel Filter Button */}
                      <div className="flex items-center justify-between gap-2 mb-1.5 pb-2 border-b border-black/6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[0.72rem] font-bold text-muted uppercase tracking-wider">
                            CATEGORY TAGS:
                          </span>
                          {otherCategoryTags.length > 0 ? (
                            otherCategoryTags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[0.72rem] font-bold py-0.5 px-2 rounded-full bg-primary/6 text-primary tracking-wide cursor-default select-none"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-[0.72rem] italic text-muted">None</span>
                          )}
                        </div>

                        {/* Funnel Filter Button inside Card */}
                        <div className="relative flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFilterCardId((prev) => (prev === 'other-songs' ? null : 'other-songs'));
                            }}
                            className={`py-1 px-2.5 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 shadow-sm transition-all ${
                              selectedCategoryTags.length > 0
                                ? 'border border-primary bg-primary/10 text-primary'
                                : 'border border-black/12 bg-white text-foreground hover:bg-slate-50'
                            }`}
                            title="Filter card by multiple category tags"
                          >
                            <Filter size={13} className={selectedCategoryTags.length > 0 ? 'text-primary' : 'text-muted'} />
                            <span>Filter</span>
                            {selectedCategoryTags.length > 0 && (
                              <span className="text-[0.68rem] font-bold bg-primary text-white px-1.5 rounded-full">
                                {selectedCategoryTags.length}
                              </span>
                            )}
                          </button>

                          {/* Multi-Select Category Tags Popover */}
                          {openFilterCardId === 'other-songs' && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-[calc(100%+6px)] right-0 z-50 w-56 bg-white rounded-xl border border-black/12 shadow-2xl p-2.5 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between border-b border-black/6 pb-1">
                                <span className="text-xs font-bold text-foreground">Filter Categories</span>
                                {selectedCategoryTags.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={clearCategoryTags}
                                    className="text-[0.7rem] font-semibold text-muted bg-transparent border-0 cursor-pointer hover:text-foreground"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-col gap-1 max-h-44 overflow-y-auto">
                                {tagCategoryNames.length > 0 ? (
                                  tagCategoryNames.map((catName) => {
                                    const isChecked = selectedCategoryTags.includes(catName);
                                    return (
                                      <label
                                        key={catName}
                                        className={`flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer py-1 px-1.5 rounded-md select-none transition-colors ${
                                          isChecked ? 'bg-primary/6' : 'hover:bg-slate-50'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => toggleCategoryTag(catName)}
                                          className="accent-primary cursor-pointer"
                                        />
                                        <span>{catName}</span>
                                      </label>
                                    );
                                  })
                                ) : (
                                  <span className="text-xs text-muted italic p-1">
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
                            <div className="flex items-center justify-between mt-2 pt-2.5 border-t border-black/6 gap-2 flex-wrap">
                              <span className="text-xs text-muted font-semibold">
                                Showing {(currentOtherPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentOtherPage * ITEMS_PER_PAGE, totalOtherSongs)} of {totalOtherSongs}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={currentOtherPage <= 1}
                                  onClick={() => setCardPage('other-songs', currentOtherPage - 1)}
                                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold border ${
                                    currentOtherPage <= 1
                                      ? 'border-black/10 bg-black/3 text-muted cursor-not-allowed'
                                      : 'border-black/12 bg-white text-foreground cursor-pointer hover:bg-slate-50'
                                  }`}
                                >
                                  Prev
                                </button>

                                {Array.from({ length: totalOtherPages }, (_, i) => i + 1).map((pageNum) => (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => setCardPage('other-songs', pageNum)}
                                    className={`py-1 px-2 rounded-lg text-xs cursor-pointer ${
                                      pageNum === currentOtherPage
                                        ? 'font-bold border border-primary bg-primary text-white'
                                        : 'font-medium border border-black/12 bg-white text-foreground hover:bg-slate-50'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                ))}

                                <button
                                  type="button"
                                  disabled={currentOtherPage >= totalOtherPages}
                                  onClick={() => setCardPage('other-songs', currentOtherPage + 1)}
                                  className={`py-1 px-2.5 rounded-lg text-xs font-semibold border ${
                                    currentOtherPage >= totalOtherPages
                                      ? 'border-black/10 bg-black/3 text-muted cursor-not-allowed'
                                      : 'border-black/12 bg-white text-foreground cursor-pointer hover:bg-slate-50'
                                  }`}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-muted m-0 italic py-1">
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
