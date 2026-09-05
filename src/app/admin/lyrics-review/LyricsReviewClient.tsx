'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ReviewSubmissionItem, approveLyricsSubmission, rejectLyricsSubmission } from './actions';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import { useToast } from '@/components/Toast';
import {
  Sparkles, CheckCircle, XCircle, Search, Clock, Award, Music,
  User, Eye, EyeOff, AlertCircle, Check, X, BookOpen, Filter, ArrowUpDown
} from 'lucide-react';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface LyricsReviewClientProps {
  currentUserProfile: Profile;
  initialSubmissions: ReviewSubmissionItem[];
  initialError?: string;
}

export const LyricsReviewClient = ({
  currentUserProfile,
  initialSubmissions,
  initialError,
}: LyricsReviewClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const [submissions, setSubmissions] = useState<ReviewSubmissionItem[]>(initialSubmissions);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMassPartFilter, setSelectedMassPartFilter] = useState('ALL');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Expanded lyric preview for full inspection
  const [inspectSubmission, setInspectSubmission] = useState<ReviewSubmissionItem | null>(null);

  // Reject dialog state
  const [rejectingItem, setRejectingItem] = useState<ReviewSubmissionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  useEffect(() => {
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.anim-header', { opacity: 0, y: 15, duration: 0.4, ease: 'power2.out' });
      gsap.from('.anim-card', { opacity: 0, y: 15, duration: 0.4, stagger: 0.06, ease: 'power2.out' });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleApprove = async (sub: ReviewSubmissionItem) => {
    setLoadingId(sub.id);
    try {
      const res = await approveLyricsSubmission(sub.id);
      setLoadingId(null);

      if (res?.error) {
        addToast({ type: 'error', title: 'Approval Failed', message: res.error });
      } else {
        setSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
        if (inspectSubmission?.id === sub.id) setInspectSubmission(null);
        addToast({
          type: 'success',
          title: 'Lyrics Approved!',
          message: `Awarded +${res.pointsAwarded || sub.points_at_stake} points to ${sub.submitter_name}.`,
        });
        router.refresh();
      }
    } catch (err: any) {
      setLoadingId(null);
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to approve.' });
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingItem) return;

    const reason = rejectionReason.trim();
    if (!reason) {
      setRejectError('Please provide a reason for rejection.');
      return;
    }

    setRejectError(null);
    setRejectLoading(true);

    try {
      const res = await rejectLyricsSubmission(rejectingItem.id, reason);
      setRejectLoading(false);

      if (res?.error) {
        setRejectError(res.error);
      } else {
        const rejectedId = rejectingItem.id;
        setSubmissions((prev) => prev.filter((s) => s.id !== rejectedId));
        if (inspectSubmission?.id === rejectedId) setInspectSubmission(null);
        setRejectingItem(null);
        setRejectionReason('');
        addToast({
          type: 'info',
          title: 'Submission Rejected',
          message: 'Feedback notification was sent to the contributor.',
        });
        router.refresh();
      }
    } catch (err: any) {
      setRejectLoading(false);
      setRejectError(err.message || 'Failed to reject submission.');
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const matchesPart = selectedMassPartFilter === 'ALL' || sub.mass_part === selectedMassPartFilter;
    if (!matchesPart) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      sub.song_title.toLowerCase().includes(q) ||
      (sub.song_composer || '').toLowerCase().includes(q) ||
      sub.submitter_name.toLowerCase().includes(q) ||
      sub.mass_part_name.toLowerCase().includes(q)
    );
  });

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-8 px-4 pb-16 max-w-[1040px] mx-auto w-full">
        {/* Header */}
        <div className="anim-header mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={24} className="text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-primary m-0">Lyrics Review Queue</h1>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 ml-1">
                {submissions.length} Pending
              </span>
            </div>
            <p className="text-sm text-muted m-0">
              Review, approve, or provide feedback for member-submitted Mass Part lyrics.
            </p>
          </div>
        </div>

        {initialError && (
          <div className="alert alert-error mb-5 text-sm">
            <AlertCircle size={16} />
            <span>{initialError}</span>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="anim-header glass-container !p-4 mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-[1_1_260px] min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              className="input-field pl-10 pr-9 w-full min-h-[42px] text-sm"
              placeholder="Search by song, composer, or member…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-0 text-muted cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex-none min-w-[180px]">
            <select
              value={selectedMassPartFilter}
              onChange={(e) => setSelectedMassPartFilter(e.target.value)}
              className="input-field w-full min-h-[42px] text-xs font-semibold cursor-pointer"
            >
              <option value="ALL">All Mass Parts</option>
              <option value="entrance_song">Entrance Song</option>
              <option value="kyrie">Kyrie</option>
              <option value="gloria">Gloria</option>
              <option value="responsorial_psalm">Responsorial Psalm</option>
              <option value="gospel_acclamation">Gospel Acclamation</option>
              <option value="offertory">Offertory</option>
              <option value="sanctus">Sanctus</option>
              <option value="memorial_acclamation">Memorial Acclamation</option>
              <option value="great_amen">Great Amen</option>
              <option value="lords_prayer">Lord's Prayer</option>
              <option value="lamb_of_god">Lamb of God</option>
              <option value="communion_song">Communion Song</option>
              <option value="recessional_song">Recessional / Closing</option>
            </select>
          </div>
        </div>

        {/* Submissions Queue */}
        {filteredSubmissions.length === 0 ? (
          <div className="glass-container text-center py-14 px-5">
            <CheckCircle size={44} className="mx-auto mb-3 text-emerald-600/70" />
            <h3 className="text-lg font-bold text-foreground mb-1">Queue is Clear!</h3>
            <p className="text-sm text-muted max-w-sm mx-auto m-0">
              {searchQuery || selectedMassPartFilter !== 'ALL'
                ? 'No pending submissions match the current filter.'
                : 'All member lyrics contributions have been reviewed.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="anim-card glass-container !p-5 border border-glass-border hover:border-primary/30 transition-all shadow-card"
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  {/* Left info */}
                  <div className="flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {sub.is_new_song && (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 py-0.5 px-2.5 rounded-full border border-emerald-300 flex items-center gap-1">
                          <Sparkles size={11} />
                          NEW SONG PROPOSAL
                        </span>
                      )}
                      <span className="text-xs font-bold uppercase tracking-wider text-accent bg-accent/10 py-0.5 px-2.5 rounded-full border border-accent/20">
                        {sub.mass_part_name}
                      </span>
                      <span className="text-xs font-extrabold text-amber-700 bg-amber-500/15 py-0.5 px-2 rounded-full border border-amber-500/25">
                        +{sub.points_at_stake} pts reward
                      </span>
                      {sub.proposed_key && (
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 py-0.5 px-2 rounded-full border border-slate-200">
                          Key: {sub.proposed_key}
                        </span>
                      )}
                      <span className="text-xs text-muted flex items-center gap-1 ml-auto sm:ml-0">
                        <Clock size={13} />
                        {new Date(sub.submitted_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-primary m-0 mb-1">
                      {sub.song_title}
                    </h3>
                    {sub.song_composer && (
                      <p className="text-xs text-muted m-0 mb-3">
                        Composer / Artist: <strong className="text-foreground">{sub.song_composer}</strong>
                      </p>
                    )}

                    {/* Contributor badge */}
                    <div className="inline-flex items-center gap-2 py-1 px-2.5 rounded-lg bg-black/5 text-xs text-foreground font-medium mb-3">
                      <User size={13} className="text-muted" />
                      <span>Submitted by <strong>{sub.submitter_name}</strong></span>
                    </div>

                    {/* Lyrics Preview Snippet */}
                    <div className="p-3.5 rounded-xl bg-white/70 border border-border/80 font-mono text-xs text-slate-800 max-h-[110px] overflow-hidden relative">
                      <pre className="m-0 whitespace-pre-wrap font-inherit leading-relaxed line-clamp-3">
                        {sub.lyrics_content}
                      </pre>
                      <button
                        type="button"
                        onClick={() => setInspectSubmission(sub)}
                        className="absolute bottom-2 right-2 text-[0.7rem] font-bold bg-primary text-white py-1 px-2 rounded-lg shadow-sm border-0 cursor-pointer flex items-center gap-1 hover:opacity-90"
                      >
                        <Eye size={12} />
                        <span>Inspect Full ChordPro</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2.5 flex-shrink-0 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    <button
                      type="button"
                      onClick={() => handleApprove(sub)}
                      disabled={loadingId === sub.id}
                      className="btn btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-md bg-emerald-600 hover:bg-emerald-700 border-0 flex-1 sm:flex-none justify-center"
                    >
                      <Check size={15} />
                      <span>{loadingId === sub.id ? 'Approving…' : 'Approve (+pts)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRejectingItem(sub);
                        setRejectionReason('');
                        setRejectError(null);
                      }}
                      disabled={loadingId === sub.id}
                      className="btn btn-secondary !py-2 !px-4 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5 flex-1 sm:flex-none justify-center"
                    >
                      <X size={15} />
                      <span>Reject…</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ══ Full Submission Inspection Modal ══ */}
      {inspectSubmission && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-4 sm:p-6 overflow-y-auto"
          onClick={() => setInspectSubmission(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 max-w-[760px] w-full text-foreground shadow-2xl my-auto max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {inspectSubmission.is_new_song && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 py-0.5 px-2.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <Sparkles size={11} />
                      NEW SONG PROPOSAL
                    </span>
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider text-accent bg-accent/10 py-0.5 px-2.5 rounded-full border border-accent/20 inline-block">
                    {inspectSubmission.mass_part_name}
                  </span>
                  {inspectSubmission.proposed_key && (
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 py-0.5 px-2 rounded-full border border-slate-200">
                      Key: {inspectSubmission.proposed_key}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-primary m-0">
                  {inspectSubmission.song_title}
                </h3>
                {inspectSubmission.song_composer && (
                  <p className="text-xs text-muted m-0 mt-0.5">
                    Composer / Artist: <strong className="text-foreground">{inspectSubmission.song_composer}</strong>
                  </p>
                )}
                <p className="text-xs text-muted m-0 mt-0.5">
                  Contributor: <strong>{inspectSubmission.submitter_name}</strong> • Reward: +{inspectSubmission.points_at_stake} pts
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectSubmission(null)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground bg-transparent border-0 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Rendered ChordPro preview */}
            <div className="p-5 rounded-xl bg-slate-50 border border-border mb-5 max-h-[360px] overflow-y-auto">
              <ChordProRenderer lyrics={inspectSubmission.lyrics_content} fontSize={14} showChords={true} />
            </div>

            {/* Raw Text preview */}
            <details className="mb-5 text-xs text-muted">
              <summary className="cursor-pointer font-semibold py-1">View Raw ChordPro Source</summary>
              <pre className="p-3 bg-slate-100 rounded-lg mt-2 overflow-x-auto text-[0.75rem] font-mono text-slate-800">
                {inspectSubmission.lyrics_content}
              </pre>
            </details>

            {/* Actions in Inspector */}
            <div className="flex gap-3 justify-end items-center pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  const item = inspectSubmission;
                  setInspectSubmission(null);
                  setRejectingItem(item);
                  setRejectionReason('');
                }}
                className="btn btn-secondary !py-2 !px-4 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                Reject with Reason…
              </button>
              <button
                type="button"
                onClick={() => handleApprove(inspectSubmission)}
                disabled={loadingId === inspectSubmission.id}
                className="btn btn-primary !py-2 !px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700"
              >
                {loadingId === inspectSubmission.id ? 'Approving…' : 'Approve Lyrics'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Reject Modal Dialog ══ */}
      {rejectingItem && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999999] p-4 sm:p-6"
          onClick={() => {
            if (!rejectLoading) setRejectingItem(null);
          }}
        >
          <div
            className="bg-white border border-slate-300 rounded-2xl p-6 max-w-[480px] w-full text-foreground shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <XCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">
                  Reject {rejectingItem.mass_part_name} Submission?
                </h3>
                <p className="text-xs text-muted m-0">
                  Song: {rejectingItem.song_title} ({rejectingItem.submitter_name})
                </p>
              </div>
            </div>

            {rejectError && (
              <div className="alert alert-error mb-3 text-xs">
                <AlertCircle size={14} />
                <span>{rejectError}</span>
              </div>
            )}

            <form onSubmit={handleRejectConfirm}>
              <div className="input-group mb-4">
                <label className="input-label" htmlFor="rejectionReasonInput">
                  Reason for Rejection *
                  <span className="text-xs text-muted font-normal ml-2">
                    (Sent to member to guide their revision)
                  </span>
                </label>
                <textarea
                  id="rejectionReasonInput"
                  rows={4}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Please check the chords on verse 2; chord brackets should be formatted as [G] not (G)."
                  className="input-field text-xs sm:text-sm resize-y"
                  required
                  disabled={rejectLoading}
                  autoFocus
                />
              </div>

              <div className="flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  disabled={rejectLoading}
                  className="btn btn-secondary !py-2 !px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectLoading || !rejectionReason.trim()}
                  className="btn !py-2 !px-4 text-xs font-bold bg-red-600 hover:bg-red-700 text-white border-0 shadow-md"
                >
                  {rejectLoading ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
