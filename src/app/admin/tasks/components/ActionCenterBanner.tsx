'use client';

import React from 'react';
import { AlertCircle, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { TaskRequestItem, TaskAssignmentItem } from '@/app/tasks/types';

interface ActionCenterBannerProps {
  requests: TaskRequestItem[];
  blockedAssignments: TaskAssignmentItem[];
  onReviewRequest: (request: TaskRequestItem) => void;
  onResolveBlocker: (assignment: TaskAssignmentItem) => void;
}

export const ActionCenterBanner: React.FC<ActionCenterBannerProps> = ({
  requests,
  blockedAssignments,
  onReviewRequest,
  onResolveBlocker,
}) => {
  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const hasItems = pendingRequests.length > 0 || blockedAssignments.length > 0;

  if (!hasItems) return null;

  return (
    <div
      className="glass-container anim-card"
      style={{
        padding: '16px 20px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(197,160,89,0.08) 100%)',
        border: '1px solid rgba(239,68,68,0.2)',
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
              background: 'rgba(239,68,68,0.15)',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={16} />
          </div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Director Action Center ({pendingRequests.length + blockedAssignments.length})
          </h2>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          Items requiring your review or intervention
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
        {/* Reassignment Requests */}
        {pendingRequests.map((req) => (
          <div
            key={req.id}
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
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

        {/* Blocked Tasks */}
        {blockedAssignments.map((assignment) => (
          <div
            key={assignment.id}
            style={{
              padding: '12px 14px',
              borderRadius: '12px',
              background: 'var(--card-bg)',
              border: '1px solid var(--glass-border)',
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
                    background: 'rgba(239,68,68,0.15)',
                    color: 'var(--error)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertCircle size={11} /> Blocked
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
