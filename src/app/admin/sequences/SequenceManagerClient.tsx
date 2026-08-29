'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import { createClient } from '@/lib/supabase/client';
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
import { ConfirmModal } from '@/components/ConfirmModal';
import { SongPickerInline } from './SongPickerInline';
import { CategoryItem } from '@/app/admin/categories/actions';
import gsap from 'gsap';

interface Profile { id: string; full_name: string; role: string; }
interface Song { id: string; title: string; composer: string | null; category: string | null; categories?: { id: string; name: string }[]; lyrics?: string | null; }
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
  entrance: 'Entrance',
  kyrie: 'Kyrie',
  gloria: 'Gloria',
  psalm: 'Responsorial Psalm',
  gospel: 'Gospel Acclamation',
  offertory: 'Offertory',
  sanctus: 'Sanctus',
  memorial: 'Memorial Acclamation',
  amen: 'Great Amen',
  agnus: 'Lamb of God',
  communion: 'Communion',
  recessional: 'Recessional',
  lords_prayer: "Lord's Prayer",
};

interface Props {
  profile: Profile;
  sequences: Sequence[];
  songs: Song[];
  availableCategories?: CategoryItem[];
  activeSession: LiveSession | null;
}

export const SequenceManagerClient = ({ profile, sequences: initSeqs, songs, availableCategories = [], activeSession: initSession }: Props) => {
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

    const supabase = createClient();
    const fetchLatestActiveSession = async () => {
      const { data } = await supabase
        .from('live_sessions')
        .select('id, sequence_id, active_song_id, director_semitones, scroll_speed, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveSession(data || null);
    };

    fetchLatestActiveSession();

    const channel = supabase
      .channel('admin-live-sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => {
        fetchLatestActiveSession();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      tl.from('.content-anim-item', { opacity: 0, y: 14, duration: 0.35, stagger: 0.035 });
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

  const [confirmDeleteSeq, setConfirmDeleteSeq] = useState<Sequence | null>(null);

  const handleDeleteClick = (seq: Sequence) => {
    setConfirmDeleteSeq(seq);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteSeq) return;
    const id = confirmDeleteSeq.id;
    setConfirmDeleteSeq(null);
    startTransition(async () => {
      const res = await deleteSequence(id);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Deleted sequence.', 'ok');
        if (selectedSeqId === id) setSelectedSeqId(null);
        router.refresh();
      }
    });
  };

  const handleAddSong = async (songId: string, roleInMass?: string) => {
    if (!addSongSeqId) return;
    startTransition(async () => {
      const res = await addSongToSequence(addSongSeqId, songId, roleInMass);
      if (res?.error) flash(res.error, 'err');
      else {
        flash('Song added!', 'ok');
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
        if (res?.session) setActiveSession(res.session);
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
    <div ref={containerRef} className="flex flex-col min-h-screen">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={profile} />

      <main className="admin-content-full !py-7 !px-5 !pb-12 max-w-[1040px] mx-auto w-full relative z-[1]">
        {/* Alerts */}
        {error && <div className="alert alert-error content-anim-item">{error}</div>}
        {success && <div className="alert alert-success content-anim-item">{success}</div>}

        {/* Active Live Session Status Pill Bar */}
        {activeSession && (
          <div className="glass-container mb-5 py-3 px-4.5 bg-red-500/5 border border-red-500/25 rounded-2xl flex items-center justify-between gap-3 flex-wrap shadow-lg shadow-red-500/10 opacity-100">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg">🔴</span>
              <div className="flex items-center gap-2 flex-wrap">
                <strong className="text-red-800 text-sm font-bold">Live Session Active</strong>
                <span className="text-xs text-red-900">
                  • <Link href="/live" className="text-primary font-bold underline">Control Screen (/live)</Link>
                </span>
              </div>
            </div>
            {canManage && (
              <button
                onClick={handleEndSession}
                className="btn !bg-error text-white border-none min-h-[38px] !py-1.5 !px-4 text-xs !rounded-xl font-bold cursor-pointer shadow-md shadow-red-500/25"
                disabled={isPending}
              >
                End Session
              </button>
            )}
          </div>
        )}

        {/* Header */}
        <div className="content-anim-item flex justify-between items-start flex-wrap gap-3 mb-7">
          <div>
            <h1 className="text-2xl sm:text-[1.8rem] font-bold text-primary">Mass Sequences</h1>
            <p className="text-muted text-sm sm:text-base mt-1">Build and manage setlists for Mass and rehearsals.</p>
          </div>
          {canManage && (
            <button onClick={() => setShowCreateForm(p => !p)} className="btn btn-primary min-h-[48px]" disabled={isPending}>
              + New Sequence
            </button>
          )}
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="glass-container content-anim-item mb-6">
            <h2 className="font-bold mb-5 text-primary text-xl">New Sequence</h2>
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
              <div className="flex gap-3 mt-2">
                <button type="submit" className="btn btn-primary min-h-[48px]" disabled={isPending}>Create</button>
                <button type="button" className="btn btn-secondary min-h-[48px]" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Sequences list */}
        {sequences.length === 0 ? (
          <div className="glass-container content-anim-item text-center py-15 px-5">
            <div className="text-5xl mb-3">🎵</div>
            <p className="text-muted">No sequences yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {sequences.map((seq) => {
              const sorted = [...seq.sequence_items].sort((a, b) => a.order_index - b.order_index);
              const isSelected = selectedSeqId === seq.id;
              return (
                <div key={seq.id} className="glass-container content-anim-item p-6">
                  {/* Sequence header */}
                  <div className={`flex justify-between items-start flex-wrap gap-3 ${isSelected ? 'mb-5' : 'mb-0'}`}>
                    <div className="flex-1">
                      <h3 className="text-base sm:text-[1.15rem] font-bold text-primary cursor-pointer" onClick={() => setSelectedSeqId(isSelected ? null : seq.id)}>
                        {seq.title}
                      </h3>
                      {seq.description && <p className="text-muted text-sm mt-1">{seq.description}</p>}
                      {seq.scheduled_at && (
                        <p className="text-accent text-xs mt-1.5 font-semibold">
                          🗓 {new Date(seq.scheduled_at).toLocaleString()}
                        </p>
                      )}
                      <p className="text-muted text-xs mt-1">
                        {seq.sequence_items.length} song{seq.sequence_items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="seq-card-actions flex gap-1.5 flex-wrap items-center">
                      {isDirector && (
                        <button
                          onClick={() => {
                            if (activeSession && activeSession.sequence_id === seq.id) {
                              router.push('/live');
                            } else {
                              handleStartSession(seq);
                            }
                          }}
                          className={`btn btn-primary min-h-[42px] !py-1.5 !px-4 text-xs sm:text-sm ${
                            activeSession && activeSession.sequence_id === seq.id
                              ? '!bg-success'
                              : activeSession
                              ? '!bg-warning'
                              : ''
                          }`}
                          disabled={isPending}
                        >
                          {activeSession && activeSession.sequence_id === seq.id
                            ? '▶ View Live'
                            : activeSession
                            ? '⚠ Override Active'
                            : '▶ Go Live'}
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedSeqId(isSelected ? null : seq.id)}
                        className="btn btn-secondary min-h-[42px] !py-1.5 !px-3.5 text-xs font-semibold"
                      >
                        {isSelected ? '▲ Hide' : `▼ ${seq.sequence_items.length} ${seq.sequence_items.length === 1 ? 'Song' : 'Songs'}`}
                      </button>
                      {canManage && (
                        <>
                          <button onClick={() => setEditingSeq(seq)} className="btn btn-secondary min-h-[42px] !py-1.5 !px-3 text-xs">Edit</button>
                          <button onClick={() => handleDeleteClick(seq)} className="btn btn-secondary min-h-[42px] !py-1.5 !px-3 text-xs text-error" disabled={isPending}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Song list */}
                  {isSelected && (
                    <div>
                      {sorted.length === 0 ? (
                        <p className="text-muted text-sm sm:text-base mb-4">No songs in this sequence yet.</p>
                      ) : (
                        <div className="flex flex-col gap-2 mb-4">
                          {sorted.map((item, idx) => (
                            <div
                              key={item.id}
                              className="seq-song-row flex items-center gap-2.5 bg-white border border-black/6 rounded-xl p-2.5 sm:py-2.5 sm:px-3.5 flex-wrap shadow-sm"
                            >
                              <span className="text-muted text-xs font-bold min-w-[20px]">{idx + 1}</span>
                              <div className="flex-[1_1_160px] min-w-[140px] flex flex-col gap-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div
                                    onClick={() => setPreviewSong(item.songs)}
                                    className="font-bold text-primary text-sm cursor-pointer"
                                    title="Click to view lyrics & chords"
                                  >
                                    {item.songs.title}
                                  </div>
                                  {(() => {
                                    const rawRole = item.role_in_mass
                                      ? (MASS_ROLE_LABELS[item.role_in_mass] || item.role_in_mass)
                                      : (item.songs.categories && item.songs.categories.length > 0
                                        ? item.songs.categories[0].name
                                        : item.songs.category || null);
                                    if (!rawRole) return null;
                                    const cleanRole = (MASS_ROLE_LABELS[rawRole.toLowerCase()] || rawRole).replace(/\s*\([^)]*\)/g, '');
                                    return (
                                      <span className="badge text-[0.64rem] py-0.5 px-2 bg-primary/8 text-primary font-bold uppercase rounded-xl whitespace-nowrap">
                                        {cleanRole}
                                      </span>
                                    );
                                  })()}
                                </div>
                                {item.songs.composer && <div className="text-xs text-muted">{item.songs.composer}</div>}
                              </div>

                              <div className="flex items-center gap-1.5 ml-auto">
                                {activeSession?.sequence_id === seq.id && isDirector && (
                                  <button
                                    onClick={() => handleSetActiveSong(item.songs.id)}
                                    className={`btn min-h-[34px] !py-1 !px-2.5 text-xs rounded-lg text-white border-none ${
                                      activeSession.active_song_id === item.songs.id ? '!bg-success' : '!bg-primary'
                                    }`}
                                    disabled={isPending}
                                  >
                                    {activeSession.active_song_id === item.songs.id ? '▶ Active' : 'Set Active'}
                                  </button>
                                )}
                                {canManage && (
                                  <div className="flex gap-1.5 items-center">
                                    <div className="inline-flex bg-black/4 border border-black/8 rounded-lg overflow-hidden">
                                      <button onClick={() => handleMoveItem(seq, item.id, 'up')} disabled={idx === 0 || isPending} className="bg-transparent border-none border-r border-black/8 w-9 h-9 cursor-pointer text-xs sm:text-sm flex items-center justify-center" aria-label="Move up" title="Move up">↑</button>
                                      <button onClick={() => handleMoveItem(seq, item.id, 'down')} disabled={idx === sorted.length - 1 || isPending} className="bg-transparent border-none w-9 h-9 cursor-pointer text-xs sm:text-sm flex items-center justify-center" aria-label="Move down" title="Move down">↓</button>
                                    </div>
                                    <button onClick={() => handleRemoveSong(item.id)} disabled={isPending} className="bg-red-500/8 border border-red-500/20 rounded-lg w-9 h-9 cursor-pointer text-xs sm:text-sm text-error flex items-center justify-center" aria-label="Remove song" title="Remove song">✕</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {canManage && (
                        <div>
                          <button
                            onClick={() => setAddSongSeqId(addSongSeqId === seq.id ? null : seq.id)}
                            className={`btn w-full min-h-[48px] text-sm sm:text-[0.88rem] font-bold border-[1.5px] border-dashed border-primary/25 rounded-xl mt-2 ${
                              addSongSeqId === seq.id ? 'bg-black/4 text-primary' : 'bg-primary/3 text-primary'
                            }`}
                          >
                            {addSongSeqId === seq.id ? '✕ Close Repertoire Songbook' : '+ Add Song to Setlist'}
                          </button>

                          {addSongSeqId === seq.id && (
                            <SongPickerInline
                              songs={songs}
                              availableCategories={availableCategories}
                              existingSongIds={seq.sequence_items.map(item => item.songs.id)}
                              sequenceTitle={seq.title}
                              onAddSong={handleAddSong}
                              onClose={() => setAddSongSeqId(null)}
                              isPending={isPending}
                            />
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
          <div className="fixed inset-0 z-[999999] flex items-center justify-center pt-19 px-4 pb-21 bg-black/50 backdrop-blur-md" onClick={() => setEditingSeq(null)}>
            <div className="bg-white border border-primary/12 rounded-3xl shadow-2xl shadow-primary/25 max-w-[480px] w-full p-6 sm:py-6 sm:px-7 max-h-[calc(100vh-160px)] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="font-bold mb-5 text-primary text-xl">Edit Sequence</h2>
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
                <div className="flex gap-3 mt-4">
                  <button type="submit" className="btn btn-primary min-h-[48px] flex-1" disabled={isPending}>Save</button>
                  <button type="button" className="btn btn-secondary min-h-[48px] flex-1" onClick={() => setEditingSeq(null)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Song Lyrics Preview Modal */}
        {previewSong && (
          <div className="fixed inset-0 z-[999999] flex items-center justify-center pt-19 px-4 pb-21 bg-black/50 backdrop-blur-md" onClick={() => setPreviewSong(null)}>
            <div className="bg-white border border-primary/12 rounded-3xl shadow-2xl shadow-primary/25 max-w-[640px] w-full p-6 sm:py-6 sm:px-7 max-h-[calc(100vh-160px)] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start gap-4 mb-5">
                <div>
                  {(previewSong.categories && previewSong.categories.length > 0
                    ? previewSong.categories
                    : previewSong.category
                    ? [{ id: previewSong.category, name: previewSong.category }]
                    : []
                  ).map((cat: any) => (
                    <span key={cat.id || cat.name} className="inline-block text-[0.65rem] font-bold uppercase tracking-wider text-accent bg-amber-700/6 py-0.5 px-2 rounded-full border border-amber-700/20 mb-1.5 mr-1">
                      {cat.name}
                    </span>
                  ))}
                  <h2 className="font-bold text-primary m-0 text-xl">{previewSong.title}</h2>
                  {previewSong.composer && <p className="text-muted text-xs mt-1 mb-0">by {previewSong.composer}</p>}
                </div>
                <button onClick={() => setPreviewSong(null)} className="btn btn-secondary min-w-[44px] min-h-[44px] !p-2 !rounded-full flex items-center justify-center">✕</button>
              </div>
              
              <div className="bg-primary/2 border border-glass-border rounded-xl p-5 overflow-x-auto">
                {previewSong.lyrics ? (
                  <ChordProRenderer
                    lyrics={previewSong.lyrics}
                    semitones={0}
                    fontSize={15}
                    showChords={true}
                  />
                ) : (
                  <p className="text-muted text-center my-5">No lyrics available for this song.</p>
                )}
              </div>
            </div>
          </div>
        )}
        {confirmDeleteSeq && (
          <ConfirmModal
            title="Delete Sequence"
            message={`Are you sure you want to delete sequence "${confirmDeleteSeq.title}"? This action cannot be undone.`}
            confirmLabel="Yes, Delete"
            isDanger
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmDeleteSeq(null)}
          />
        )}
      </main>
    </div>
  );
};

export default SequenceManagerClient;
