'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { archiveSong, restoreSong } from './actions';
import { SongForm, SongCategory } from './SongForm';
import { CategoryManagerClient } from '@/app/admin/categories/CategoryManagerClient';
import { CategoryItem } from '@/app/admin/categories/actions';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { Music, Tag } from 'lucide-react';
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

type ViewMode = 'list' | 'create' | 'edit';
type AdminTab = 'songs' | 'categories';

export const SongsManagerClient = ({
  currentUserProfile,
  initialSongs,
  availableCategories,
}: SongsManagerClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('songs');
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>(availableCategories);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { addToast } = useToast();
  const [archiveConfirmSong, setArchiveConfirmSong] = useState<Song | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.content-anim-item', { opacity: 0, y: 14, duration: 0.35, stagger: 0.035 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    addToast({ type: type === 'error' ? 'error' : 'success', title: type === 'error' ? 'Error' : 'Success', message: text });
    setTimeout(() => setActionMsg(null), 3500);
  };

  const handleArchiveClick = (song: Song) => {
    if (song.is_archived) {
      handlePerformArchiveOrRestore(song);
    } else {
      setArchiveConfirmSong(song);
    }
  };

  const handlePerformArchiveOrRestore = async (song: Song) => {
    setArchiveConfirmSong(null);
    setLoadingId(song.id);
    const result = song.is_archived ? await restoreSong(song.id) : await archiveSong(song.id);
    setLoadingId(null);
    if (result?.error) {
      showMsg('error', result.error);
    } else {
      setSongs((prev) => prev.map((s) => (s.id === song.id ? { ...s, is_archived: !s.is_archived } : s)));
      showMsg('success', song.is_archived ? 'Song restored to repertoire.' : 'Song archived.');
    }
  };

  const handleFormSuccess = () => {
    showMsg('success', viewMode === 'create' ? 'Song created successfully!' : 'Song updated successfully!');
    setViewMode('list');
    setEditingSong(null);
    router.refresh();
  };

  const filteredSongs = songs.filter((s) => {
    if (!showArchived && s.is_archived) return false;
    if (showArchived && !s.is_archived) return false;
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

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
        {/* Alert banner */}
        {actionMsg && (
          <div className={`alert ${actionMsg.type === 'error' ? 'alert-error' : 'alert-success'} content-anim-item mb-5`}>
            <span>{actionMsg.text}</span>
          </div>
        )}

        {/* Tab Switcher */}
        {viewMode === 'list' && (
          <div className="content-anim-item songs-tab-bar">
            <button
              onClick={() => setActiveTab('songs')}
              className={`songs-tab-btn inline-flex items-center gap-2 !py-2 !px-4.5 !rounded-xl text-sm sm:text-[0.9rem] font-semibold cursor-pointer border-none transition-all ${
                activeTab === 'songs' ? '!bg-primary !text-white' : '!bg-transparent !text-muted'
              }`}
            >
              <Music size={16} />
              <span>Song Library</span>
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`songs-tab-btn inline-flex items-center gap-2 !py-2 !px-4.5 !rounded-xl text-sm sm:text-[0.9rem] font-semibold cursor-pointer border-none transition-all ${
                activeTab === 'categories' ? '!bg-primary !text-white' : '!bg-transparent !text-muted'
              }`}
            >
              <Tag size={16} />
              <span>Manage Categories ({categoriesList.length})</span>
            </button>
          </div>
        )}

        {/* Songs Tab */}
        {activeTab === 'songs' && (
          <>
            {viewMode === 'list' && (
              <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="content-anim-item flex justify-between items-end flex-wrap gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-[1.75rem] font-bold text-primary mb-1.5">Song Library</h2>
                    <p className="text-muted text-sm sm:text-base">Manage ChordPro lyrics and song catalogue</p>
                  </div>
                  <div className="flex gap-2.5 items-center">
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm"
                    >
                      {showArchived ? 'Show Active' : 'Show Archived'}
                    </button>
                    {/* Desktop-only — hidden on mobile, replaced by sticky FAB below */}
                    <button
                      onClick={() => setViewMode('create')}
                      className="btn btn-primary songs-desktop-create !py-2 !px-4.5 text-xs sm:text-sm"
                    >
                      + Add Song
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="content-anim-item">
                  <input
                    type="search"
                    className="input-field max-w-[420px]"
                    placeholder="Search by title, composer, or category tag…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Table */}
                <div className="glass-container content-anim-item p-6">
                  {filteredSongs.length === 0 ? (
                    <p className="text-muted text-center py-10">
                      {showArchived ? 'No archived songs.' : searchQuery ? 'No songs match your search.' : 'No songs yet — click "+ Add Song" to get started.'}
                    </p>
                  ) : (
                    <div className="table-container">
                      <table className="custom-table">
                        <thead>
                          <tr>
                            <th>Title</th>
                            <th>Composer</th>
                            <th>Categories</th>
                            <th>Lyrics</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSongs.map((song) => {
                            const tags = song.categories && song.categories.length > 0
                              ? song.categories
                              : song.category
                              ? [{ id: song.category, name: song.category }]
                              : [];

                            return (
                              <tr key={song.id}>
                                <td data-label="Title"><strong>{song.title}</strong></td>
                                <td data-label="Composer">{song.composer || <span className="text-muted">—</span>}</td>
                                <td data-label="Categories">
                                  {tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {tags.map((t) => (
                                        <span
                                          key={t.id}
                                          className="badge badge-pending !bg-primary/8 !text-primary text-xs !py-0.5 !px-2 !rounded-xl border border-primary/15"
                                        >
                                          {t.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted">—</span>
                                  )}
                                </td>
                                <td data-label="Lyrics">
                                  {song.lyrics ? (
                                    <span className="text-success text-xs sm:text-sm font-semibold">✓ ChordPro</span>
                                  ) : (
                                    <span className="text-muted text-xs sm:text-sm">None</span>
                                  )}
                                </td>
                                <td data-label="Actions">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => { setEditingSong(song); setViewMode('edit'); }}
                                      className="btn btn-secondary !py-1 !px-3 text-xs"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleArchiveClick(song)}
                                      disabled={loadingId === song.id}
                                      className={`btn btn-secondary !py-1 !px-3 text-xs ${
                                        song.is_archived
                                          ? '!text-primary !border-primary'
                                          : '!text-error !border-red-500/30'
                                      }`}
                                    >
                                      {loadingId === song.id ? '…' : song.is_archived ? 'Restore' : 'Archive'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(viewMode === 'create' || viewMode === 'edit') && (
              <div className="glass-container content-anim-item song-form-card">
                <SongForm
                  song={editingSong ?? undefined}
                  availableCategories={categoriesList}
                  onSuccess={handleFormSuccess}
                  onCancel={() => { setViewMode('list'); setEditingSong(null); }}
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
          </>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && viewMode === 'list' && (
          <div className="content-anim-item">
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

      {/* Mobile sticky FAB — thumb-reachable primary action on ≤768px */}
      {viewMode === 'list' && activeTab === 'songs' && (
        <button
          onClick={() => setViewMode('create')}
          className="btn btn-primary songs-mobile-fab"
          aria-label="Add new song"
        >
          + Add Song
        </button>
      )}
    </div>
  );
};
