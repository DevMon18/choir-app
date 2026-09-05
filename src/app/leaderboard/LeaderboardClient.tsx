'use client';

import React, { useState, useTransition } from 'react';
import { Navbar } from '@/components/Navbar';
import { LeaderboardEntry, LeaderboardPeriod, LeaderboardResponse, getLeaderboardData } from './actions';
import {
  Trophy, Medal, Award, Flame, Calendar, Clock,
  ChevronDown, ChevronUp, User, Sparkles, Filter, Music, Plus
} from 'lucide-react';
import Image from 'next/image';
import { SubmitSongModal } from '@/app/repertoire/SubmitSongModal';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface LeaderboardClientProps {
  currentUserProfile: Profile;
  initialData: LeaderboardResponse;
}

export const LeaderboardClient = ({
  currentUserProfile,
  initialData,
}: LeaderboardClientProps) => {
  const [data, setData] = useState<LeaderboardResponse>(initialData);
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialData.period);
  const [activeOnly, setActiveOnly] = useState<boolean>(initialData.activeOnly);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [submitSongModalOpen, setSubmitSongModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handlePeriodChange = (newPeriod: LeaderboardPeriod) => {
    setPeriod(newPeriod);
    startTransition(async () => {
      const res = await getLeaderboardData(newPeriod, activeOnly);
      setData(res);
    });
  };

  const handleActiveToggle = (newActiveOnly: boolean) => {
    setActiveOnly(newActiveOnly);
    startTransition(async () => {
      const res = await getLeaderboardData(period, newActiveOnly);
      setData(res);
    });
  };

  const top3 = data.entries.slice(0, 3);
  const remaining = data.entries.slice(3);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center shadow-md shadow-amber-400/30 text-xs">
          🥇 1
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-800 font-black flex items-center justify-center shadow-md shadow-slate-300/30 text-xs">
          🥈 2
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-600/80 text-amber-100 font-black flex items-center justify-center shadow-md shadow-amber-700/30 text-xs">
          🥉 3
        </div>
      );
    }
    return (
      <div className="w-7 h-7 rounded-full bg-black/5 text-muted font-bold flex items-center justify-center text-xs">
        #{rank}
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-8 px-4 pb-20 max-w-[960px] mx-auto w-full">
        {/* Header Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 text-xs font-bold mb-3 shadow-sm">
            <Trophy size={14} className="text-amber-500" />
            <span>Choir Member Contribution Rewards</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-primary m-0 tracking-tight">
            Lyrics Leaderboard
          </h1>
          <p className="text-sm text-muted max-w-md mx-auto mt-1.5 mb-4">
            Earn contribution points by submitting accurate ChordPro lyrics for Mass Parts or proposing new repertoire songs.
          </p>

          <button
            type="button"
            onClick={() => setSubmitSongModalOpen(true)}
            className="btn btn-primary !py-2 !px-4 text-xs font-bold inline-flex items-center gap-1.5 shadow-md"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--primary))' }}
          >
            <Sparkles size={14} />
            <span>+ Submit New Song</span>
          </button>
        </div>

        {/* Filters & Time Period Bar */}
        <div className="glass-container !p-3.5 mb-7 flex items-center justify-between flex-wrap gap-3">
          {/* Period Toggle */}
          <div className="flex bg-black/6 p-1 rounded-xl">
            {(['weekly', 'monthly', 'all_time'] as LeaderboardPeriod[]).map((p) => {
              const labels = { weekly: 'This Week', monthly: 'This Month', all_time: 'All-Time' };
              const active = period === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  disabled={isPending}
                  className={`py-1.5 px-3.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                    active
                      ? 'bg-white text-primary shadow-sm'
                      : 'bg-transparent text-muted hover:text-foreground'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Active Members Only Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => handleActiveToggle(!activeOnly)}
              disabled={isPending}
              className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                activeOnly
                  ? 'border-primary/30 bg-primary/8 text-primary'
                  : 'border-border bg-white/60 text-muted'
              }`}
            >
              {activeOnly ? 'Active Members Only' : 'All-Time Roster'}
            </button>
          </div>
        </div>

        {/* Current User Ranking Summary Pill (if user has contributed) */}
        {data.currentUserEntry && (
          <div className="glass-container !p-4 mb-7 bg-primary/6 border border-primary/20 shadow-sm flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {getRankBadge(data.currentUserEntry.rank)}
              <div>
                <span className="text-xs font-bold text-primary block">Your Current Ranking</span>
                <span className="text-sm font-bold text-foreground">
                  {data.currentUserEntry.full_name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-muted">
                {data.currentUserEntry.approved_count} Approved Parts
              </span>
              <span className="text-base font-black text-amber-700 bg-amber-500/20 py-1 px-3 rounded-full">
                {data.currentUserEntry.total_points} pts
              </span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {data.entries.length === 0 ? (
          <div className="glass-container text-center py-16 px-5">
            <Trophy size={48} className="mx-auto mb-3 text-muted/50" />
            <h3 className="text-lg font-bold text-foreground mb-1">No Contributions Yet</h3>
            <p className="text-sm text-muted max-w-sm mx-auto m-0">
              Be the first to submit lyrics for a Mass Part in the Repertoire!
            </p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium Cards */}
            {top3.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
                {top3.map((entry, idx) => {
                  const isFirst = entry.rank === 1;
                  return (
                    <div
                      key={entry.member_id}
                      className={`glass-container !p-5 relative flex flex-col items-center text-center transition-all border ${
                        isFirst
                          ? 'border-amber-400/50 bg-amber-50/50 shadow-md sm:-translate-y-1'
                          : 'border-glass-border'
                      }`}
                    >
                      <div className="absolute top-3.5 left-3.5">
                        {getRankBadge(entry.rank)}
                      </div>

                      {/* Avatar */}
                      <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg mb-2.5 overflow-hidden border-2 border-white shadow-sm mt-2">
                        {entry.avatar_url ? (
                          <Image src={entry.avatar_url} alt={entry.full_name} width={64} height={64} className="w-full h-full object-cover" />
                        ) : (
                          <span>{entry.full_name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-foreground m-0 mb-0.5 truncate max-w-[180px]">
                        {entry.full_name}
                      </h4>
                      <span className="text-[0.7rem] text-muted uppercase font-bold tracking-wider mb-3">
                        {entry.role}
                      </span>

                      {/* Points pill */}
                      <div className="text-lg font-black text-amber-700 bg-amber-500/15 py-1 px-4 rounded-full border border-amber-500/30 mb-2">
                        {entry.total_points} pts
                      </div>
                      <span className="text-[0.72rem] text-muted font-medium">
                        {entry.approved_count} Mass {entry.approved_count === 1 ? 'Part' : 'Parts'} Approved
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Complete Ranking List Table */}
            <div className="glass-container !p-0 overflow-hidden shadow-card border border-glass-border">
              <div className="p-4 bg-primary/5 border-b border-glass-border flex items-center justify-between text-xs font-bold text-muted uppercase tracking-wider">
                <span>Rank & Member</span>
                <div className="flex items-center gap-6">
                  <span className="hidden sm:inline">Approved Parts</span>
                  <span>Total Points</span>
                </div>
              </div>

              <div className="divide-y divide-border/60">
                {data.entries.map((entry) => {
                  const isExpanded = expandedMemberId === entry.member_id;
                  const isMe = entry.member_id === currentUserProfile.id;

                  return (
                    <div
                      key={entry.member_id}
                      className={`transition-colors ${
                        isMe ? 'bg-primary/4' : 'hover:bg-black/[0.02]'
                      }`}
                    >
                      <div
                        onClick={() => setExpandedMemberId(isExpanded ? null : entry.member_id)}
                        className="p-4 flex items-center justify-between cursor-pointer select-none gap-3"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {getRankBadge(entry.rank)}
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0 overflow-hidden border border-border">
                            {entry.avatar_url ? (
                              <Image src={entry.avatar_url} alt={entry.full_name} width={36} height={36} className="w-full h-full object-cover" />
                            ) : (
                              <span>{entry.full_name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground truncate">
                                {entry.full_name}
                              </span>
                              {isMe && (
                                <span className="text-[0.65rem] font-bold text-primary bg-primary/10 py-0.2 px-1.5 rounded-full border border-primary/20">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[0.7rem] text-muted capitalize">
                              {entry.role.replace('_', ' ')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                          <span className="text-xs font-semibold text-muted hidden sm:inline">
                            {entry.approved_count} parts
                          </span>
                          <span className="text-sm font-black text-amber-700 bg-amber-500/15 py-1 px-3 rounded-full border border-amber-500/25">
                            {entry.total_points} pts
                          </span>
                          <button
                            type="button"
                            className="p-1 text-muted hover:text-foreground bg-transparent border-0 cursor-pointer"
                            aria-label="Toggle details"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Tap-to-expand Mass Part breakdown drawer */}
                      {isExpanded && (
                        <div className="px-5 pb-4 pt-1 bg-white/40 border-t border-border/40">
                          <p className="text-[0.7rem] font-bold text-muted uppercase tracking-wider mb-2">
                            Approved Mass Part Contributions:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {entry.breakdown.map((part) => (
                              <div
                                key={part.mass_part}
                                className="p-2 rounded-lg bg-white/80 border border-border text-xs flex items-center justify-between"
                              >
                                <span className="font-semibold text-foreground truncate mr-2">
                                  {part.display_name}
                                </span>
                                <span className="font-bold text-amber-700 bg-amber-100 py-0.5 px-2 rounded-full text-[0.68rem] whitespace-nowrap">
                                  {part.count} ({part.points} pts)
                                </span>
                              </div>
                            ))}
                          </div>
                          {entry.most_recent_contribution && (
                            <p className="text-[0.68rem] text-muted mt-2.5 mb-0 flex items-center gap-1">
                              <Clock size={11} />
                              Most recent contribution: {new Date(entry.most_recent_contribution).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      <SubmitSongModal
        isOpen={submitSongModalOpen}
        onClose={() => setSubmitSongModalOpen(false)}
        onSuccess={() => {
          handlePeriodChange(period);
        }}
      />
    </div>
  );
};
