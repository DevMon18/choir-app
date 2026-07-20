'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import {
  createSequence,
  updateSequence,
  deleteSequence,
  addSongToSequence,
  removeSongFromSequence,
  reorderSequenceItems,
  startLiveSession,
  endLiveSession,
  updateLiveSession,
  updateSequenceItemRole,
} from './actions';
import gsap from 'gsap';

interface Profile { id: string; full_name: string; role: string; }
interface Song { id: string; title: string; composer: string | null; category: string | null; lyrics?: string | null; }
interface SequenceItem { id: string; order_index: number; notes: string | null; role_in_mass: string | null; songs: Song; }
interface Sequence {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  sequence_items: SequenceItem[];
}
interface LiveSession {
  id: string;
  sequence_id: string | null;
  active_song_id: string | null;
  director_semitones: number;
  scroll_speed: number;
  is_active: boolean;
}

const MASS_ROLES = [
  { value: 'entrance', label: 'Entrance Song' },
  { value: 'kyrie', label: 'Kyrie (Lord, Have Mercy)' },
  { value: 'gloria', label: 'Gloria (Glory to God)' },
  { value: 'psalm', label: 'Responsorial Psalm' },
  { value: 'gospel', label: 'Gospel Acclamation (Alleluia)' },
  { value: 'offertory', label: 'Offertory Song (Preparation of the Gifts)' },
  { value: 'sanctus', label: 'Sanctus (Holy, Holy, Holy)' },
  { value: 'memorial', label: 'Memorial Acclamation' },
  { value: 'amen', label: 'Great Amen' },
  { value: 'agnus', label: 'Agnus Dei (Lamb of God)' },
  { value: 'communion', label: 'Communion Song' },
  { value: 'recessional', label: 'Recessional Song (Closing/Sending Forth)' },
];

const MASS_ROLE_LABELS: Record<string, string> = {
  entrance: 'Entrance Song',
  kyrie: 'Kyrie (Lord, Have Mercy)',
  gloria: 'Gloria (Glory to God)',
  psalm: 'Responsorial Psalm',
  gospel: 'Gospel Acclamation (Alleluia)',
  offertory: 'Offertory Song (Preparation of the Gifts)',
  sanctus: 'Sanctus (Holy, Holy, Holy)',
  memorial: 'Memorial Acclamation',
  amen: 'Great Amen',
  agnus: 'Agnus Dei (Lamb of God)',
  communion: 'Communion Song',
  recessional: 'Recessional Song (Closing/Sending Forth)',
};

interface Props {
  profile: Profile;
  sequences: Sequence[];
  songs: Song[];
  activeSession: LiveSession | null;
}

