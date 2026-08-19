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
    <div
      className="glass-container anim-card"
      style={{
        padding: '16px 20px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(249,115,22,0.08) 100%)',
        border: '1px solid rgba(249,115,22,0.25)',
        marginBottom: '22px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'rgba(249,115,22,0.18)',
              color: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={16} />
          </div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Officer Action Center ({pendingRequests.length + blockedAssignments.length + overdueCount})
          </h2>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          Items requiring officer review or intervention
        </span>
      </div>

      {overdueCount > 0 && (
        <div
          onClick={() => onSelectTab && onSelectTab('overdue')}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            cursor: onSelectTab ? 'pointer' : 'default',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} style={{ color: '#dc2626' }} />
            <strong style={{ fontSize: '0.86rem', color: '#dc2626' }}>
              {overdueCount} Task Assignment(s) Overdue Past Deadline
            </strong>
          </div>
          <span style={{ fontSize: '0.76rem', color: '#dc2626', fontWeight: 700 }}>
            View Overdue Tasks →
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
        {/* Reassignment Requests */}
        {pendingRequests.map((req) => (
          <div
            key={req.id}
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid rgba(11, 77, 36, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    background: 'rgba(197,160,89,0.2)',
                    color: 'var(--accent)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RefreshCw size={11} /> Reassignment
                </span>
                <strong style={{ fontSize: '0.86rem', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {req.requester?.full_name}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                &ldquo;{req.reason}&rdquo;
              </p>
            </div>

            <button
              onClick={() => onReviewRequest(req)}
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.76rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Review <ArrowRight size={13} />
            </button>
          </div>
        ))}

        {/* Can't Complete / Attention Items */}
        {blockedAssignments.map((assignment) => (
          <div
            key={assignment.id}
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    background: 'rgba(249,115,22,0.18)',
                    color: '#ea580c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertTriangle size={11} /> Can&apos;t Complete
                </span>
                <strong style={{ fontSize: '0.86rem', color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {assignment.member?.full_name}
                </strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {assignment.blocker_reason || assignment.responsibility}
              </p>
            </div>

            <button
              onClick={() => onResolveBlocker(assignment)}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.76rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <CheckCircle2 size={13} /> Resolve
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
