'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  AlertCircle,
  Clock,
  MessageSquare,
  RefreshCw,
  MoreVertical,
  Music,
  Mic,
  Calendar,
  AlertTriangle,
  Flame,
  Zap,
} from 'lucide-react';
import { updateAssignmentStatus } from '../actions';
import { useToast } from '@/components/Toast';
import { getTaskDueLabel } from '@/lib/dateUtils';
import type { TaskAssignmentItem, AssignmentStatus } from '../types';

interface TaskCardProps {
  assignment: TaskAssignmentItem;
  onOpenComplete: (assignment: TaskAssignmentItem) => void;
  onOpenBlocker: (assignment: TaskAssignmentItem) => void;
  onOpenReassign: (assignment: TaskAssignmentItem) => void;
  onOpenComments: (assignment: TaskAssignmentItem) => void;
  onRefresh: () => void;
}

const PRIORITY_BADGES: Record<string, { label: string; bg: string; color: string; icon?: React.ReactNode }> = {
  urgent: { label: 'Urgent', bg: 'rgba(239,68,68,0.12)', color: '#dc2626', icon: <Flame size={12} /> },
  high: { label: 'High', bg: 'rgba(249,115,22,0.12)', color: '#ea580c', icon: <Zap size={12} /> },
  normal: { label: 'Normal', bg: 'rgba(59,130,246,0.12)', color: '#2563eb' },
  low: { label: 'Low', bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Not Started', bg: 'rgba(100,116,139,0.12)', color: '#64748b', icon: <Circle size={14} /> },
  in_progress: { label: 'In Progress', bg: 'rgba(59,130,246,0.15)', color: '#2563eb', icon: <PlayCircle size={14} /> },
  blocked: { label: 'Can’t Complete', bg: 'rgba(239,68,68,0.15)', color: '#dc2626', icon: <AlertCircle size={14} /> },
  completed: { label: 'Completed', bg: 'rgba(16,185,129,0.15)', color: '#059669', icon: <CheckCircle2 size={14} /> },
  overdue: { label: 'Overdue', bg: 'rgba(220,38,38,0.15)', color: '#dc2626', icon: <AlertTriangle size={14} /> },
  reassigned: { label: 'Reassigned', bg: 'rgba(197,160,89,0.15)', color: '#b45309', icon: <RefreshCw size={14} /> },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  assignment,
  onOpenComplete,
  onOpenBlocker,
  onOpenReassign,
  onOpenComments,
  onRefresh,
}) => {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const task = assignment.task;
  if (!task) return null;

  const priority = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.normal;

  // Deadline calculations via Manila business date utilities
  const effectiveDueDate = assignment.due_date || task.due_date;
  const dueInfo = getTaskDueLabel(effectiveDueDate, assignment.status);
  const isOverdue = dueInfo.isOverdue && assignment.status !== 'completed';

  const status = isOverdue && assignment.status !== 'completed'
    ? STATUS_BADGES.overdue
    : STATUS_BADGES[assignment.status] || STATUS_BADGES.pending;

  const handleStatusToggle = async (newStatus: AssignmentStatus) => {
    if (newStatus === 'completed') {
      onOpenComplete(assignment);
      return;
    }

    setLoading(true);
    const res = await updateAssignmentStatus(assignment.id, newStatus);
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Update Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: `Status changed to ${newStatus}.`,
      });
      onRefresh();
    }
  };

  const hasPendingReassignment = assignment.requests?.some(
    (r) => r.request_type === 'reassignment' && r.status === 'pending'
  );

  return (
    <div
      className="anim-card"
      style={{
        padding: '20px 22px',
        borderRadius: '18px',
        background: '#ffffff',
        border: '1px solid rgba(11, 77, 36, 0.12)',
        boxShadow: '0 4px 20px rgba(11, 77, 36, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        borderLeft: assignment.status === 'completed'
          ? '4px solid var(--success, #0b6623)'
          : assignment.status === 'blocked'
          ? '4px solid var(--error, #9f1c1c)'
          : isOverdue
          ? '4px solid var(--warning, #b45309)'
          : '4px solid var(--primary)',
        position: 'relative',
      }}
    >
      {/* Top Meta Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Priority Pill */}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 700,
              background: priority.bg,
              color: priority.color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {priority.icon}
            {priority.label}
          </span>

          {/* Status Badge */}
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.74rem',
              fontWeight: 600,
              background: status.bg,
              color: status.color,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {status.icon}
            {status.label}
          </span>

          {hasPendingReassignment && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: 'rgba(197,160,89,0.18)',
                color: 'var(--accent)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RefreshCw size={11} /> Reassignment Pending
            </span>
          )}
        </div>

        {/* Due Date Indicator */}
        {dueInfo.label && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              fontWeight: isOverdue || dueInfo.isDueSoon ? 700 : 500,
              color: isOverdue ? 'var(--error, #dc2626)' : dueInfo.isDueSoon ? '#ea580c' : 'var(--muted)',
            }}
          >
            {isOverdue ? <AlertTriangle size={14} /> : <Clock size={14} />}
            <span>{dueInfo.label}</span>
          </div>
        )}
      </div>

      {/* Main Task Title & Responsibility */}
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
          Task: {task.title}
        </div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 6px 0', lineHeight: 1.3 }}>
          {assignment.responsibility}
        </h3>
        {task.description && (
          <p style={{ fontSize: '0.86rem', color: 'var(--muted)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
            {task.description}
          </p>
        )}
      </div>

      {/* Completion Note Card */}
      {assignment.status === 'completed' && assignment.completion_comment && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(11, 77, 36, 0.06)',
            border: '1px solid rgba(11, 77, 36, 0.18)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} style={{ color: 'var(--success, #0b6623)', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--foreground)' }}>
            <strong style={{ color: 'var(--success, #0b6623)' }}>Completion Note: </strong>
            {assignment.completion_comment}
          </div>
        </div>
      )}

      {/* "Can't Complete" Alert Box */}
      {assignment.status === 'blocked' && assignment.blocker_reason && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '12px',
            background: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <AlertTriangle size={16} style={{ color: '#ea580c', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '0.82rem', color: 'var(--foreground)' }}>
            <strong style={{ color: '#ea580c' }}>Can&apos;t Complete: </strong>
            {assignment.blocker_reason}
          </div>
        </div>
      )}

      {/* Related Entity Links */}
      {(task.related_song || task.related_sequence) && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {task.related_song && (
            <Link
              href={`/repertoire/${task.related_song.id}`}
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(30,58,138,0.08)',
                color: 'var(--primary)',
              }}
            >
              <Music size={12} /> Song: {task.related_song.title}
            </Link>
          )}
          {task.related_sequence && (
            <Link
              href={`/calendar`}
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: 'rgba(197,160,89,0.12)',
                color: 'var(--accent)',
              }}
            >
              <Mic size={12} /> Mass: {task.related_sequence.title}
            </Link>
          )}
        </div>
      )}

      {/* Action Toolbar */}
      <div
        style={{
          borderTop: '1px solid var(--glass-border)',
          paddingTop: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {/* Left Status Change Button */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {assignment.status === 'pending' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlayCircle size={15} /> Start Work
            </button>
          )}

          {assignment.status !== 'completed' && (
            <button
              onClick={() => onOpenComplete(assignment)}
              disabled={loading}
              className="btn btn-primary"
              style={{
                padding: '7px 14px',
                fontSize: '0.82rem',
                background: 'linear-gradient(135deg, var(--primary, #0b4d24) 0%, #15803d 100%)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(11, 77, 36, 0.2)',
              }}
            >
              <CheckCircle2 size={15} /> Complete Task
            </button>
          )}

          {assignment.status === 'completed' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              Reopen Task
            </button>
          )}

          {assignment.status === 'blocked' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              Resume Work
            </button>
          )}
        </div>

        {/* Secondary Context / Request Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {assignment.status !== 'completed' && (
            <>
              <button
                onClick={() => onOpenBlocker(assignment)}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Can't Complete"
              >
                <AlertTriangle size={14} /> Can&apos;t Complete
              </button>

              <button
                onClick={() => onOpenReassign(assignment)}
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Request Reassignment"
              >
                <RefreshCw size={14} /> Reassign
              </button>
            </>
          )}

          <button
            onClick={() => onOpenComments(assignment)}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            title="Comments & History"
          >
            <MessageSquare size={14} />
            <span>{(assignment.comments || []).length > 0 ? (assignment.comments || []).length : 'Discuss'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