export const SequenceManagerClient = ({ profile, sequences: initSeqs, songs, activeSession: initSession }: Props) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [sequences, setSequences] = useState(initSeqs);
  const [activeSession, setActiveSession] = useState(initSession);
  const [selectedSeqId, setSelectedSeqId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSeq, setEditingSeq] = useState<Sequence | null>(null);
  const [addSongSeqId, setAddSongSeqId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, startTransition] = useTransition();
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [previewSong, setPreviewSong] = useState<Song | null>(null);

  // Sync state with server-side props on router.refresh()
  useEffect(() => {
    setSequences(initSeqs);
  }, [initSeqs]);

  useEffect(() => {
    setActiveSession(initSession);
  }, [initSession]);

  const isDirector = ['super_admin', 'director'].includes(profile.role);
  const canManage = ['super_admin', 'director', 'secretary'].includes(profile.role);

  const selectedSeq = sequences.find(s => s.id === selectedSeqId) ?? null;

  const filteredAvailableSongs = React.useMemo(() => {
    const q = songSearchQuery.toLowerCase();
    const currentSongIds = selectedSeq?.sequence_items.map(item => item.songs.id) ?? [];
    return songs.filter(s => {
      const notInSeq = !currentSongIds.includes(s.id);
      const matchesSearch = !q || s.title.toLowerCase().includes(q) || (s.composer || '').toLowerCase().includes(q);
      return notInSeq && matchesSearch;
    });
  }, [songs, selectedSeq, songSearchQuery]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.sidebar-item', { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.5, stagger: 0.07 });
      tl.fromTo('.content-anim-item', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, '<0.2');
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const flash = (msg: string, type: 'ok' | 'err') => {
    if (type === 'ok') setSuccess(msg); else setError(msg);
    setTimeout(() => { setSuccess(''); setError(''); }, 3500);
  };

  const handleSetRoleInMass = async (itemId: string, role: string) => {
    startTransition(async () => {
      const res = await updateSequenceItemRole(itemId, role);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Song labeled!', 'ok');
        router.refresh();
      }
    });
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createSequence(fd);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Sequence created!', 'ok');
        setShowCreateForm(false);
        router.refresh();
      }
    });
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSeq) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSequence(editingSeq.id, fd);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Sequence updated!', 'ok');
        setEditingSeq(null);
        router.refresh();
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this sequence? This cannot be undone.')) return;
    startTransition(async () => {
      const res = await deleteSequence(id);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Deleted.', 'ok');
        if (selectedSeqId === id) setSelectedSeqId(null);
        router.refresh();
      }
    });
  };

  const handleAddSong = async (songId: string) => {
    if (!addSongSeqId) return;
    startTransition(async () => {
      const res = await addSongToSequence(addSongSeqId, songId);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Song added!', 'ok');
        setAddSongSeqId(null);
        router.refresh();
      }
    });
  };

  const handleRemoveSong = async (itemId: string) => {
    startTransition(async () => {
      const res = await removeSongFromSequence(itemId);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Song removed.', 'ok');
        router.refresh();
      }
    });
  };

  const handleMoveItem = async (seq: Sequence, itemId: string, direction: 'up' | 'down') => {
    const sorted = [...seq.sequence_items].sort((a, b) => a.order_index - b.order_index);
    const idx = sorted.findIndex(i => i.id === itemId);
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === sorted.length - 1) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    [sorted[idx].order_index, sorted[swap].order_index] = [sorted[swap].order_index, sorted[idx].order_index];
    startTransition(async () => {
      await reorderSequenceItems(sorted.map(i => ({ id: i.id, order_index: i.order_index })));
      router.refresh();
    });
  };

  const handleStartSession = async (seq: Sequence) => {
    const sorted = [...seq.sequence_items].sort((a, b) => a.order_index - b.order_index);
    const firstSong = sorted[0]?.songs?.id ?? null;
    startTransition(async () => {
      const res = await startLiveSession(seq.id, firstSong);
      if (res?.error) flash(res.error, 'err');
      else {
        router.push('/live');
      }
    });
  };

  const handleEndSession = async () => {
    if (!activeSession) return;
    startTransition(async () => {
      const res = await endLiveSession(activeSession.id);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Session ended.', 'ok');
        setActiveSession(null);
        router.refresh();
      }
    });
  };

  const handleSetActiveSong = async (songId: string) => {
    if (!activeSession) return;
    startTransition(async () => {
      await updateLiveSession(activeSession.id, { active_song_id: songId });
      router.refresh();
    });
  };

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={profile} />

      <main className="admin-content-full">
          {/* Alerts */}
          {error && <div className="alert alert-error content-anim-item">{error}</div>}
          {success && <div className="alert alert-success content-anim-item">{success}</div>}

          {/* Active Live Session Banner */}
          {activeSession && (
            <div className="alert alert-info content-anim-item" style={{ marginBottom: '24px', alignItems: 'flex-start', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                <span style={{ fontSize: '1.2rem' }}>🔴</span>
                <strong>Live Session Active</strong>
                <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  Go to <Link href="/live" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' }}>/live</Link> to view lyrics & control transposition
                </span>
              </div>
              {isDirector && (
                <button onClick={handleEndSession} className="btn" style={{ background: 'var(--error)', color: '#fff', border: 'none', minHeight: '44px', padding: '10px 20px', fontSize: '0.9rem' }} disabled={isPending}>
                  End Session
                </button>
              )}
            </div>
          )}

          {/* Header */}
          <div className="content-anim-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)' }}>Mass Sequences</h1>
              <p style={{ color: 'var(--muted)', marginTop: '4px' }}>Build and manage setlists for Mass and rehearsals.</p>
            </div>
            {canManage && (
              <button onClick={() => setShowCreateForm(p => !p)} className="btn btn-primary" style={{ minHeight: '48px' }} disabled={isPending}>
                + New Sequence
              </button>
            )}
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="glass-container content-anim-item" style={{ marginBottom: '24px' }}>
              <h2 style={{ fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>New Sequence</h2>
              <form onSubmit={handleCreate}>
                <div className="input-group">
                  <label className="input-label">Title *</label>
                  <input name="title" className="input-field" required placeholder="e.g. Sunday 9AM Mass" />
                </div>
                <div className="input-group">
                  <label className="input-label">Description</label>
                  <input name="description" className="input-field" placeholder="Optional notes" />
                </div>
                <div className="input-group">
                  <label className="input-label">Scheduled Date & Time</label>
                  <input name="scheduled_at" type="datetime-local" className="input-field" />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="submit" className="btn btn-primary" disabled={isPending} style={{ minHeight: '48px' }}>Create</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreateForm(false)} style={{ minHeight: '48px' }}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Sequences list */}
          {sequences.length === 0 ? (
            <div className="glass-container content-anim-item" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🎵</div>
              <p style={{ color: 'var(--muted)' }}>No sequences yet. Create one to get started!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {sequences.map((seq) => {
                const sorted = [...seq.sequence_items].sort((a, b) => a.order_index - b.order_index);
                const isSelected = selectedSeqId === seq.id;
                return (
                  <div key={seq.id} className="glass-container content-anim-item" style={{ padding: '24px' }}>
                    {/* Sequence header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: isSelected ? '20px' : '0' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setSelectedSeqId(isSelected ? null : seq.id)}>
                          {seq.title}
                        </h3>
                        {seq.description && <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '4px' }}>{seq.description}</p>}
                        {seq.scheduled_at && (
                          <p style={{ color: 'var(--accent)', fontSize: '0.82rem', marginTop: '6px', fontWeight: 600 }}>
                            🗓 {new Date(seq.scheduled_at).toLocaleString()}
                          </p>
                        )}
                        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                          {seq.sequence_items.length} song{seq.sequence_items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {isDirector && (
                          <button
                            onClick={() => {
                              if (activeSession && activeSession.sequence_id === seq.id) {
                                router.push('/live');
                              } else {
                                handleStartSession(seq);
                              }
                            }}
                            className="btn btn-primary"
                            style={{
                              minHeight: '44px',
                              padding: '8px 16px',
                              fontSize: '0.85rem',
                              background: activeSession && activeSession.sequence_id === seq.id
                                ? 'var(--success)'
                                : activeSession
                                ? 'var(--warning)'
                                : undefined
                            }}
                            disabled={isPending}
                          >
                            {activeSession && activeSession.sequence_id === seq.id
                              ? '▶ View Live'
                              : activeSession
                              ? '⚠ Override Active'
                              : '▶ Go Live'}
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button onClick={() => setEditingSeq(seq)} className="btn btn-secondary" style={{ minHeight: '44px', padding: '8px 14px', fontSize: '0.82rem' }}>Edit</button>
                            <button onClick={() => handleDelete(seq.id)} className="btn btn-secondary" style={{ minHeight: '44px', padding: '8px 14px', fontSize: '0.82rem', color: 'var(--error)' }} disabled={isPending}>Delete</button>
                          </>
                        )}
                        <button onClick={() => setSelectedSeqId(isSelected ? null : seq.id)} className="btn btn-secondary" style={{ minHeight: '44px', padding: '8px 14px', fontSize: '0.82rem' }}>
                          {isSelected ? '▲ Hide' : '▼ Songs'}
                        </button>
                      </div>
                    </div>

                    {/* Song list */}
                    {isSelected && (
                      <div>
                        {sorted.length === 0 ? (
                          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '16px' }}>No songs in this sequence yet.</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            {sorted.map((item, idx) => (
                              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(30,58,138,0.03)', borderRadius: '10px', padding: '12px 14px', flexWrap: 'wrap' }}>
                                <span style={{ color: 'var(--muted)', fontSize: '0.8rem', fontWeight: 700, minWidth: '24px' }}>{idx + 1}</span>
                                <div style={{ flex: 1, minWidth: '180px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <div
                                        onClick={() => setPreviewSong(item.songs)}
                                        style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.95rem', cursor: 'pointer', textDecoration: 'underline' }}
                                        title="Click to view lyrics & chords"
                                    >
                                      {item.songs.title}
                                    </div>
                                    {item.role_in_mass && (
                                      <span className="badge badge-approved" style={{ fontSize: '0.65rem', padding: '2px 8px', background: 'rgba(11,77,36,0.07)', color: 'var(--primary)', textTransform: 'none' }}>
                                        {MASS_ROLE_LABELS[item.role_in_mass] || item.role_in_mass}
                                      </span>
                                    )}
                                  </div>
                                  {item.songs.composer && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{item.songs.composer}</div>}
                                </div>
                                {canManage && (
                                  <select
                                    value={item.role_in_mass || ''}
                                    onChange={(e) => handleSetRoleInMass(item.id, e.target.value)}
                                    disabled={isPending}
                                    style={{
                                      background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                                      padding: '4px 8px', fontSize: '0.78rem', outline: 'none', color: 'var(--muted)',
                                      maxWidth: '160px', minHeight: '32px'
                                    }}
                                  >
                                    <option value="">-- Label Song --</option>
                                    {MASS_ROLES.map(r => (
                                      <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                  </select>
                                )}
                                {activeSession?.sequence_id === seq.id && isDirector && (
                                  <button
                                    onClick={() => handleSetActiveSong(item.songs.id)}
                                    className="btn"
                                    style={{
                                      minHeight: '36px', padding: '4px 12px', fontSize: '0.75rem',
                                      background: activeSession.active_song_id === item.songs.id ? 'var(--success)' : 'var(--primary)',
                                      color: '#fff', border: 'none',
                                    }}
                                    disabled={isPending}
                                  >
                                    {activeSession.active_song_id === item.songs.id ? '▶ Active' : 'Set Active'}
                                  </button>
                                )}
                                {canManage && (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button onClick={() => handleMoveItem(seq, item.id, 'up')} disabled={idx === 0 || isPending} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.8rem' }} aria-label="Move up">↑</button>
                                    <button onClick={() => handleMoveItem(seq, item.id, 'down')} disabled={idx === sorted.length - 1 || isPending} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.8rem' }} aria-label="Move down">↓</button>
                                    <button onClick={() => handleRemoveSong(item.id)} disabled={isPending} style={{ background: 'none', border: '1px solid var(--error)', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--error)' }} aria-label="Remove">×</button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {canManage && (
                          <div>
                            <button onClick={() => setAddSongSeqId(addSongSeqId === seq.id ? null : seq.id)} className="btn btn-secondary" style={{ minHeight: '44px', fontSize: '0.85rem' }}>
                              + Add Song
                            </button>
                            {addSongSeqId === seq.id && (
                              <div style={{ marginTop: '12px' }}>
                                {/* Song search input */}
                                <div style={{ position: 'relative', marginBottom: '12px' }}>
                                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                    <circle cx="9" cy="9" r="7" /><path strokeLinecap="round" d="m15 15 4 4" />
                                  </svg>
                                  <input
                                    type="text"
                                    placeholder="Search song to add..."
                                    className="input-field"
                                    value={songSearchQuery}
                                    onChange={(e) => setSongSearchQuery(e.target.value)}
                                    style={{ paddingLeft: '30px', height: '36px', minHeight: '36px', fontSize: '0.85rem', width: '100%' }}
                                  />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                                  {filteredAvailableSongs.length === 0 ? (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', padding: '10px' }}>No songs found matching your search.</p>
                                  ) : (
                                    filteredAvailableSongs.map(song => (
                                      <button key={song.id} onClick={() => { handleAddSong(song.id); setSongSearchQuery(''); }} disabled={isPending}
                                        style={{ background: 'rgba(30,58,138,0.05)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s', minHeight: '48px', width: '100%' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,58,138,0.1)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,58,138,0.05)')}
                                      >
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--primary)' }}>{song.title}</div>
                                        {song.composer && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{song.composer}</div>}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit Modal */}
          {editingSeq && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setEditingSeq(null)}>
              <div style={{ background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.12)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(11, 77, 36, 0.25)', maxWidth: '480px', width: '100%', padding: '32px' }} onClick={e => e.stopPropagation()}>
                <h2 style={{ fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>Edit Sequence</h2>
                <form onSubmit={handleUpdate}>
                  <div className="input-group">
                    <label className="input-label">Title *</label>
                    <input name="title" className="input-field" required defaultValue={editingSeq.title} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Description</label>
                    <input name="description" className="input-field" defaultValue={editingSeq.description ?? ''} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Scheduled Date & Time</label>
                    <input name="scheduled_at" type="datetime-local" className="input-field" defaultValue={editingSeq.scheduled_at?.slice(0, 16) ?? ''} />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button type="submit" className="btn btn-primary" disabled={isPending} style={{ minHeight: '48px' }}>Save</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingSeq(null)} style={{ minHeight: '48px' }}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Song Lyrics Preview Modal */}
          {previewSong && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setPreviewSong(null)}>
              <div style={{ background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.12)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(11, 77, 36, 0.25)', maxWidth: '640px', width: '100%', padding: '32px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    {previewSong.category && (
                      <span style={{ display: 'inline-block', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', background: 'rgba(180,83,9,0.06)', padding: '2px 8px', borderRadius: '99px', border: '1px solid rgba(180,83,9,0.2)', marginBottom: '6px' }}>
                        {previewSong.category}
                      </span>
                    )}
                    <h2 style={{ fontWeight: 700, color: 'var(--primary)', margin: 0 }}>{previewSong.title}</h2>
                    {previewSong.composer && <p style={{ color: 'var(--muted)', fontSize: '0.82rem', margin: '4px 0 0' }}>by {previewSong.composer}</p>}
                  </div>
                  <button onClick={() => setPreviewSong(null)} className="btn btn-secondary" style={{ minWidth: '40px', padding: '8px' }}>✕</button>
                </div>
                
                <div style={{ background: 'rgba(30,58,138,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
                  {previewSong.lyrics ? (
                    <ChordProRenderer
                      lyrics={previewSong.lyrics}
                      semitones={0}
                      fontSize={15}
                      showChords={true}
                    />
                  ) : (
                    <p style={{ color: 'var(--muted)', textAlign: 'center', margin: '20px 0' }}>No lyrics available for this song.</p>
                  )}
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
};

export default SequenceManagerClient;
