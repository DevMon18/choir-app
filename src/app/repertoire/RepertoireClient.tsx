'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SongCategory } from '@/app/admin/songs/SongForm';
import { CategoryItem } from '@/app/admin/categories/actions';
import {
  Music,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  SortAsc,
  Layers,
  Filter,
  Sparkles,
  CheckCircle2,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import gsap from 'gsap';
import { useRepertoire } from '@/hooks/useRepertoire';
import { SubmitSongModal } from '@/app/repertoire/SubmitSongModal';

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

// Canonical Mass Part list with numbering & liturgical order
const MASS_PART_SECTIONS = [
  { id: 'entrance-song', num: '01', name: 'Entrance Song', matchKeywords: ['entrance song', 'entrance'] },
  { id: 'kyrie', num: '02', name: 'Kyrie', matchKeywords: ['kyrie', 'lord have mercy', 'lord, have mercy'] },
  { id: 'gloria', num: '03', name: 'Gloria', matchKeywords: ['gloria', 'glory to god'] },
  { id: 'responsorial-psalm', num: '04', name: 'Responsorial Psalm', matchKeywords: ['responsorial psalm', 'psalm'] },
  { id: 'gospel-acclamation', num: '05', name: 'Gospel Acclamation', matchKeywords: ['gospel acclamation', 'gospel acclamation (alleluia or praise to you)', 'gospel', 'alleluia', 'praise to you'] },
  { id: 'offertory-presentation', num: '06', name: 'Offertory / Presentation', matchKeywords: ['offertory / presentation song', 'offertory / presentation', 'offertory', 'presentation song', 'offertory song'] },
  { id: 'sanctus', num: '07', name: 'Sanctus', matchKeywords: ['sanctus', 'holy, holy, holy', 'holy holy holy'] },
  { id: 'memorial-acclamation', num: '08', name: 'Memorial Acclamation', matchKeywords: ['memorial acclamation'] },
  { id: 'great-amen', num: '09', name: 'Great Amen', matchKeywords: ['great amen', 'amen'] },
  { id: 'lords-prayer', num: '10', name: "Lord's Prayer", matchKeywords: ["lord's prayer", 'lords prayer', 'our father', 'ama namin'] },
  { id: 'lamb-of-god', num: '11', name: 'Lamb of God', matchKeywords: ['lamb of god', 'agnus dei', 'kordero ng diyos'] },
  { id: 'communion-song', num: '12', name: 'Communion Song', matchKeywords: ['communion song', 'communion'] },
  { id: 'recessional-closing', num: '13', name: 'Recessional / Closing', matchKeywords: ['recessional / closing song', 'recessional / closing', 'recessional', 'closing song', 'sending forth'] },
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
  const filterScrollRef = useRef<HTMLDivElement>(null);

  const [searchValue, setSearchValue] = useState(initialQuery);

  // Initial Category & Tab State
  const initialCategory = categoriesParam || 'ALL';
  const [selectedMassPartFilter, setSelectedMassPartFilter] = useState<string>(initialCategory);

  // Songbook Display Mode: 'MASS_PARTS' (Grouped by Liturgical Order) vs 'AZ_INDEX' (Alphabetical Hymnal Index)
  const [viewMode, setViewMode] = useState<'MASS_PARTS' | 'AZ_INDEX'>('MASS_PARTS');
  const [submitModalOpen, setSubmitModalOpen] = useState(false);

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showTagFilterPopover, setShowTagFilterPopover] = useState(false);
  const [selectedSeasonTags, setSelectedSeasonTags] = useState<string[]>([]);

  const [isPending, startTransition] = useTransition();

  // Helper to check if a category name corresponds to a Mass Part section
  const isMassPartName = (name: string): boolean => {
    const n = name.toLowerCase();
    return MASS_PART_SECTIONS.some(
      (part) => part.name.toLowerCase() === n || part.id === n || part.matchKeywords.includes(n)
    );
  };

  // Collect all non-Mass Part category tags (e.g., Liturgical Season, Language, Theme)
  const seasonTagNames = Array.from(
    new Set([
      ...availableCategories.map((c) => c.name),
      ...songs.flatMap((s) => [
        ...(s.categories || []).map((c) => c.name),
        ...(s.category ? [s.category] : []),
      ]),
    ])
  ).filter((name): name is string => Boolean(name) && !isMassPartName(name));

  const toggleSeasonTag = (tagName: string) => {
    setSelectedSeasonTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const clearAllFilters = () => {
    setSearchValue('');
    setSelectedMassPartFilter('ALL');
    setSelectedSeasonTags([]);
  };

  const songMatchesSeasonTags = (song: Song, selectedTags: string[]): boolean => {
    if (selectedTags.length === 0) return true;
    const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
    if (song.category) songCatNames.push(song.category.toLowerCase());

    return selectedTags.some((tag) =>
      songCatNames.some((cat) => cat === tag.toLowerCase() || cat.includes(tag.toLowerCase()) || tag.toLowerCase().includes(cat))
    );
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.anim-header', { opacity: 0, y: 12, duration: 0.35, ease: 'power2.out' });
      gsap.from('.anim-section', { opacity: 0, y: 12, duration: 0.35, stagger: 0.04, ease: 'power2.out' });
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
        if (selectedMassPartFilter && selectedMassPartFilter !== 'ALL') {
          params.set('categories', selectedMassPartFilter);
        }

        const queryString = params.toString();
        router.replace(`/repertoire${queryString ? `?${queryString}` : ''}`);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchValue, selectedMassPartFilter]);

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

  // Filter songs based on search and season tags
  const filteredSongs = songs.filter((song) => {
    if (searchValue.trim()) {
      const qLower = searchValue.toLowerCase().trim();
      const titleMatch = song.title.toLowerCase().includes(qLower);
      const composerMatch = song.composer ? song.composer.toLowerCase().includes(qLower) : false;
      const lyricsMatch = song.lyrics ? song.lyrics.toLowerCase().includes(qLower) : false;
      if (!titleMatch && !composerMatch && !lyricsMatch) return false;
    }

    if (!songMatchesSeasonTags(song, selectedSeasonTags)) {
      return false;
    }

    if (selectedMassPartFilter && selectedMassPartFilter !== 'ALL') {
      const massPart = MASS_PART_SECTIONS.find(
        (p) => p.name.toLowerCase() === selectedMassPartFilter.toLowerCase() || p.id === selectedMassPartFilter
      );

      if (massPart) {
        if (!matchesMassPart(song, massPart.name, massPart.matchKeywords)) return false;
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
  const songsWithChordsCount = songs.filter((s) => Boolean(s.lyrics)).length;

  // Render clean, modern song row tile
  const renderSongRow = (song: Song, currentSectionName?: string) => {
    // Only display extra tags that aren't repeating the current section mass part name
    const extraTags = (song.categories && song.categories.length > 0
      ? song.categories
      : song.category
      ? [{ id: song.category, name: song.category }]
      : []
    ).filter((tag) => {
      if (!currentSectionName) return true;
      const tLower = tag.name.toLowerCase();
      const sLower = currentSectionName.toLowerCase();
      return !tLower.includes(sLower) && !sLower.includes(tLower) && !isMassPartName(tag.name);
    });

    return (
      <Link
        key={song.id}
        href={`/repertoire/${song.id}`}
        className="group flex items-center justify-between p-3 sm:p-3.5 rounded-xl bg-white border border-black/[0.07] text-inherit no-underline transition-all hover:bg-slate-50/80 hover:border-primary/30 hover:shadow-sm gap-3 min-w-0"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Note Icon Badge */}
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
            <Music size={16} />
          </div>

          {/* Title & Metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[0.92rem] sm:text-[0.96rem] font-bold text-foreground m-0 truncate group-hover:text-primary transition-colors">
                {song.title}
              </h4>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap mt-0.5 text-xs text-muted">
              {song.composer ? (
                <span className="truncate max-w-[160px] sm:max-w-[220px]">
                  {song.composer}
                </span>
              ) : (
                <span className="italic opacity-75">Composer unknown</span>
              )}

              {/* Chords Badge */}
              {song.lyrics && (
                <span className="inline-flex items-center gap-0.5 text-[0.68rem] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  <FileText size={10} />
                  Chords
                </span>
              )}

              {/* Sub Tags (e.g. Lent, Advent, Easter, Latin) */}
              {extraTags.slice(0, 2).map((t) => (
                <span
                  key={t.id}
                  className="text-[0.66rem] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded border border-primary/15 whitespace-nowrap"
                >
                  {t.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Action Chevron */}
        <div className="w-7 h-7 rounded-full bg-black/4 flex items-center justify-center text-muted group-hover:text-primary group-hover:bg-primary/10 transition-colors flex-shrink-0">
          <ChevronRight size={15} />
        </div>
      </Link>
    );
  };

  // Group songs alphabetically for A-Z Hymnal Mode
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

  // Filter sections by active mass part tab
  const displaySections = selectedMassPartFilter === 'ALL'
    ? MASS_PART_SECTIONS
    : MASS_PART_SECTIONS.filter((p) => p.id === selectedMassPartFilter || p.name.toLowerCase() === selectedMassPartFilter.toLowerCase());

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen bg-[#fbfbf9] text-foreground">
      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-5 sm:py-7 px-3 sm:px-6 pb-24 max-w-[1120px] mx-auto w-full">
        {/* Modern Liturgical Hero Header */}
        <div className="anim-header mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/[0.06]">
          <div>
            <div className="inline-flex items-center gap-1.5 py-0.5 px-2.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-1.5 border border-primary/15">
              <BookOpen size={13} />
              <span>Choir Liturgical Library</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-primary m-0 tracking-tight">
              Repertoire &amp; Songbook
            </h1>
            <p className="text-xs sm:text-sm text-muted m-0 mt-1">
              Browse mass parts in liturgical order or switch to the A-Z alphabetical index.
            </p>
          </div>

          {/* Top Actions: Propose Song & View Switcher */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSubmitModalOpen(true)}
              className="btn btn-primary !py-2 !px-3.5 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm rounded-xl"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--primary))' }}
            >
              <Sparkles size={14} />
              <span>+ Propose Song</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex bg-black/[0.05] p-1 rounded-xl border border-black/[0.05]">
              <button
                type="button"
                onClick={() => { setViewMode('MASS_PARTS'); setSelectedMassPartFilter('ALL'); }}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                  viewMode === 'MASS_PARTS' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted hover:text-foreground'
                }`}
              >
                <Layers size={14} />
                <span className="hidden sm:inline">Mass Parts</span>
                <span className="sm:hidden">Liturgical</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('AZ_INDEX')}
                className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                  viewMode === 'AZ_INDEX' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted hover:text-foreground'
                }`}
              >
                <SortAsc size={14} />
                <span>A–Z Index</span>
              </button>
            </div>
          </div>
        </div>

        {/* Quick Liturgical Mass Part Horizontal Filter Chips */}
        {viewMode === 'MASS_PARTS' && (
          <div className="anim-header mb-4">
            <div
              ref={filterScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar text-xs font-semibold"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <button
                type="button"
                onClick={() => setSelectedMassPartFilter('ALL')}
                className={`py-1.5 px-3 rounded-full border whitespace-nowrap cursor-pointer transition-all ${
                  selectedMassPartFilter === 'ALL'
                    ? 'bg-primary text-white border-primary shadow-sm font-bold'
                    : 'bg-white text-muted border-black/10 hover:border-black/20 hover:text-foreground'
                }`}
              >
                All Mass Parts ({songs.length})
              </button>

              {MASS_PART_SECTIONS.map((part) => {
                const isActive = selectedMassPartFilter === part.id || selectedMassPartFilter === part.name;
                const partCount = songs.filter((s) => matchesMassPart(s, part.name, part.matchKeywords)).length;

                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => setSelectedMassPartFilter(isActive ? 'ALL' : part.id)}
                    className={`py-1.5 px-3 rounded-full border whitespace-nowrap cursor-pointer transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-primary text-white border-primary shadow-sm font-bold'
                        : 'bg-white text-muted border-black/10 hover:border-black/20 hover:text-foreground'
                    }`}
                  >
                    <span>{part.name}</span>
                    <span className={`text-[0.68rem] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-black/5 text-muted'
                    }`}>
                      {partCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Bar & Tag Filter Controls */}
        <div className="anim-header mb-5 flex items-center gap-2.5 flex-wrap">
          {/* Search Field */}
          <div className="relative flex-1 min-w-[240px]">
            <Search
              size={17}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-black/10 rounded-xl text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 shadow-sm"
              placeholder="Search title, composer, or lyrics… (/)"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground bg-transparent border-0 cursor-pointer p-1"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Liturgical Season Tags Filter Dropdown */}
          {seasonTagNames.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTagFilterPopover(!showTagFilterPopover)}
                className={`py-2.5 px-3.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 border shadow-sm transition-all ${
                  selectedSeasonTags.length > 0
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-white text-muted border-black/10 hover:border-black/20'
                }`}
              >
                <SlidersHorizontal size={14} />
                <span>Season Tags</span>
                {selectedSeasonTags.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white text-[0.65rem] flex items-center justify-center font-black">
                    {selectedSeasonTags.length}
                  </span>
                )}
              </button>

              {showTagFilterPopover && (
                <div
                  className="absolute right-0 top-full mt-2 z-50 w-64 bg-white rounded-xl border border-black/10 shadow-xl p-3 flex flex-col gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-black/6 pb-1.5">
                    <span className="text-xs font-bold text-foreground">Liturgical Themes &amp; Tags</span>
                    {selectedSeasonTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSeasonTags([])}
                        className="text-[0.7rem] font-semibold text-primary bg-transparent border-0 cursor-pointer hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {seasonTagNames.map((tag) => {
                      const isChecked = selectedSeasonTags.includes(tag);
                      return (
                        <label
                          key={tag}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                            isChecked ? 'bg-primary/8 text-primary font-bold' : 'hover:bg-slate-50 text-foreground'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSeasonTag(tag)}
                            className="accent-primary cursor-pointer"
                          />
                          <span>{tag}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Collapse / Expand All (Mass Parts Mode) */}
          {viewMode === 'MASS_PARTS' && selectedMassPartFilter === 'ALL' && !isSearching && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={collapseAllSections}
                className="py-2 px-2.5 rounded-lg text-xs font-semibold text-muted bg-white border border-black/10 cursor-pointer hover:bg-slate-50"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={expandAllSections}
                className="py-2 px-2.5 rounded-lg text-xs font-semibold text-muted bg-white border border-black/10 cursor-pointer hover:bg-slate-50"
              >
                Expand
              </button>
            </div>
          )}

          {/* Clear active filters button */}
          {(searchValue || selectedMassPartFilter !== 'ALL' || selectedSeasonTags.length > 0) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="py-2 px-3 rounded-xl text-xs font-bold text-primary bg-primary/8 border border-primary/15 cursor-pointer hover:bg-primary/12"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Search Results Count */}
        {isSearching && (
          <div className="mb-4 text-xs sm:text-sm text-muted font-semibold">
            Found {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'} matching &quot;{searchValue.trim()}&quot;
          </div>
        )}

        {/* Repertoire Content: Empty State */}
        {filteredSongs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/8 p-10 text-center shadow-sm anim-section my-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <Music size={28} />
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">No Songs Found</h3>
            <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto mb-4">
              {searchValue || selectedMassPartFilter !== 'ALL' || selectedSeasonTags.length > 0
                ? 'No songs matched your search criteria. Try clearing your filters.'
                : 'No songs have been added to the repertoire yet.'}
            </p>
            {(searchValue || selectedMassPartFilter !== 'ALL' || selectedSeasonTags.length > 0) ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="btn btn-secondary !py-2 !px-4 text-xs font-bold"
              >
                Clear All Filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSubmitModalOpen(true)}
                className="btn btn-primary !py-2 !px-4 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>Propose First Song</span>
              </button>
            )}
          </div>
        ) : viewMode === 'AZ_INDEX' ? (
          /* 🔤 ALPHABETICAL A-Z HYMNAL INDEX VIEW */
          <div className="flex flex-col gap-4">
            {Object.keys(alphabetMap).sort().map((letter) => {
              const letterSongs = alphabetMap[letter];
              return (
                <div
                  key={letter}
                  className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden anim-section"
                >
                  <div className="py-2.5 px-4 bg-slate-50/80 border-b border-black/6 flex items-center justify-between">
                    <span className="text-base font-black text-primary">
                      {letter}
                    </span>
                    <span className="text-xs font-bold text-muted">
                      {letterSongs.length} {letterSongs.length === 1 ? 'song' : 'songs'}
                    </span>
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    {letterSongs.map((song) => renderSongRow(song))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 📖 LITURGICAL MASS PARTS VIEW */
          <div className="flex flex-col gap-3.5">
            {displaySections.map((part) => {
              const partSongs = filteredSongs.filter((s) => matchesMassPart(s, part.name, part.matchKeywords));

              // If searching, hide sections with 0 matches
              if (isSearching && partSongs.length === 0) return null;

              const isCollapsed = isSearching ? false : !!collapsedSections[part.id];

              return (
                <div
                  key={part.id}
                  id={`part-${part.id}`}
                  className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden transition-all anim-section"
                >
                  {/* Mass Part Card Header */}
                  <div
                    onClick={() => toggleSection(part.id)}
                    className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer select-none bg-white hover:bg-slate-50/75 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Liturgical Order Number Pill */}
                      <span className="text-[0.72rem] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/15 flex-shrink-0">
                        {part.num}
                      </span>
                      <h2 className="text-[0.95rem] sm:text-base font-bold text-primary m-0 truncate">
                        {part.name}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-xs font-bold py-0.5 px-2.5 rounded-full ${
                          partSongs.length > 0 ? 'bg-primary/10 text-primary' : 'bg-black/5 text-muted'
                        }`}
                      >
                        {partSongs.length} {partSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      <div className="text-muted p-0.5">
                        {isCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                      </div>
                    </div>
                  </div>

                  {/* Mass Part Song List */}
                  {!isCollapsed && (
                    <div className="p-3 sm:p-3.5 pt-0 border-t border-black/5 bg-[#fafaf8]/50 flex flex-col gap-2">
                      {partSongs.length > 0 ? (
                        partSongs.map((song) => renderSongRow(song, part.name))
                      ) : (
                        <div className="py-6 px-4 text-center">
                          <p className="text-xs text-muted m-0 italic mb-2">
                            No songs currently assigned to this mass part.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSubmitModalOpen(true)}
                            className="text-xs font-bold text-primary hover:underline bg-transparent border-0 cursor-pointer inline-flex items-center gap-1"
                          >
                            <Sparkles size={12} />
                            <span>Propose a song for {part.name}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Other Repertoire Songs Section */}
            {(selectedMassPartFilter === 'ALL' || selectedMassPartFilter === 'other-songs') && otherSongs.length > 0 && (() => {
              const isCollapsed = !!collapsedSections['other-songs'];

              return (
                <div
                  className="bg-white rounded-2xl border border-black/8 shadow-sm overflow-hidden anim-section"
                >
                  <div
                    onClick={() => toggleSection('other-songs')}
                    className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer select-none bg-white hover:bg-slate-50/75 transition-colors gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-black/5 text-muted flex items-center justify-center flex-shrink-0">
                        <Music size={14} />
                      </div>
                      <h2 className="text-[0.95rem] sm:text-base font-bold text-foreground m-0 truncate">
                        Additional &amp; Seasonal Songs
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold py-0.5 px-2.5 rounded-full bg-black/5 text-muted">
                        {otherSongs.length} {otherSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      <div className="text-muted p-0.5">
                        {isCollapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                      </div>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="p-3 sm:p-3.5 pt-0 border-t border-black/5 bg-[#fafaf8]/50 flex flex-col gap-2">
                      {otherSongs.map((song) => renderSongRow(song))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      <SubmitSongModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
};

export default RepertoireClient;
