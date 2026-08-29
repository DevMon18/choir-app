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
      className="anim-card p-5 sm:p-5.5 rounded-2xl bg-white border border-primary/12 shadow-card flex flex-col gap-3 relative"
      style={{
        borderLeft: assignment.status === 'completed'
          ? '4px solid var(--success, #0b6623)'
          : assignment.status === 'blocked'
          ? '4px solid var(--error, #9f1c1c)'
          : isOverdue
          ? '4px solid var(--warning, #b45309)'
          : '4px solid var(--primary)',
      }}
    >
      {/* Top Meta Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority Pill */}
          <span
            className="py-0.5 px-2 rounded-md text-xs font-bold inline-flex items-center gap-1"
            style={{ background: priority.bg, color: priority.color }}
          >
            {priority.icon}
            {priority.label}
          </span>

          {/* Status Badge */}
          <span
            className="py-0.5 px-2 rounded-md text-xs font-semibold inline-flex items-center gap-1"
            style={{ background: status.bg, color: status.color }}
          >
            {status.icon}
            {status.label}
          </span>

          {hasPendingReassignment && (
            <span className="py-0.5 px-2 rounded-md text-xs font-semibold bg-amber-500/18 text-accent inline-flex items-center gap-1">
              <RefreshCw size={11} /> Reassignment Pending
            </span>
          )}
        </div>

        {/* Due Date Indicator */}
        {dueInfo.label && (
          <div
            className={`inline-flex items-center gap-1 text-xs ${
              isOverdue
                ? 'text-error font-bold'
                : dueInfo.isDueSoon
                ? 'text-orange-600 font-bold'
                : 'text-muted font-medium'
            }`}
          >
            {isOverdue ? <AlertTriangle size={14} /> : <Clock size={14} />}
            <span>{dueInfo.label}</span>
          </div>
        )}
      </div>

      {/* Main Task Title & Responsibility */}
      <div>
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">
          Task: {task.title}
        </div>
        <h3 className="text-lg font-bold text-foreground m-0 mb-1.5 leading-snug">
          {assignment.responsibility}
        </h3>
        {task.description && (
          <p className="text-sm text-muted m-0 mb-2 leading-relaxed">
            {task.description}
          </p>
        )}
      </div>

      {/* Completion Note Card */}
      {assignment.status === 'completed' && assignment.completion_comment && (
        <div className="py-2.5 px-3.5 rounded-xl bg-primary/6 border border-primary/18 flex items-start gap-2">
          <CheckCircle2 size={16} className="text-success mt-0.5 flex-shrink-0" />
          <div className="text-xs text-foreground">
            <strong className="text-success">Completion Note: </strong>
            {assignment.completion_comment}
          </div>
        </div>
      )}

      {/* "Can't Complete" Alert Box */}
      {assignment.status === 'blocked' && assignment.blocker_reason && (
        <div className="py-2.5 px-3.5 rounded-xl bg-orange-500/8 border border-orange-500/25 flex items-start gap-2">
          <AlertTriangle size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-foreground">
            <strong className="text-orange-600">Can&apos;t Complete: </strong>
            {assignment.blocker_reason}
          </div>
        </div>
      )}

      {/* Related Entity Links */}
      {(task.related_song || task.related_sequence) && (
        <div className="flex gap-2 flex-wrap">
          {task.related_song && (
            <Link
              href={`/repertoire/${task.related_song.id}`}
              className="no-underline inline-flex items-center gap-1.25 py-0.75 px-2 rounded-lg text-xs font-semibold bg-primary/8 text-primary hover:bg-primary/15 transition-colors"
            >
              <Music size={12} /> Song: {task.related_song.title}
            </Link>
          )}
          {task.related_sequence && (
            <Link
              href="/calendar"
              className="no-underline inline-flex items-center gap-1.25 py-0.75 px-2 rounded-lg text-xs font-semibold bg-accent/12 text-accent hover:bg-accent/20 transition-colors"
            >
              <Mic size={12} /> Mass: {task.related_sequence.title}
            </Link>
          )}
        </div>
      )}

      {/* Action Toolbar */}
      <div className="border-t border-glass-border pt-3 flex items-center justify-between flex-wrap gap-2.5">
        {/* Left Status Change Button */}
        <div className="flex gap-2 flex-wrap">
          {assignment.status === 'pending' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-secondary !py-1.75 !px-3.5 text-xs inline-flex items-center gap-1.5"
            >
              <PlayCircle size={15} /> Start Work
            </button>
          )}

          {assignment.status !== 'completed' && (
            <button
              onClick={() => onOpenComplete(assignment)}
              disabled={loading}
              className="btn btn-primary !py-1.75 !px-3.5 text-xs bg-gradient-to-br from-primary to-emerald-700 text-white inline-flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 size={15} /> Complete Task
            </button>
          )}

          {assignment.status === 'completed' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-secondary !py-1.5 !px-3 text-xs"
            >
              Reopen Task
            </button>
          )}

          {assignment.status === 'blocked' && (
            <button
              onClick={() => handleStatusToggle('in_progress')}
              disabled={loading}
              className="btn btn-secondary !py-1.5 !px-3 text-xs"
            >
              Resume Work
            </button>
          )}
        </div>

        {/* Secondary Context / Request Actions */}
        <div className="flex items-center gap-1.5">
          {assignment.status !== 'completed' && (
            <>
              <button
                onClick={() => onOpenBlocker(assignment)}
                className="btn btn-secondary !py-1.5 !px-2.5 text-xs text-orange-600 inline-flex items-center gap-1"
                title="Can't Complete"
              >
                <AlertTriangle size={14} /> Can&apos;t Complete
              </button>

              <button
                onClick={() => onOpenReassign(assignment)}
                className="btn btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1"
                title="Request Reassignment"
              >
                <RefreshCw size={14} /> Reassign
              </button>
            </>
          )}

          <button
            onClick={() => onOpenComments(assignment)}
            className="btn btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1.25"
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
