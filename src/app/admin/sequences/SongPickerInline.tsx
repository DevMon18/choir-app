'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SongCategory } from '@/app/admin/songs/SongForm';
import { CategoryItem } from '@/app/admin/categories/actions';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import { Music, Search, ChevronRight, ChevronDown, ChevronUp, X, BookOpen, SortAsc, Layers, Filter, Check, Plus, Eye } from 'lucide-react';

export interface Song {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  categories?: SongCategory[];
  lyrics?: string | null;
}

export interface SongPickerInlineProps {
  songs: Song[];
  availableCategories?: CategoryItem[];
  existingSongIds: string[];
  sequenceTitle: string;
  onAddSong: (songId: string, roleInMass?: string) => Promise<void>;
  onClose: () => void;
  isPending?: boolean;
}

// Mass Part Sections with corresponding database role values
const MASS_PART_SECTIONS = [
  { id: 'entrance-song', name: 'Entrance Song', roleValue: 'entrance', matchKeywords: ['entrance song', 'entrance'] },
  { id: 'kyrie', name: 'Kyrie', roleValue: 'kyrie', matchKeywords: ['kyrie', 'lord have mercy', 'lord, have mercy'] },
  { id: 'gloria', name: 'Gloria', roleValue: 'gloria', matchKeywords: ['gloria', 'glory to god'] },
  { id: 'responsorial-psalm', name: 'Responsorial Psalm', roleValue: 'psalm', matchKeywords: ['responsorial psalm', 'psalm'] },
  { id: 'gospel-acclamation', name: 'Gospel Acclamation', roleValue: 'gospel', matchKeywords: ['gospel acclamation', 'gospel acclamation (alleluia or praise to you)', 'gospel', 'alleluia', 'praise to you'] },
  { id: 'offertory-presentation', name: 'Offertory / Presentation Song', roleValue: 'offertory', matchKeywords: ['offertory / presentation song', 'offertory / presentation', 'offertory', 'presentation song', 'offertory song'] },
  { id: 'sanctus', name: 'Sanctus', roleValue: 'sanctus', matchKeywords: ['sanctus', 'holy, holy, holy', 'holy holy holy'] },
  { id: 'memorial-acclamation', name: 'Memorial Acclamation', roleValue: 'memorial', matchKeywords: ['memorial acclamation'] },
  { id: 'great-amen', name: 'Great Amen', roleValue: 'amen', matchKeywords: ['great amen', 'amen'] },
  { id: 'lords-prayer', name: "Lord's Prayer", roleValue: '', matchKeywords: ["lord's prayer", 'lords prayer', 'our father'] },
  { id: 'lamb-of-god', name: 'Lamb of God', roleValue: 'agnus', matchKeywords: ['lamb of god', 'agnus dei'] },
  { id: 'communion-song', name: 'Communion Song', roleValue: 'communion', matchKeywords: ['communion song', 'communion'] },
  { id: 'recessional-closing', name: 'Recessional / Closing Song', roleValue: 'recessional', matchKeywords: ['recessional / closing song', 'recessional / closing', 'recessional', 'closing song', 'sending forth'] },
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

export const SongPickerInline: React.FC<SongPickerInlineProps> = ({
  songs,
  availableCategories = [],
  existingSongIds,
  sequenceTitle,
  onAddSong,
  onClose,
  isPending = false,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'MASS_PARTS' | 'AZ_INDEX'>('MASS_PARTS');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [openFilterCardId, setOpenFilterCardId] = useState<string | null>(null);
  const [selectedCategoryTags, setSelectedCategoryTags] = useState<string[]>([]);
  const [cardPages, setCardPages] = useState<Record<string, number>>({});
  const [previewSong, setPreviewSong] = useState<Song | null>(null);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);

  // Sync card pagination on search / filter changes
  useEffect(() => {
    setCardPages({});
  }, [searchValue, selectedCategoryTags, selectedCategoryFilter, activeTab]);

  const getCardPage = (cardId: string): number => cardPages[cardId] || 1;
  const setCardPage = (cardId: string, page: number) => {
    setCardPages((prev) => ({ ...prev, [cardId]: page }));
  };

  const getTabIdFromCategory = (catName: string): string => {
    if (!catName || catName === 'ALL') return 'ALL';
    const found = MASS_PART_SECTIONS.find((p) => p.name.toLowerCase() === catName.toLowerCase());
    return found ? found.id : 'ALL';
  };

  const handleSelectDropdownCategory = (val: string) => {
    setSelectedCategoryFilter(val);
    const tabId = getTabIdFromCategory(val);
    setActiveTab(tabId);
  };

  const isMassPartName = (name: string): boolean => {
    const n = name.toLowerCase();
    return MASS_PART_SECTIONS.some(
      (part) => part.name.toLowerCase() === n || part.id === n || part.matchKeywords.includes(n)
    );
  };

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

  const handleClearAllFilters = () => {
    setSearchValue('');
    setSelectedCategoryFilter('ALL');
    setActiveTab('ALL');
    setSelectedCategoryTags([]);
  };

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

  // Filter songs
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

  const handleAddClick = async (songId: string, roleInMass?: string) => {
    setAddingSongId(songId);
    try {
      await onAddSong(songId, roleInMass);
    } finally {
      setAddingSongId(null);
    }
  };

  // Render song row tailored for picking
  const renderSongRow = (song: Song, defaultRoleValue?: string) => {
    const isAlreadyInSeq = existingSongIds.includes(song.id);
    const rawTags = song.categories && song.categories.length > 0
      ? song.categories
      : song.category
      ? [{ id: song.category, name: song.category }]
      : [];

    const sectionPart = defaultRoleValue ? MASS_PART_SECTIONS.find((p) => p.roleValue === defaultRoleValue) : null;
    const tags = rawTags.filter((t) => {
      if (!sectionPart) return true;
      const tLower = t.name.toLowerCase().trim();
      const pLower = sectionPart.name.toLowerCase().trim();
      if (tLower === pLower) return false;
      if (sectionPart.matchKeywords.some((kw) => tLower === kw || tLower.includes(kw))) return false;
      return true;
    });

    return (
      <div
        key={song.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '12px',
          background: isAlreadyInSeq ? 'rgba(30,58,138,0.02)' : 'rgba(255, 255, 255, 0.95)',
          border: '1px solid var(--glass-border)',
          minHeight: '50px',
          gap: '12px',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: isAlreadyInSeq ? 'rgba(16,185,129,0.1)' : 'rgba(30,58,138,0.08)',
              color: isAlreadyInSeq ? 'var(--success)' : 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '2px',
            }}
          >
            {isAlreadyInSeq ? <Check size={15} /> : <Music size={15} />}
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h4
                style={{
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  margin: 0,
                  lineHeight: 1.35,
                  wordBreak: 'break-word',
                }}
              >
                {song.title}
              </h4>
              {isAlreadyInSeq && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '1px 7px', borderRadius: '10px' }}>
                  In Sequence
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {song.composer && (
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500 }}>
                  {song.composer}
                </span>
              )}

              {tags.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag.id}
                      style={{
                        fontSize: '0.64rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--primary)',
                        background: 'rgba(30,58,138,0.08)',
                        padding: '1px 6px',
                        borderRadius: '8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {song.lyrics && (
                <span
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    background: 'rgba(217,119,6,0.08)',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Chords
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Preview Lyrics & Add to Sequence */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setPreviewSong(song)}
            className="btn btn-secondary"
            style={{ minHeight: '34px', padding: '4px 10px', fontSize: '0.76rem', gap: '4px' }}
            title="Preview lyrics & chords"
          >
            <Eye size={13} />
            <span>Preview</span>
          </button>

          <button
            type="button"
            onClick={() => handleAddClick(song.id, defaultRoleValue)}
            disabled={isPending || addingSongId === song.id}
            className="btn btn-primary"
            style={{
              minHeight: '34px',
              padding: '4px 12px',
              fontSize: '0.76rem',
              gap: '4px',
              background: isAlreadyInSeq ? 'rgba(30,58,138,0.1)' : undefined,
              color: isAlreadyInSeq ? 'var(--primary)' : undefined,
              border: isAlreadyInSeq ? '1px solid rgba(30,58,138,0.2)' : undefined,
            }}
          >
            {addingSongId === song.id ? (
              <span>Adding...</span>
            ) : isAlreadyInSeq ? (
              <>
                <Plus size={13} />
                <span>Add Again</span>
              </>
            ) : (
              <>
                <Plus size={13} />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

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

  const displaySections = activeTab === 'ALL'
    ? MASS_PART_SECTIONS
    : MASS_PART_SECTIONS.filter((p) => p.id === activeTab);

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(30,58,138,0.15)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginTop: '16px',
        marginBottom: '16px',
        width: '100%',
      }}
    >
      {/* Inline Header */}
      <div
        style={{
          padding: '16px 20px 14px',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'rgba(30,58,138,0.03)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
              Select Song from Choir Songbook Repertoire
            </h3>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '0.8rem', margin: '2px 0 0' }}>
            Adding to "{sequenceTitle}" • Organized by Mass Parts & A-Z Index
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.06)', padding: '3px', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => { setViewMode('MASS_PARTS'); setActiveTab('ALL'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '7px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'MASS_PARTS' ? '#ffffff' : 'transparent',
                color: viewMode === 'MASS_PARTS' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: viewMode === 'MASS_PARTS' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Layers size={14} />
              Mass Parts
            </button>
            <button
              type="button"
              onClick={() => setViewMode('AZ_INDEX')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '7px',
                fontSize: '0.78rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                background: viewMode === 'AZ_INDEX' ? '#ffffff' : 'transparent',
                color: viewMode === 'AZ_INDEX' ? 'var(--primary)' : 'var(--muted)',
                boxShadow: viewMode === 'AZ_INDEX' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <SortAsc size={14} />
              A-Z Index
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: '#fafafa' }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: '200px' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}
          />
          <input
            ref={searchInputRef}
            type="text"
            className="input-field"
            placeholder="Search song title, composer, or lyrics…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ paddingLeft: '34px', paddingRight: searchValue ? '34px' : '12px', width: '100%', minHeight: '38px', fontSize: '0.84rem' }}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue('')}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Mass Part Dropdown */}
        <div style={{ flex: '0 0 auto', minWidth: '180px' }}>
          <select
            className="input-field"
            value={selectedCategoryFilter}
            onChange={(e) => handleSelectDropdownCategory(e.target.value)}
            style={{ width: '100%', minHeight: '38px', fontSize: '0.82rem', fontWeight: 600 }}
          >
            <option value="ALL">All Mass Parts ({songs.length} songs)</option>
            {MASS_PART_SECTIONS.map((part) => (
              <option key={part.id} value={part.name}>
                {part.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {(searchValue || selectedCategoryFilter !== 'ALL' || selectedCategoryTags.length > 0) && (
          <button
            onClick={handleClearAllFilters}
            style={{
              padding: '6px 12px', borderRadius: '8px', fontSize: '0.76rem', fontWeight: 600,
              color: 'var(--muted)', background: 'rgba(0,0,0,0.05)', border: 'none', minHeight: '38px', cursor: 'pointer',
            }}
          >
            Clear Filter
          </button>
        )}

        {/* Collapse/Expand toggles */}
        {viewMode === 'MASS_PARTS' && selectedCategoryFilter === 'ALL' && !isSearching && (
          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
            <button onClick={collapseAllSections} style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer' }}>
              Collapse
            </button>
            <button onClick={expandAllSections} style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer' }}>
              Expand
            </button>
          </div>
        )}
      </div>

      {/* Inline Scrollable Body */}
      <div style={{ maxHeight: '600px', overflowY: 'auto', padding: '16px 20px' }}>
        {isSearching && (
          <div style={{ marginBottom: '12px', fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>
            Found {filteredSongs.length} {filteredSongs.length === 1 ? 'song' : 'songs'} matching "{searchValue.trim()}"
          </div>
        )}

        {filteredSongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
            <Music size={36} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No matching songs found in repertoire.</p>
          </div>
        ) : viewMode === 'AZ_INDEX' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.keys(alphabetMap).sort().map((letter) => {
              const letterSongs = alphabetMap[letter];
              return (
                <div key={letter} style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#fafafa' }}>
                  <div style={{ padding: '8px 14px', background: 'rgba(30,58,138,0.06)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)' }}>{letter}</span>
                    <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted)' }}>{letterSongs.length} songs</span>
                  </div>
                  <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {letterSongs.map((song) => renderSongRow(song))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {displaySections.map((part) => {
              const partSongs = filteredSongs.filter((s) => matchesMassPart(s, part.name, part.matchKeywords));
              if (isSearching && partSongs.length === 0) return null;

              const isCollapsed = isSearching ? false : !!collapsedSections[part.id];
              const sectionCategoryTags = Array.from(
                new Set(
                  partSongs.flatMap((s) => [
                    ...(s.categories || []).map((c) => c.name),
                    ...(s.category ? [s.category] : []),
                  ])
                )
              ).filter((tag) => {
                const tagLower = tag.toLowerCase().trim();
                const partLower = part.name.toLowerCase().trim();
                if (tagLower === partLower) return false;
                if (part.matchKeywords.some((kw) => tagLower === kw || tagLower.includes(kw))) return false;
                return true;
              });

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
                  style={{
                    borderRadius: '14px',
                    overflow: 'visible',
                    position: 'relative',
                    zIndex: openFilterCardId === part.id ? 100 : 1,
                    border: '1px solid var(--glass-border)',
                    background: '#ffffff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Section Header */}
                  <div
                    onClick={() => toggleSection(part.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '11px 15px',
                      cursor: 'pointer',
                      background: 'rgba(30,58,138,0.03)',
                      userSelect: 'none',
                      borderRadius: isCollapsed ? '14px' : '14px 14px 0 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={16} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                        {part.name}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          background: tagFilteredPartSongs.length > 0 ? 'rgba(30,58,138,0.1)' : 'rgba(0,0,0,0.05)',
                          color: tagFilteredPartSongs.length > 0 ? 'var(--primary)' : 'var(--muted)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                        }}
                      >
                        {tagFilteredPartSongs.length} {tagFilteredPartSongs.length === 1 ? 'song' : 'songs'}
                      </span>
                      {isCollapsed ? <ChevronDown size={16} style={{ color: 'var(--muted)' }} /> : <ChevronUp size={16} style={{ color: 'var(--muted)' }} />}
                    </div>
                  </div>

                  {/* Section Body */}
                  {!isCollapsed && (
                    <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {/* Tags line with Funnel Filter */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px', paddingBottom: '6px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                            Tags:
                          </span>
                          {sectionCategoryTags.length > 0 ? (
                            sectionCategoryTags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '8px',
                                  background: 'rgba(30,58,138,0.06)', color: 'var(--primary)',
                                }}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '0.68rem', fontStyle: 'italic', color: 'var(--muted)' }}>None</span>
                          )}
                        </div>

                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenFilterCardId((prev) => (prev === part.id ? null : part.id));
                            }}
                            style={{
                              padding: '2px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 600,
                              border: selectedCategoryTags.length > 0 ? '1px solid var(--primary)' : '1px solid rgba(0,0,0,0.12)',
                              background: selectedCategoryTags.length > 0 ? 'rgba(30,58,138,0.1)' : '#ffffff',
                              color: selectedCategoryTags.length > 0 ? 'var(--primary)' : 'var(--foreground)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                          >
                            <Filter size={12} />
                            <span>Filter</span>
                            {selectedCategoryTags.length > 0 && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: 'var(--primary)', color: '#ffffff', padding: '0 4px', borderRadius: '6px' }}>
                                {selectedCategoryTags.length}
                              </span>
                            )}
                          </button>

                          {openFilterCardId === part.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 9999,
                                width: '210px', background: '#ffffff', borderRadius: '12px',
                                border: '1px solid rgba(0,0,0,0.12)', boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                                padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Filter Categories</span>
                                {selectedCategoryTags.length > 0 && (
                                  <button type="button" onClick={clearCategoryTags} style={{ fontSize: '0.68rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    Reset
                                  </button>
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '160px', overflowY: 'auto' }}>
                                {tagCategoryNames.map((catName) => {
                                  const isChecked = selectedCategoryTags.includes(catName);
                                  return (
                                    <label key={catName} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', padding: '2px 4px', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={isChecked} onChange={() => toggleCategoryTag(catName)} style={{ accentColor: 'var(--primary)' }} />
                                      <span>{catName}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {paginatedPartSongs.length > 0 ? (
                        <>
                          {paginatedPartSongs.map((song) => renderSongRow(song, part.roleValue))}

                          {totalPartPages > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                Page {currentPartPage} of {totalPartPages}
                              </span>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button" disabled={currentPartPage <= 1} onClick={() => setCardPage(part.id, currentPartPage - 1)}
                                  style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', cursor: 'pointer' }}
                                >
                                  Prev
                                </button>
                                <button
                                  type="button" disabled={currentPartPage >= totalPartPages} onClick={() => setCardPage(part.id, currentPartPage + 1)}
                                  style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', border: '1px solid rgba(0,0,0,0.12)', background: '#fff', cursor: 'pointer' }}
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic', padding: '4px 0' }}>No songs in this Mass Part section.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Other Songs Section */}
            {otherSongs.length > 0 && (
              <div style={{ borderRadius: '14px', border: '1px solid var(--glass-border)', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                <div
                  onClick={() => toggleSection('other-songs')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 15px', cursor: 'pointer', background: 'rgba(0,0,0,0.02)', borderRadius: collapsedSections['other-songs'] ? '14px' : '14px 14px 0 0' }}
                >
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>Other Repertoire Songs</h3>
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted)' }}>{otherSongs.length} songs</span>
                </div>
                {!collapsedSections['other-songs'] && (
                  <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {otherSongs.map((song) => renderSongRow(song))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lyrics & Chords Preview Sub-Modal */}
      {previewSong && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)'
          }}
          onClick={() => setPreviewSong(null)}
        >
          <div
            style={{
              background: '#ffffff', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(11, 77, 36, 0.3)',
              maxWidth: '640px', width: '100%', padding: '28px', maxHeight: '80vh', overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontWeight: 700, color: 'var(--primary)', margin: 0, fontSize: '1.2rem' }}>{previewSong.title}</h3>
                {previewSong.composer && <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '2px 0 0' }}>by {previewSong.composer}</p>}
              </div>
              <button onClick={() => setPreviewSong(null)} className="btn btn-secondary" style={{ minWidth: '36px', height: '36px', padding: 0 }}>✕</button>
            </div>

            <div style={{ background: 'rgba(30,58,138,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', overflowX: 'auto' }}>
              {previewSong.lyrics ? (
                <ChordProRenderer lyrics={previewSong.lyrics} semitones={0} fontSize={15} showChords={true} />
              ) : (
                <p style={{ color: 'var(--muted)', textAlign: 'center', margin: '20px 0' }}>No lyrics available for this song.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Also export as SongPickerModal for backwards compatibility
export const SongPickerModal = SongPickerInline;
