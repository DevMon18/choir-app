'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { MySubmissionItem } from './actions';
import { LyricsContributionModal } from '@/app/repertoire/[id]/LyricsContributionModal';
import { SubmitSongModal } from '@/app/repertoire/SubmitSongModal';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import {
  Sparkles, CheckCircle, Clock, AlertCircle, Award,
  ArrowRight, Edit3, Eye, EyeOff, Music, FileText, ChevronRight, Plus
} from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface MyContributionsClientProps {
  currentUserProfile: Profile;
  initialSubmissions: MySubmissionItem[];
  initialTotalPoints: number;
  initialError?: string;
}

export const MyContributionsClient = ({
  currentUserProfile,
  initialSubmissions,
  initialTotalPoints,
  initialError,
}: MyContributionsClientProps) => {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<MySubmissionItem[]>(initialSubmissions);
  const [editingItem, setEditingItem] = useState<MySubmissionItem | null>(null);
  const [newSongModalOpen, setNewSongModalOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    setSubmissions(initialSubmissions);
  }, [initialSubmissions]);

  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length;

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-8 px-4 pb-20 max-w-[960px] mx-auto w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={24} className="text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-primary m-0">My Lyrics Submissions</h1>
            </div>
            <p className="text-sm text-muted m-0">
              Track your contributed Mass Part lyrics, points earned, and director feedback.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setNewSongModalOpen(true)}
              className="btn btn-primary !py-2 !px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--primary))' }}
            >
              <Sparkles size={14} />
              <span>+ Submit New Song</span>
            </button>

            <Link
              href="/leaderboard"
              className="btn btn-secondary !py-2 !px-3.5 text-xs font-bold flex items-center gap-1.5"
            >
              <span>Leaderboard</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {initialError && (
          <div className="alert alert-error mb-5 text-sm">
            <AlertCircle size={16} />
            <span>{initialError}</span>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-7">
          <div className="glass-container !p-4 flex flex-col justify-center">
            <span className="text-[0.7rem] font-bold text-muted uppercase tracking-wider mb-1">
              Total Points
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-700">
              {initialTotalPoints} pts
            </span>
          </div>

          <div className="glass-container !p-4 flex flex-col justify-center">
            <span className="text-[0.7rem] font-bold text-muted uppercase tracking-wider mb-1">
              Approved
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-600">
              {approvedCount}
            </span>
          </div>

          <div className="glass-container !p-4 flex flex-col justify-center">
            <span className="text-[0.7rem] font-bold text-muted uppercase tracking-wider mb-1">
              In Review
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-600">
              {pendingCount}
            </span>
          </div>

          <div className="glass-container !p-4 flex flex-col justify-center">
            <span className="text-[0.7rem] font-bold text-muted uppercase tracking-wider mb-1">
              Needs Revision
            </span>
            <span className="text-2xl sm:text-3xl font-black text-red-600">
              {rejectedCount}
            </span>
          </div>
        </div>

        {/* Submissions List */}
        {submissions.length === 0 ? (
          <div className="glass-container text-center py-16 px-5">
            <Music size={44} className="mx-auto mb-3 text-muted/50" />
            <h3 className="text-lg font-bold text-foreground mb-1">No Submissions Yet</h3>
            <p className="text-sm text-muted max-w-sm mx-auto mb-5">
              Choose any song in the Repertoire to contribute missing Mass Part lyrics and earn reward points.
            </p>
            <Link href="/repertoire" className="btn btn-primary !py-2 !px-5 text-sm font-bold inline-flex">
              Explore Repertoire
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {submissions.map((sub) => {
              const isApproved = sub.status === 'approved';
              const isPending = sub.status === 'pending';
              const isRejected = sub.status === 'rejected';
              const isPreviewing = previewId === sub.id;

              return (
                <div
                  key={sub.id}
                  className={`glass-container !p-5 border transition-all shadow-card ${
                    isRejected ? 'border-red-200 bg-red-50/20' : 'border-glass-border'
                  }`}
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-[260px]">
                      {/* Status and Tag Bar */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {sub.is_new_song && (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 py-0.5 px-2.5 rounded-full border border-emerald-300 flex items-center gap-1">
                            <Sparkles size={11} />
                            New Song Proposal
                          </span>
                        )}
                        <span className="text-xs font-bold uppercase tracking-wider text-accent bg-accent/10 py-0.5 px-2.5 rounded-full border border-accent/20">
                          {sub.mass_part_name}
                        </span>

                        {isApproved ? (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100 py-0.5 px-2.5 rounded-full border border-emerald-300 flex items-center gap-1">
                            <CheckCircle size={13} />
                            Approved (+{sub.points_awarded || 1} pts)
                          </span>
                        ) : isPending ? (
                          <span className="text-xs font-bold text-amber-800 bg-amber-100 py-0.5 px-2.5 rounded-full border border-amber-300 flex items-center gap-1">
                            <Clock size={13} />
                            Under Director Review
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-red-800 bg-red-100 py-0.5 px-2.5 rounded-full border border-red-300 flex items-center gap-1">
                            <AlertCircle size={13} />
                            Revision Requested
                          </span>
                        )}

                        <span className="text-xs text-muted ml-auto sm:ml-0">
                          {new Date(sub.submitted_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>

                      {/* Song Title */}
                      <h3 className="text-lg font-bold text-primary m-0 mb-1">
                        {sub.song_id ? (
                          <Link
                            href={`/repertoire/${sub.song_id}`}
                            className="text-inherit hover:underline inline-flex items-center gap-1.5"
                          >
                            <span>{sub.song_title}</span>
                            <ChevronRight size={15} className="text-muted" />
                          </Link>
                        ) : (
                          <span>{sub.song_title}</span>
                        )}
                      </h3>
                      {sub.song_composer && (
                        <p className="text-xs text-muted m-0 mb-2">
                          Composer / Artist: {sub.song_composer}
                        </p>
                      )}

                      {/* Rejection Reason Feedback Box */}
                      {isRejected && sub.rejection_reason && (
                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 mt-2 mb-3">
                          <p className="font-bold text-red-800 mb-1 flex items-center gap-1.5">
                            <AlertCircle size={14} />
                            Director Feedback:
                          </p>
                          <p className="m-0 leading-relaxed text-red-950">
                            &quot;{sub.rejection_reason}&quot;
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewId(isPreviewing ? null : sub.id)}
                        className="btn btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1"
                      >
                        {isPreviewing ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{isPreviewing ? 'Hide' : 'View Lyrics'}</span>
                      </button>

                      {isRejected && (
                        <button
                          type="button"
                          onClick={() => setEditingItem(sub)}
                          className="btn btn-primary !py-1.5 !px-3.5 text-xs font-bold flex items-center gap-1 shadow-sm"
                        >
                          <Edit3 size={13} />
                          <span>Edit & Resubmit</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Preview */}
                  {isPreviewing && (
                    <div className="mt-4 pt-3.5 border-t border-border/60">
                      <div className="p-4 rounded-xl bg-slate-50 border border-border max-h-[220px] overflow-y-auto">
                        <ChordProRenderer lyrics={sub.lyrics_content} fontSize={13} showChords={true} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit & Resubmit Modal for Existing Song */}
      {editingItem && editingItem.song_id && (
        <LyricsContributionModal
          songId={editingItem.song_id}
          songTitle={editingItem.song_title}
          coverage={[{
            mass_part: editingItem.mass_part,
            display_name: editingItem.mass_part_name,
            points: 1,
            sort_order: 1,
            status: 'missing',
            pendingCount: 0,
          }]}
          initialMassPart={editingItem.mass_part}
          initialLyrics={editingItem.lyrics_content}
          existingSubmissionId={editingItem.id}
          onClose={() => setEditingItem(null)}
          onSuccess={() => {
            setEditingItem(null);
            router.refresh();
          }}
        />
      )}

      {/* New Song Proposal Modal */}
      <SubmitSongModal
        isOpen={newSongModalOpen}
        onClose={() => setNewSongModalOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
};
