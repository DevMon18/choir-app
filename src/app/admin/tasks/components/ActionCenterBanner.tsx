'use client';

import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Clock, AlertCircle } from 'lucide-react';
import type { TaskRequestItem, TaskAssignmentItem } from '@/app/tasks/types';

interface ActionCenterBannerProps {
  requests: TaskRequestItem[];
  blockedAssignments: TaskAssignmentItem[];
  overdueCount?: number;
  onReviewRequest: (request: TaskRequestItem) => void;
  onResolveBlocker: (assignment: TaskAssignmentItem) => void;
  onSelectTab?: (tab: 'active' | 'blocked' | 'all' | 'archived' | 'overdue') => void;
}

export const ActionCenterBanner: React.FC<ActionCenterBannerProps> = ({
  requests,
  blockedAssignments,
  overdueCount = 0,
  onReviewRequest,
  onResolveBlocker,
  onSelectTab,
}) => {
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const hasItems = pendingRequests.length > 0 || blockedAssignments.length > 0 || overdueCount > 0;

  if (!hasItems) return null;

  return (
    <div className="glass-container anim-card p-4 sm:py-4 sm:px-5 rounded-[18px] bg-gradient-to-br from-red-500/6 to-orange-500/8 border border-orange-500/25 mb-[22px] shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-600 flex items-center justify-center">
            <AlertTriangle size={16} />
          </div>
          <h2 className="text-xs sm:text-[0.95rem] font-extrabold m-0 text-foreground uppercase tracking-wider">
            Officer Action Center ({pendingRequests.length + blockedAssignments.length + overdueCount})
          </h2>
        </div>
        <span className="text-xs text-muted">
          Items requiring officer review or intervention
        </span>
      </div>

      {overdueCount > 0 && (
        <div
          onClick={() => onSelectTab && onSelectTab('overdue')}
          className={`py-2.5 px-3.5 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-between mb-2.5 ${onSelectTab ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-red-600" />
            <strong className="text-xs sm:text-sm text-red-600">
              {overdueCount} Task Assignment(s) Overdue Past Deadline
            </strong>
          </div>
          <span className="text-xs text-red-600 font-bold">
            View Overdue Tasks →
          </span>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-2.5">
        {/* Reassignment Requests */}
        {pendingRequests.map((req) => (
          <div
            key={req.id}
            className="py-3 px-3.5 rounded-xl bg-white border border-primary/10 flex items-center justify-between gap-2.5"
          >
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="py-px px-1.5 rounded text-[0.7rem] font-bold bg-accent/20 text-accent inline-flex items-center gap-1">
                  <RefreshCw size={11} /> Reassignment
                </span>
                <strong className="text-xs sm:text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {req.requester?.full_name}
                </strong>
              </div>
              <p className="m-0 text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                &ldquo;{req.reason}&rdquo;
              </p>
            </div>

            <button
              onClick={() => onReviewRequest(req)}
              className="btn btn-primary !py-1.5 !px-3 text-xs flex-shrink-0 inline-flex items-center gap-1"
            >
              Review <ArrowRight size={13} />
            </button>
          </div>
        ))}

        {/* Can't Complete / Attention Items */}
        {blockedAssignments.map((assignment) => (
          <div
            key={assignment.id}
            className="py-3 px-3.5 rounded-xl bg-white border border-orange-500/25 flex items-center justify-between gap-2.5"
          >
            <div className="overflow-hidden">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="py-px px-1.5 rounded text-[0.7rem] font-bold bg-orange-500/20 text-orange-600 inline-flex items-center gap-1">
                  <AlertTriangle size={11} /> Can&apos;t Complete
                </span>
                <strong className="text-xs sm:text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                  {assignment.member?.full_name}
                </strong>
              </div>
              <p className="m-0 text-xs text-muted whitespace-nowrap overflow-hidden text-ellipsis">
                {assignment.blocker_reason || assignment.responsibility}
              </p>
            </div>

            <button
              onClick={() => onResolveBlocker(assignment)}
              className="btn btn-secondary !py-1.5 !px-3 text-xs flex-shrink-0 inline-flex items-center gap-1"
            >
              <CheckCircle2 size={13} /> Resolve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
