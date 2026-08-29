'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { archiveSong, restoreSong } from './actions';
import { SongForm, SongCategory } from './SongForm';
import { CategoryManagerClient } from '@/app/admin/categories/CategoryManagerClient';
import { CategoryItem } from '@/app/admin/categories/actions';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import {
  Music, Tag, Search, X, BookOpen, SortAsc, Layers, ChevronDown, ChevronUp,
  Plus, Pencil, Archive, RotateCcw, ChevronRight,
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
  arranger: string | null;
  category: string | null;
  categories?: SongCategory[];
  lyrics: string | null;
  is_archived: boolean;
  created_at: string;
}

interface SongsManagerClientProps {
  currentUserProfile: Profile;
  initialSongs: Song[];
  availableCategories: CategoryItem[];
}

type AdminTab = 'songs' | 'categories';
type SongViewMode = 'MASS_PARTS' | 'AZ_INDEX';

// Mass Part Sections (same as Repertoire)
const MASS_PART_SECTIONS = [
  { id: 'entrance-song', name: 'Entrance Song', matchKeywords: ['entrance song', 'entrance'] },
  { id: 'kyrie', name: 'Kyrie', matchKeywords: ['kyrie', 'lord have mercy', 'lord, have mercy'] },
  { id: 'gloria', name: 'Gloria', matchKeywords: ['gloria', 'glory to god'] },
  { id: 'responsorial-psalm', name: 'Responsorial Psalm', matchKeywords: ['responsorial psalm', 'psalm'] },
  { id: 'gospel-acclamation', name: 'Gospel Acclamation', matchKeywords: ['gospel acclamation', 'gospel', 'alleluia', 'praise to you'] },
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

export const SongsManagerClient = ({
  currentUserProfile,
  initialSongs,
  availableCategories,
}: SongsManagerClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('songs');
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(availableCategories);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [songViewMode, setSongViewMode] = useState<SongViewMode>('MASS_PARTS');
  const [activeTab2, setActiveTab2] = useState<string>('ALL'); // Mass Parts tab
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Form state
  const [formMode, setFormMode] = useState<'none' | 'create' | 'edit'>('none');
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  const { addToast } = useToast();
  const [archiveConfirmSong, setArchiveConfirmSong] = useState<Song | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.anim-header', { opacity: 0, y: 15, duration: 0.4, ease: 'power2.out' });
      gsap.from('.anim-section', { opacity: 0, y: 15, duration: 0.4, stagger: 0.05, ease: 'power2.out' });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Keyboard shortcut: '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) && document.activeElement !== searchInputRef.current && formMode === 'none') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && formMode !== 'none') {
        setFormMode('none');
        setEditingSong(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formMode]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    MASS_PART_SECTIONS.forEach((p) => { all[p.id] = true; });
    all['other-songs'] = true;
    setCollapsedSections(all);
  };
  const expandAll = () => setCollapsedSections({});

  const handleArchiveClick = (song: Song) => {
    if (song.is_archived) handlePerformArchiveOrRestore(song);
    else setArchiveConfirmSong(song);
  };

  const handlePerformArchiveOrRestore = async (song: Song) => {
    setArchiveConfirmSong(null);
    setLoadingId(song.id);
    const result = song.is_archived ? await restoreSong(song.id) : await archiveSong(song.id);
    setLoadingId(null);
    if (result?.error) {
      addToast({ type: 'error', title: 'Error', message: result.error });
    } else {
      setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, is_archived: !s.is_archived } : s));
      addToast({ type: 'success', title: 'Done', message: song.is_archived ? 'Song restored to repertoire.' : 'Song archived.' });
    }
  };

  // Fix: after save, update in-memory list so cards reflect new values without stale refresh
  const handleFormSuccess = (savedId: string) => {
    const mode = formMode;
    addToast({ type: 'success', title: 'Saved', message: mode === 'create' ? 'Song created!' : 'Song updated!' });
    setFormMode('none');
    setEditingSong(null);
    router.refresh(); // triggers Next.js RSC refresh to re-fetch updated categories/lyrics
  };

  // Filtered songs for current tab
  const activeSongs = songs.filter((s) => showArchived ? s.is_archived : !s.is_archived);

  const filteredSongs = activeSongs.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const catMatch = (s.categories || []).some((c) => c.name.toLowerCase().includes(q));
    return (
      s.title.toLowerCase().includes(q) ||
      (s.composer ?? '').toLowerCase().includes(q) ||
      (s.category ?? '').toLowerCase().includes(q) ||
      catMatch
    );
  });

  // Assigned/Other split for Mass Parts view
  const assignedSongIds = new Set<string>();
  MASS_PART_SECTIONS.forEach((part) => {
    filteredSongs.forEach((s) => {
      if (matchesMassPart(s, part.name, part.matchKeywords)) assignedSongIds.add(s.id);
    });
  });
  const otherSongs = filteredSongs.filter((s) => !assignedSongIds.has(s.id));

  const isSearching = searchQuery.trim().length > 0;

  // A-Z map
  const alphabetMap: Record<string, Song[]> = {};
  if (songViewMode === 'AZ_INDEX') {
    const sorted = [...filteredSongs].sort((a, b) => a.title.localeCompare(b.title));
    sorted.forEach((song) => {
      const letter = song.title.charAt(0).toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : '#';
      if (!alphabetMap[key]) alphabetMap[key] = [];
      alphabetMap[key].push(song);
    });
  }

  const displaySections = activeTab2 === 'ALL'
    ? MASS_PART_SECTIONS
    : MASS_PART_SECTIONS.filter((p) => p.id === activeTab2);

  // Song card row (same look as repertoire + admin action buttons)
  const renderSongRow = (song: Song) => {
    const tags = song.categories && song.categories.length > 0
      ? song.categories
      : song.category
      ? [{ id: song.category, name: song.category }]
      : [];

    return (
      <div
        key={song.id}
        className="flex items-center justify-between py-3 px-4 rounded-xl bg-white/90 border border-glass-border min-h-[52px] gap-3 transition-all hover:bg-white hover:shadow-card hover:border-primary/20"
      >
        {/* Song Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/8 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
            <Music size={17} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <h4 className="text-[0.96rem] font-bold text-primary m-0 leading-snug break-words">
              {song.title}
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {song.composer && (
                <span className="text-xs text-muted font-medium mr-1">{song.composer}</span>
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
                    <span className="text-[0.66rem] text-muted font-semibold">+{tags.length - 3}</span>
                  )}
                </div>
              )}
              {song.lyrics && (
                <span className="text-[0.66rem] font-bold text-accent bg-accent/8 py-0.5 px-2 rounded-full border border-accent/15 whitespace-nowrap">
                  Chords
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => { setEditingSong(song); setFormMode('edit'); }}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold border border-primary/25 bg-primary/6 text-primary hover:bg-primary/12 cursor-pointer transition-all"
            title="Edit song"
          >
            <Pencil size={13} />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <button
            type="button"
            onClick={() => handleArchiveClick(song)}
            disabled={loadingId === song.id}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
              song.is_archived
                ? 'border-emerald-400/40 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-red-300/40 bg-red-50/60 text-red-600 hover:bg-red-100/60'
            }`}
            title={song.is_archived ? 'Restore song' : 'Archive song'}
          >
            {loadingId === song.id ? (
              <span className="animate-pulse">…</span>
            ) : song.is_archived ? (
              <><RotateCcw size={13} /><span className="hidden sm:inline">Restore</span></>
            ) : (
              <><Archive size={13} /><span className="hidden sm:inline">Archive</span></>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-6 px-4 pb-10 max-w-[1040px] mx-auto w-full">

        {/* ── Tab Switcher ── */}
        <div className="anim-header mb-5 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('songs')}
            className={`inline-flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold cursor-pointer border-none transition-all ${
              activeTab === 'songs' ? 'bg-primary text-white shadow-sm' : 'bg-black/5 text-muted hover:bg-black/10'
            }`}
          >
            <Music size={15} />
            Song Library
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`inline-flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-semibold cursor-pointer border-none transition-all ${
              activeTab === 'categories' ? 'bg-primary text-white shadow-sm' : 'bg-black/5 text-muted hover:bg-black/10'
            }`}
          >
            <Tag size={15} />
            Manage Categories ({categoriesList.length})
          </button>
        </div>

        {/* ══ SONGS TAB ══ */}
        {activeTab === 'songs' && (
          <>
            {/* Header Row */}
            <div className="anim-header mb-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen size={22} className="text-primary" />
                  <h1 className="text-2xl sm:text-[1.8rem] font-bold text-primary m-0">Song Library</h1>
                </div>
                <p className="text-muted text-sm m-0">Manage ChordPro lyrics and song catalogue</p>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex gap-1 bg-black/6 p-1 rounded-xl">
                  <button
                    onClick={() => { setSongViewMode('MASS_PARTS'); setActiveTab2('ALL'); }}
                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                      songViewMode === 'MASS_PARTS' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted'
                    }`}
                  >
                    <Layers size={14} />
                    Mass Parts
                  </button>
                  <button
                    onClick={() => setSongViewMode('AZ_INDEX')}
                    className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                      songViewMode === 'AZ_INDEX' ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted'
                    }`}
                  >
                    <SortAsc size={14} />
                    A-Z Index
                  </button>
                </div>

                <button
                  onClick={() => setShowArchived(!showArchived)}
                  className="py-2 px-3.5 rounded-xl text-xs font-semibold border-0 cursor-pointer transition-all bg-black/5 text-muted hover:bg-black/10"
                >
                  {showArchived ? 'Show Active' : 'Show Archived'}
                </button>

                <button
                  onClick={() => { setEditingSong(null); setFormMode('create'); }}
                  className="flex items-center gap-1.5 btn btn-primary !py-2 !px-4 text-sm"
                >
                  <Plus size={15} />
                  Add Song
                </button>
              </div>
            </div>

            {/* Search + Filter Row */}
            <div className="anim-header mb-5 flex flex-wrap gap-3 items-center">
              <div className="relative flex-[1_1_260px] min-w-[220px]">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="input-field pl-10 pr-10 w-full min-h-[44px] text-sm"
                  placeholder="Search title, composer, category… (/)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-muted cursor-pointer p-1"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Mass Part filter dropdown */}
              {songViewMode === 'MASS_PARTS' && (
                <div className="relative flex-none min-w-[200px]">
                  <select
                    className="input-field w-full min-h-[44px] text-sm font-semibold text-foreground cursor-pointer"
                    value={activeTab2}
                    onChange={(e) => setActiveTab2(e.target.value)}
                  >
                    <option value="ALL">All Mass Parts ({activeSongs.length} songs)</option>
                    {MASS_PART_SECTIONS.map((part) => (
                      <option key={part.id} value={part.id}>{part.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Collapse / Expand buttons */}
              {songViewMode === 'MASS_PARTS' && activeTab2 === 'ALL' && !isSearching && (
                <div className="flex gap-1.5 ml-auto">
                  <button onClick={collapseAll} className="py-2 px-3 rounded-xl text-xs font-semibold text-muted bg-black/5 border-0 cursor-pointer hover:bg-black/10 whitespace-nowrap">
                    Collapse All
                  </button>
                  <button onClick={expandAll} className="py-2 px-3 rounded-xl text-xs font-semibold text-muted bg-black/5 border-0 cursor-pointer hover:bg-black/10 whitespace-nowrap">
                    Expand All
                  </button>
                </div>
              )}
            </div>

            {/* Search result count */}
            {isSearching && (
              <div className="mb-4 text-sm text-muted font-semibold">
                Found {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'} matching &quot;{searchQuery.trim()}&quot;
              </div>
            )}

            {/* ══ Song Form Panel (slide-in) ══ */}
            {formMode !== 'none' && (
              <div className="anim-section glass-container mb-6 p-6">
                <SongForm
                  song={editingSong ?? undefined}
                  availableCategories={categoriesList}
                  onSuccess={handleFormSuccess}
                  onCancel={() => { setFormMode('none'); setEditingSong(null); }}
                  onCategoryCreated={(newCat) => {
                    const fullItem: CategoryItem = {
                      id: newCat.id,
                      name: newCat.name,
                      sort_order: categoriesList.length,
                      created_at: new Date().toISOString(),
                      song_count: 0,
                    };
                    setCategoriesList((prev) => [...prev, fullItem]);
                  }}
                />
              </div>
            )}

            {/* ══ Empty State ══ */}
            {filteredSongs.length === 0 ? (
              <div className="glass-container anim-section text-center py-12 px-5">
                <Music size={42} className="mx-auto mb-3 text-muted" />
                <p className="text-muted text-base m-0">
                  {showArchived
                    ? 'No archived songs.'
                    : searchQuery
                    ? 'No songs match your search.'
                    : 'No songs yet — click "+ Add Song" to get started.'}
                </p>
              </div>

            ) : songViewMode === 'AZ_INDEX' ? (
              /* 🔤 A-Z Hymnal Index */
              <div className="flex flex-col gap-5">
                {Object.keys(alphabetMap).sort().map((letter) => {
                  const letterSongs = alphabetMap[letter];
                  return (
                    <div key={letter} className="glass-container anim-section rounded-xl overflow-hidden border border-glass-border shadow-card">
                      <div className="py-2.5 px-4.5 bg-primary/6 border-b border-glass-border flex items-center justify-between">
                        <span className="text-lg font-extrabold text-primary">{letter}</span>
                        <span className="text-xs font-semibold text-muted">{letterSongs.length} {letterSongs.length === 1 ? 'song' : 'songs'}</span>
                      </div>
                      <div className="p-3 pb-4 flex flex-col gap-2 bg-white/25">
                        {letterSongs.map((song) => renderSongRow(song))}
                      </div>
                    </div>
                  );
                })}
              </div>

            ) : (
              /* 📖 Mass Parts Accordion View */
              <div className="flex flex-col gap-4">
                {displaySections.map((part) => {
                  const partSongs = filteredSongs.filter((s) => matchesMassPart(s, part.name, part.matchKeywords));
                  if (isSearching && partSongs.length === 0) return null;
                  const isCollapsed = isSearching ? false : !!collapsedSections[part.id];

                  return (
                    <div
                      key={part.id}
                      id={`part-${part.id}`}
                      className="glass-container anim-section rounded-xl border border-glass-border shadow-card"
                    >
                      {/* Section Header */}
                      <div
                        onClick={() => toggleSection(part.id)}
                        className={`flex items-center justify-between py-3.5 px-4.5 cursor-pointer bg-white/75 select-none transition-colors ${
                          isCollapsed ? 'rounded-xl' : 'rounded-t-xl'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <BookOpen size={17} className="text-primary" />
                          <h2 className="text-base font-bold text-primary m-0">{part.name}</h2>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-muted">{partSongs.length} songs</span>
                          {isCollapsed ? <ChevronDown size={16} className="text-muted" /> : <ChevronUp size={16} className="text-muted" />}
                        </div>
                      </div>

                      {/* Songs List */}
                      {!isCollapsed && (
                        <div className="p-3 pb-4 flex flex-col gap-2 bg-white/25 rounded-b-xl">
                          {partSongs.length > 0 ? (
                            partSongs.map((song) => renderSongRow(song))
                          ) : (
                            <p className="text-sm text-muted italic text-center py-4">
                              No songs in this Mass Part yet.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Other Songs */}
                {activeTab2 === 'ALL' && otherSongs.length > 0 && (
                  <div className="glass-container anim-section rounded-xl border border-glass-border shadow-card">
                    <div
                      onClick={() => toggleSection('other-songs')}
                      className={`flex items-center justify-between py-3.5 px-4.5 cursor-pointer bg-white/75 select-none transition-colors ${
                        collapsedSections['other-songs'] ? 'rounded-xl' : 'rounded-t-xl'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Music size={17} className="text-primary" />
                        <h2 className="text-base font-bold text-primary m-0">Other Repertoire Songs</h2>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold text-muted">{otherSongs.length} songs</span>
                        {collapsedSections['other-songs'] ? <ChevronDown size={16} className="text-muted" /> : <ChevronUp size={16} className="text-muted" />}
                      </div>
                    </div>
                    {!collapsedSections['other-songs'] && (
                      <div className="p-3 pb-4 flex flex-col gap-2 bg-white/25 rounded-b-xl">
                        {otherSongs.map((song) => renderSongRow(song))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ══ CATEGORIES TAB ══ */}
        {activeTab === 'categories' && (
          <div className="anim-section">
            <CategoryManagerClient
              initialCategories={categoriesList}
              onCategoriesChange={() => router.refresh()}
            />
          </div>
        )}
      </main>

      {/* Archive Confirmation Modal */}
      {archiveConfirmSong && (
        <ConfirmModal
          title={`Archive "${archiveConfirmSong.title}"?`}
          message="Archived songs are hidden from choir members in the repertoire, but remain saved and can be restored anytime."
          confirmLabel="Archive Song"
          isDanger={true}
          onConfirm={() => handlePerformArchiveOrRestore(archiveConfirmSong)}
          onCancel={() => setArchiveConfirmSong(null)}
        />
      )}

      {/* Mobile FAB */}
      {activeTab === 'songs' && formMode === 'none' && (
        <button
          onClick={() => { setEditingSong(null); setFormMode('create'); }}
          className="btn btn-primary songs-mobile-fab"
          aria-label="Add new song"
        >
          <Plus size={18} />
          Add Song
        </button>
      )}
    </div>
  );
};
