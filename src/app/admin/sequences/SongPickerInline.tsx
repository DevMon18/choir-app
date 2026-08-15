'use client';

import React, { useState, useMemo } from 'react';
import { SongCategory } from '@/app/admin/songs/SongForm';
import { CategoryItem } from '@/app/admin/categories/actions';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import { Music, Search, X, BookOpen, Check, Plus, Eye } from 'lucide-react';

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

// Mass Part Sections with corresponding database role values & filter tags
const MASS_PART_FILTERS = [
  { id: 'ALL', label: 'All Songs', roleValue: '' },
  { id: 'entrance', label: 'Entrance', roleValue: 'entrance', matchKeywords: ['entrance song', 'entrance'] },
  { id: 'kyrie', label: 'Kyrie', roleValue: 'kyrie', matchKeywords: ['kyrie', 'lord have mercy', 'lord, have mercy'] },
  { id: 'gloria', label: 'Gloria', roleValue: 'gloria', matchKeywords: ['gloria', 'glory to god'] },
  { id: 'psalm', label: 'Psalm', roleValue: 'psalm', matchKeywords: ['responsorial psalm', 'psalm'] },
  { id: 'gospel', label: 'Gospel', roleValue: 'gospel', matchKeywords: ['gospel acclamation', 'gospel', 'alleluia'] },
  { id: 'offertory', label: 'Offertory', roleValue: 'offertory', matchKeywords: ['offertory', 'presentation'] },
  { id: 'sanctus', label: 'Sanctus', roleValue: 'sanctus', matchKeywords: ['sanctus', 'holy, holy, holy', 'holy holy holy'] },
  { id: 'memorial', label: 'Memorial', roleValue: 'memorial', matchKeywords: ['memorial acclamation'] },
  { id: 'amen', label: 'Amen', roleValue: 'amen', matchKeywords: ['great amen', 'amen'] },
  { id: 'agnus', label: 'Lamb of God', roleValue: 'agnus', matchKeywords: ['lamb of god', 'agnus dei'] },
  { id: 'communion', label: 'Communion', roleValue: 'communion', matchKeywords: ['communion'] },
  { id: 'recessional', label: 'Recessional', roleValue: 'recessional', matchKeywords: ['recessional', 'closing song', 'sending forth'] },
];

const matchesFilter = (song: Song, filterId: string): boolean => {
  if (filterId === 'ALL') return true;
  const cfg = MASS_PART_FILTERS.find((f) => f.id === filterId);
  if (!cfg || !cfg.matchKeywords) return true;

  const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
  if (song.category) songCatNames.push(song.category.toLowerCase());

  return songCatNames.some((cat) =>
    (cfg.matchKeywords || []).some((kw) => cat.includes(kw) || kw.includes(cat))
  );
};

// Auto-detect role value for a song based on its categories
const detectRoleValue = (song: Song): string => {
  const songCatNames = (song.categories || []).map((c) => c.name.toLowerCase());
  if (song.category) songCatNames.push(song.category.toLowerCase());

  for (const item of MASS_PART_FILTERS) {
    if (item.id === 'ALL' || !item.roleValue || !item.matchKeywords) continue;
    if (songCatNames.some((cat) => (item.matchKeywords || []).some((kw) => cat.includes(kw) || kw.includes(cat)))) {
      return item.roleValue;
    }
  }
  return '';
};

