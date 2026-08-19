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
import type { TaskAssignmentItem, AssignmentStatus } from '../types';

interface TaskCardProps {
  assignment: TaskAssignmentItem;
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
  blocked: { label: 'Blocked', bg: 'rgba(239,68,68,0.15)', color: '#dc2626', icon: <AlertCircle size={14} /> },
  completed: { label: 'Completed', bg: 'rgba(16,185,129,0.15)', color: '#059669', icon: <CheckCircle2 size={14} /> },
  reassigned: { label: 'Reassigned', bg: 'rgba(197,160,89,0.15)', color: '#b45309', icon: <RefreshCw size={14} /> },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  assignment,
  onOpenBlocker,
  onOpenReassign,
  onOpenComments,
  onRefresh,
}) => {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const { addToast } = useToast();

  const task = assignment.task;
  if (!task) return null;

  const priority = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.normal;
  const status = STATUS_BADGES[assignment.status] || STATUS_BADGES.pending;

  // Deadline formatting & calculations
  const effectiveDueDate = assignment.due_date || task.due_date;
  let dueText = '';
  let isOverdue = false;
  let isDueSoon = false;

  if (effectiveDueDate) {
    const dueTime = new Date(effectiveDueDate).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((dueTime - now) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 && assignment.status !== 'completed') {
      isOverdue = true;
      dueText = `Overdue by ${Math.abs(diffDays)}d`;
    } else if (diffDays === 0) {
      isDueSoon = true;
      dueText = 'Due Today';
    } else if (diffDays === 1) {
      isDueSoon = true;
      dueText = 'Due Tomorrow';
    } else {
      dueText = `Due in ${diffDays}d (${new Date(effectiveDueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })})`;
    }
  }

  const handleStatusToggle = async (newStatus: AssignmentStatus) => {
    setLoading(true);
    const res = await updateAssignmentStatus(assignment.id, newStatus);
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Update Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: newStatus === 'completed' ? 'Responsibility marked completed! 🎉' : `Status changed to ${newStatus}.`,
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
        {dueText && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              fontWeight: isOverdue || isDueSoon ? 700 : 500,
              color: isOverdue ? 'var(--error)' : isDueSoon ? '#ea580c' : 'var(--muted)',
            }}
          >
            {isOverdue ? <AlertTriangle size={14} /> : <Clock size={14} />}
            <span>{dueText}</span>
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
        <div style={{ display: 'flex', gap: '8px' }}>
          {assignment.status === 'pending' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-primary"
              style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlayCircle size={15} /> Start Work
            </button>
          )}

          {assignment.status === 'in_progress' && (
            <button
              onClick={() => handleStatusToggle('completed')}
              disabled={loading}
              className="btn btn-primary"
              style={{
                padding: '7px 14px',
                fontSize: '0.82rem',
                background: 'var(--success, #0b6623)',
                borderColor: 'var(--success, #0b6623)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={15} /> Mark Complete
            </button>
          )}

          {assignment.status === 'completed' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            >
              Reopen
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
