'use client';

import React, { useState } from 'react';
import { MassPartCoverageItem } from './actions';
import { CheckCircle2, Clock, PlusCircle, AlertCircle, ChevronDown, ChevronUp, Sparkles, BookOpen } from 'lucide-react';

interface LyricsCoverageBadgeProps {
  songId: string;
  songTitle: string;
  coverage: MassPartCoverageItem[];
  coveredCount: number;
  totalCount: number;
  onOpenContributeModal: (massPart?: string) => void;
}

export const LyricsCoverageBadge = ({
  songTitle,
  coverage,
  coveredCount,
  totalCount,
  onOpenContributeModal,
}: LyricsCoverageBadgeProps) => {
  const [expanded, setExpanded] = useState(false);
  const percent = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0;

  const missingParts = coverage.filter((c) => c.status === 'missing');
  const pendingParts = coverage.filter((c) => c.status === 'pending');
  const approvedParts = coverage.filter((c) => c.status === 'approved');

  return (
    <div className="glass-container !p-5 mb-6 border border-glass-border">
      {/* Top Header Summary */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-primary m-0">Mass Part Lyrics Coverage</h3>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {coveredCount} / {totalCount} Covered ({percent}%)
              </span>
            </div>
            <p className="text-xs text-muted m-0 mt-0.5">
              {coveredCount === totalCount
                ? 'All Mass Parts have approved lyrics!'
                : `${missingParts.length} Mass ${missingParts.length === 1 ? 'Part is' : 'Parts are'} open for member contributions.`}
            </p>
          </div>
        </div>

        {/* Action Button & Toggle */}
        <div className="flex items-center gap-2">
          {missingParts.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenContributeModal()}
              className="btn btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles size={14} />
              <span>Contribute Lyrics</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="btn btn-secondary !py-1.5 !px-2.5 text-xs flex items-center gap-1 text-muted hover:text-foreground"
          >
            <span>{expanded ? 'Hide Details' : 'View All Parts'}</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-black/8 h-2 rounded-full mt-3.5 overflow-hidden">
        <div
          className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Expanded Breakdown Checklist */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border/60">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {coverage.map((part) => {
              const isApproved = part.status === 'approved';
              const isPending = part.status === 'pending';
              const isMissing = part.status === 'missing';

              return (
                <div
                  key={part.mass_part}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                    isApproved
                      ? 'bg-emerald-50/70 border-emerald-300/40 text-emerald-900'
                      : isPending
                      ? 'bg-amber-50/70 border-amber-300/40 text-amber-900'
                      : 'bg-white/60 border-border/80 text-foreground hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isApproved ? (
                      <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
                    ) : isPending ? (
                      <Clock size={16} className="text-amber-600 flex-shrink-0 animate-pulse" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-muted/50 flex-shrink-0" />
                    )}
                    <div className="truncate">
                      <span className="font-bold truncate block">{part.display_name}</span>
                      <span className="text-[0.65rem] text-muted">
                        {isApproved
                          ? `Covered (${part.points} pts)`
                          : isPending
                          ? `In Review (${part.points} pts)`
                          : `+${part.points} points reward`}
                      </span>
                    </div>
                  </div>

                  {isMissing && (
                    <button
                      type="button"
                      onClick={() => onOpenContributeModal(part.mass_part)}
                      className="ml-2 py-1 px-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[0.7rem] font-bold border-0 cursor-pointer whitespace-nowrap transition-colors"
                      title={`Submit lyrics for ${part.display_name}`}
                    >
                      + Submit
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