export const SongPickerInline: React.FC<SongPickerInlineProps> = ({
  songs,
  existingSongIds,
  sequenceTitle,
  onAddSong,
  onClose,
  isPending = false,
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [activeFilterId, setActiveFilterId] = useState<string>('ALL');
  const [previewSong, setPreviewSong] = useState<Song | null>(null);
  const [addingSongId, setAddingSongId] = useState<string | null>(null);

  // Compute song count for each filter pill
  const filterCounts = useMemo(() => {
    const map: Record<string, number> = {};
    MASS_PART_FILTERS.forEach((f) => {
      if (f.id === 'ALL') {
        map[f.id] = songs.length;
      } else {
        map[f.id] = songs.filter((s) => matchesFilter(s, f.id)).length;
      }
    });
    return map;
  }, [songs]);

  // Filter songs based on search & active Mass Part filter pill
  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      // 1. Search Query Filter
      if (searchValue.trim()) {
        const q = searchValue.toLowerCase().trim();
        const titleMatch = song.title.toLowerCase().includes(q);
        const composerMatch = song.composer ? song.composer.toLowerCase().includes(q) : false;
        const lyricsMatch = song.lyrics ? song.lyrics.toLowerCase().includes(q) : false;
        if (!titleMatch && !composerMatch && !lyricsMatch) return false;
      }

      // 2. Mass Part Category Pill Filter
      if (activeFilterId !== 'ALL') {
        if (!matchesFilter(song, activeFilterId)) return false;
      }

      return true;
    });
  }, [songs, searchValue, activeFilterId]);

  const handleAddClick = async (song: Song) => {
    setAddingSongId(song.id);
    const roleValue = detectRoleValue(song);
    try {
      await onAddSong(song.id, roleValue || undefined);
    } finally {
      setAddingSongId(null);
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '20px',
        border: '1px solid rgba(30,58,138,0.12)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginTop: '16px',
        marginBottom: '16px',
        width: '100%',
      }}
    >
      {/* Streamlined Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background: 'rgba(30,58,138,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <BookOpen size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
            Repertoire Songbook
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500 }}>
            • Tap "+ Add" to assign to setlist
          </span>
        </div>

        <span
          style={{
            fontSize: '0.74rem',
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'rgba(30,58,138,0.08)',
            padding: '4px 10px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {songs.length} {songs.length === 1 ? 'Song' : 'Songs'} Available
        </span>
      </div>

      {/* Search Input Bar */}
      <div style={{ padding: '12px 18px 8px', background: '#fafafa' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={15}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            className="input-field"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search song title, composer, or lyrics…"
            style={{
              paddingLeft: '36px',
              paddingRight: searchValue ? '32px' : '12px',
              height: '42px',
              fontSize: '0.88rem',
              borderRadius: '12px',
              border: '1px solid rgba(0,0,0,0.12)',
              background: '#ffffff',
            }}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Mass Part Quick Filter Pills Bar */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '8px 18px 12px',
          overflowX: 'auto',
          background: '#fafafa',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          scrollbarWidth: 'none',
        }}
      >
        {MASS_PART_FILTERS.map((filter) => {
          const isActive = activeFilterId === filter.id;
          const count = filterCounts[filter.id] || 0;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilterId(filter.id)}
              style={{
                padding: '5px 12px',
                borderRadius: '18px',
                fontSize: '0.78rem',
                fontWeight: isActive ? 700 : 500,
                border: isActive ? '1.5px solid var(--primary)' : '1px solid rgba(0,0,0,0.1)',
                background: isActive ? 'var(--primary)' : '#ffffff',
                color: isActive ? '#ffffff' : 'var(--foreground)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 6px rgba(11,77,36,0.2)' : 'none',
              }}
            >
              {filter.label} <span style={{ opacity: isActive ? 0.9 : 0.6, fontSize: '0.7rem' }}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Unified Fast Song List */}
      <div style={{ maxHeight: '520px', overflowY: 'auto', padding: '6px 18px 16px' }}>
        {filteredSongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <Music size={34} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '0.88rem' }}>No matching songs found in repertoire.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredSongs.map((song) => {
              const isAlreadyInSeq = existingSongIds.includes(song.id);
              const songCats = song.categories && song.categories.length > 0
                ? song.categories
                : song.category
                ? [{ id: song.category, name: song.category }]
                : [];

              return (
                <div
                  key={song.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    padding: '11px 4px',
                    background: isAlreadyInSeq ? 'rgba(30,58,138,0.02)' : 'transparent',
                    borderBottom: '1px solid rgba(0,0,0,0.05)',
                    gap: '8px 12px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: '1 1 180px', minWidth: '150px' }}>
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
                            lineHeight: 1.3,
                          }}
                        >
                          {song.title}
                        </h4>
                        {isAlreadyInSeq && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '1px 7px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
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

                        {songCats.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {songCats.slice(0, 2).map((cat) => (
                              <span
                                key={cat.id}
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
                                {cat.name}
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

                  {/* Actions: Preview & Add */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexShrink: 0 }}>
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
                      onClick={() => handleAddClick(song)}
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
            })}
          </div>
        )}
      </div>

      {/* ChordPro Lyrics Preview Sub-Modal */}
      {previewSong && (
        <div
          onClick={() => setPreviewSong(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '76px 16px 84px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: 'calc(100vh - 160px)',
              background: '#ffffff',
              borderRadius: '20px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>
                  {previewSong.title}
                </h3>
                {previewSong.composer && (
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    by {previewSong.composer}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewSong(null)}
                style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {previewSong.lyrics ? (
                <ChordProRenderer lyrics={previewSong.lyrics} showChords={true} semitones={0} fontSize={16} />
              ) : (
                <p style={{ color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>No lyrics or chords available for this song.</p>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setPreviewSong(null)} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = previewSong;
                  setPreviewSong(null);
                  handleAddClick(s);
                }}
                className="btn btn-primary"
                style={{ padding: '6px 16px', fontSize: '0.82rem' }}
              >
                + Add to Sequence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
