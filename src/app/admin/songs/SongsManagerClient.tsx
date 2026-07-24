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
      tl.fromTo('.content-anim-item', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 });
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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
        {/* Alert banner */}
        {actionMsg && (
          <div className={`alert ${actionMsg.type === 'error' ? 'alert-error' : 'alert-success'} content-anim-item`} style={{ marginBottom: '20px' }}>
            <span>{actionMsg.text}</span>
          </div>
        )}

        {/* Tab Switcher */}
        {viewMode === 'list' && (
          <div
            className="content-anim-item"
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--glass-border)',
              paddingBottom: '12px',
            }}
          >
            <button
              onClick={() => setActiveTab('songs')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'songs' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'songs' ? '#ffffff' : 'var(--muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <Music size={16} />
              <span>Song Library</span>
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'categories' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'categories' ? '#ffffff' : 'var(--muted)',
                transition: 'all 0.15s ease',
              }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Header */}
                <div className="content-anim-item" style={{ opacity: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px' }}>Song Library</h2>
                    <p style={{ color: 'var(--muted)' }}>Manage ChordPro lyrics and song catalogue</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      {showArchived ? 'Show Active' : 'Show Archived'}
                    </button>
                    <button
                      onClick={() => setViewMode('create')}
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                    >
                      + Add Song
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="content-anim-item" style={{ opacity: 0 }}>
                  <input
                    type="search"
                    className="input-field"
                    placeholder="Search by title, composer, or category tag…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ maxWidth: '420px' }}
                  />
                </div>

                {/* Table */}
                <div className="glass-container content-anim-item" style={{ padding: '24px', opacity: 0 }}>
                  {filteredSongs.length === 0 ? (
                    <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
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
                                <td data-label="Composer">{song.composer || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                                <td data-label="Categories">
                                  {tags.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                      {tags.map((t) => (
                                        <span
                                          key={t.id}
                                          className="badge badge-pending"
                                          style={{
                                            background: 'rgba(30,58,138,0.08)',
                                            color: 'var(--primary)',
                                            fontSize: '0.75rem',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            border: '1px solid rgba(30,58,138,0.15)',
                                          }}
                                        >
                                          {t.name}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--muted)' }}>—</span>
                                  )}
                                </td>
                                <td data-label="Lyrics">
                                  {song.lyrics ? (
                                    <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>✓ ChordPro</span>
                                  ) : (
                                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>None</span>
                                  )}
                                </td>
                                <td data-label="Actions">
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                      onClick={() => { setEditingSong(song); setViewMode('edit'); }}
                                      className="btn btn-secondary"
                                      style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleArchiveClick(song)}
                                      disabled={loadingId === song.id}
                                      className="btn btn-secondary"
                                      style={{
                                        padding: '4px 12px',
                                        fontSize: '0.8rem',
                                        color: song.is_archived ? 'var(--primary)' : 'var(--error)',
                                        borderColor: song.is_archived ? 'var(--primary)' : 'rgba(239,68,68,0.3)',
                                      }}
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
              <div className="glass-container content-anim-item" style={{ padding: '32px' }}>
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
    </div>
  );
};
