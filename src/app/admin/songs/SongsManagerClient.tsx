'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { archiveSong, restoreSong } from './actions';
import { SongForm } from './SongForm';
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
  lyrics: string | null;
  is_archived: boolean;
  created_at: string;
}

interface SongsManagerClientProps {
  currentUserProfile: Profile;
  initialSongs: Song[];
}

type ViewMode = 'list' | 'create' | 'edit';

export const SongsManagerClient = ({ currentUserProfile, initialSongs }: SongsManagerClientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [songs, setSongs] = useState<Song[]>(initialSongs);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.sidebar-item', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.08 });
      tl.fromTo('.content-anim-item', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }, '-=0.3');
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 3500);
  };

  const handleArchive = async (song: Song) => {
    setLoadingId(song.id);
    const result = song.is_archived ? await restoreSong(song.id) : await archiveSong(song.id);
    setLoadingId(null);
    if (result?.error) {
      showMsg('error', result.error);
    } else {
      setSongs((prev) => prev.map((s) => s.id === song.id ? { ...s, is_archived: !s.is_archived } : s));
      showMsg('success', song.is_archived ? 'Song restored to repertoire.' : 'Song archived.');
    }
  };

  const handleFormSuccess = (id: string) => {
    showMsg('success', viewMode === 'create' ? 'Song created successfully!' : 'Song updated successfully!');
    setViewMode('list');
    setEditingSong(null);
    // Reload songs list — page will re-fetch on next navigation; for now optimistic update is enough
    // A full refresh would require router.refresh() but we keep optimistic for UX
  };

  const filteredSongs = songs.filter((s) => {
    if (!showArchived && s.is_archived) return false;
    if (showArchived && !s.is_archived) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      (s.composer ?? '').toLowerCase().includes(q) ||
      (s.category ?? '').toLowerCase().includes(q)
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
                  placeholder="Search by title, composer, or category…"
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
                          <th>Category</th>
                          <th>Lyrics</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSongs.map((song) => (
                          <tr key={song.id}>
                            <td data-label="Title"><strong>{song.title}</strong></td>
                            <td data-label="Composer">{song.composer || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                            <td data-label="Category">
                              {song.category ? (
                                <span className="badge badge-pending" style={{ background: 'rgba(30,58,138,0.06)', color: 'var(--primary)' }}>{song.category}</span>
                              ) : <span style={{ color: 'var(--muted)' }}>—</span>}
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
                                  onClick={() => handleArchive(song)}
                                  className="btn btn-secondary"
                                  disabled={loadingId === song.id}
                                  style={{
                                    padding: '4px 12px',
                                    fontSize: '0.8rem',
                                    color: song.is_archived ? 'var(--success)' : 'var(--error)',
                                    borderColor: song.is_archived ? 'var(--success)' : 'var(--error)',
                                  }}
                                >
                                  {loadingId === song.id ? '…' : song.is_archived ? 'Restore' : 'Archive'}
                                </button>
                                <Link
                                  href={`/repertoire/${song.id}`}
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                                  target="_blank"
                                >
                                  Preview ↗
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {(viewMode === 'create' || viewMode === 'edit') && (
            <div className="glass-container content-anim-item" style={{ padding: '30px' }}>
              <SongForm
                song={editingSong ?? undefined}
                onSuccess={handleFormSuccess}
                onCancel={() => { setViewMode('list'); setEditingSong(null); }}
              />
            </div>
          )}
      </main>
    </div>
  );
};

export default SongsManagerClient;
