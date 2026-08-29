'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  History,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  RefreshCw,
  MessageSquare,
  Clock,
  Calendar,
  Sparkles,
  User,
  ListTodo,
  ArrowRight,
  Flame,
  Zap,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import type { TaskItem, TaskAssignmentItem, TaskPriority } from '@/app/tasks/types';

interface TaskTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'creation' | 'assignment' | 'started' | 'completed' | 'blocked' | 'resolved' | 'reassignment' | 'comment' | 'reopened';
  title: string;
  subtitle?: string;
  note?: string | null;
  performer?: {
    full_name?: string;
    avatar_url?: string | null;
    role?: string;
  } | null;
  responsibility?: string;
  metaBadge?: string;
}

export const TaskTimelineModal: React.FC<TaskTimelineModalProps> = ({
  isOpen,
  onClose,
  task,
}) => {
  const [mounted, setMounted] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const events: TimelineEvent[] = useMemo(() => {
    if (!task) return [];
    const list: TimelineEvent[] = [];

    // 1. Task Creation event
    list.push({
      id: `task-created-${task.id}`,
      timestamp: task.created_at,
      type: 'creation',
      title: `Task Created: "${task.title}"`,
      subtitle: task.description || undefined,
      performer: task.creator,
      metaBadge: `${task.priority.toUpperCase()} PRIORITY`,
    });

    // 2. Process assignments
    const assignments = task.assignments || [];
    assignments.forEach((a) => {
      // Assignment creation
      list.push({
        id: `assign-${a.id}`,
        timestamp: a.assigned_at || a.created_at,
        type: 'assignment',
        title: `Delegated to ${a.member?.full_name || 'Member'}`,
        responsibility: a.responsibility,
        subtitle: a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : undefined,
        performer: task.creator,
      });

      // Started at
      if (a.started_at) {
        list.push({
          id: `started-${a.id}`,
          timestamp: a.started_at,
          type: 'started',
          title: `${a.member?.full_name || 'Member'} started work`,
          responsibility: a.responsibility,
          performer: a.member,
        });
      }

      // Completed at
      if (a.completed_at && a.status === 'completed') {
        list.push({
          id: `completed-${a.id}`,
          timestamp: a.completed_at,
          type: 'completed',
          title: `${a.member?.full_name || 'Member'} completed responsibility! 🎉`,
          responsibility: a.responsibility,
          note: a.completion_comment ? `Completion note: "${a.completion_comment}"` : undefined,
          performer: a.member,
        });
      }

      // History entries from database
      if (a.history) {
        a.history.forEach((h) => {
          let eventType: TimelineEvent['type'] = 'started';
          if (h.action.toLowerCase().includes('complete')) eventType = 'completed';
          else if (h.action.toLowerCase().includes('block')) eventType = h.action.toLowerCase().includes('resolve') ? 'resolved' : 'blocked';
          else if (h.action.toLowerCase().includes('reassign')) eventType = 'reassignment';
          else if (h.action.toLowerCase().includes('reopen')) eventType = 'reopened';

          list.push({
            id: `hist-${h.id}`,
            timestamp: h.created_at,
            type: eventType,
            title: h.action,
            responsibility: a.responsibility,
            note: h.note,
            performer: h.performer || (h.new_member ? h.new_member : a.member),
          });
        });
      }

      // Reassignment requests
      if (a.requests) {
        a.requests.forEach((r) => {
          list.push({
            id: `req-${r.id}`,
            timestamp: r.created_at,
            type: 'reassignment',
            title: `Reassignment requested by ${r.requester?.full_name || 'Member'}`,
            responsibility: a.responsibility,
            note: r.reason,
            performer: r.requester,
            metaBadge: r.status.toUpperCase(),
          });
        });
      }

      // Comments
      if (a.comments) {
        a.comments.forEach((c) => {
          list.push({
            id: `comment-${c.id}`,
            timestamp: c.created_at,
            type: 'comment',
            title: `Message from ${c.author?.full_name || 'Member'}`,
            responsibility: a.responsibility,
            note: c.content,
            performer: c.author,
          });
        });
      }
    });

    // Deduplicate identical events by id
    const unique = Array.from(new Map(list.map((e) => [e.id, e])).values());

    // Sort
    unique.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });

    return unique;
  }, [task, sortOrder]);

  if (!isOpen || !mounted || !task) return null;

  const assignments = task.assignments || [];
  const total = assignments.length;
  const completed = assignments.filter((a) => a.status === 'completed').length;
  const blocked = assignments.filter((a) => a.status === 'blocked').length;
  const inProgress = assignments.filter((a) => a.status === 'in_progress').length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'creation':
        return <Sparkles size={16} />;
      case 'assignment':
        return <ListTodo size={16} />;
      case 'started':
        return <PlayCircle size={16} />;
      case 'completed':
        return <CheckCircle2 size={16} />;
      case 'blocked':
        return <AlertCircle size={16} />;
      case 'resolved':
        return <CheckCircle2 size={16} />;
      case 'reassignment':
        return <RefreshCw size={16} />;
      case 'comment':
        return <MessageSquare size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getEventColors = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'creation':
        return { bg: 'rgba(11, 77, 36, 0.12)', color: 'var(--primary)', border: 'rgba(11, 77, 36, 0.25)' };
      case 'assignment':
        return { bg: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.25)' };
      case 'started':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.3)' };
      case 'completed':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: 'rgba(16, 185, 129, 0.3)' };
      case 'blocked':
        return { bg: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: 'rgba(239, 68, 68, 0.3)' };
      case 'resolved':
        return { bg: 'rgba(16, 185, 129, 0.15)', color: '#059669', border: 'rgba(16, 185, 129, 0.3)' };
      case 'reassignment':
        return { bg: 'rgba(197, 160, 89, 0.18)', color: 'var(--accent)', border: 'rgba(197, 160, 89, 0.3)' };
      case 'comment':
        return { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748b', border: 'rgba(100, 116, 139, 0.25)' };
      default:
        return { bg: 'rgba(100, 116, 139, 0.12)', color: '#64748b', border: 'rgba(100, 116, 139, 0.25)' };
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] max-h-[90vh] bg-white rounded-3xl border border-primary/16 shadow-2xl flex flex-col overflow-hidden animate-slideUpModal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-5 px-6 border-b border-primary/10 flex items-start justify-between bg-gradient-to-br from-[#fbfaf6] to-[#f4efe4] gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10.5 h-10.5 rounded-xl bg-gradient-to-br from-primary to-green-700 text-white flex items-center justify-center shadow-md shadow-primary/20 flex-shrink-0">
              <History size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span
                  className={`text-[0.72rem] font-bold uppercase tracking-wider py-0.5 px-2 rounded-md ${
                    task.priority === 'urgent'
                      ? 'bg-red-500/12 text-red-600'
                      : task.priority === 'high'
                      ? 'bg-orange-500/12 text-orange-600'
                      : 'bg-blue-500/12 text-blue-600'
                  }`}
                >
                  {task.priority} Priority
                </span>
                <span className="text-xs text-muted">
                  Progress Timeline & Audit History
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold m-0 text-foreground truncate">
                {task.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-[34px] !h-[34px] !p-0 !rounded-full !min-h-0 !border-primary/12 bg-white text-muted flex items-center justify-center cursor-pointer flex-shrink-0"
            aria-label="Close timeline"
          >
            <X size={18} />
          </button>
        </div>

        {/* Milestone Rollup Banner */}
        <div className="py-3.5 px-6 bg-[#faf8f3] border-b border-primary/8 flex flex-col gap-2.5">
          {/* Stats Bar */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
            <div className="py-2 px-3 rounded-xl bg-white border border-primary/10">
              <span className="text-xs text-muted block font-semibold">Delegates</span>
              <strong className="text-base text-foreground">{total} Members</strong>
            </div>
            <div className="py-2 px-3 rounded-xl bg-white border border-primary/10">
              <span className="text-xs text-muted block font-semibold">Completed</span>
              <strong className="text-base text-emerald-600">{completed}/{total} ({percent}%)</strong>
            </div>
            <div className="py-2 px-3 rounded-xl bg-white border border-primary/10">
              <span className="text-xs text-muted block font-semibold">In Progress</span>
              <strong className="text-base text-blue-600">{inProgress} Active</strong>
            </div>
            {blocked > 0 && (
              <div className="py-2 px-3 rounded-xl bg-red-50 border border-red-500/25">
                <span className="text-xs text-red-600 block font-semibold">Blockers</span>
                <strong className="text-base text-red-600">{blocked} Blocked</strong>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-black/6 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-400 ${
                percent === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-accent'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Timeline Sorting Controls */}
        <div className="py-2 px-6 flex justify-between items-center bg-white border-b border-black/4">
          <span className="text-xs font-bold text-muted uppercase tracking-wider">
            Milestones ({events.length})
          </span>

          <div className="flex gap-1.5">
            <button
              onClick={() => setSortOrder('desc')}
              className={`py-0.5 px-2.5 rounded-full text-xs font-semibold border cursor-pointer ${
                sortOrder === 'desc'
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-black/10 bg-white text-muted'
              }`}
            >
              Newest First
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              className={`py-0.5 px-2.5 rounded-full text-xs font-semibold border cursor-pointer ${
                sortOrder === 'asc'
                  ? 'border-primary bg-primary/8 text-primary'
                  : 'border-black/10 bg-white text-muted'
              }`}
            >
              Oldest First
            </button>
          </div>
        </div>

        {/* Scrollable Timeline List */}
        <div className="flex-1 overflow-y-auto py-6 px-6 bg-white">
          <div className="relative pl-8">
            {/* Vertical Rail */}
            <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-gradient-to-b from-primary via-accent to-primary/20" />

            <div className="flex flex-col gap-5">
              {events.map((ev) => {
                const colors = getEventColors(ev.type);

                return (
                  <div key={ev.id} className="relative">
                    {/* Node Dot / Icon Badge */}
                    <div
                      className="absolute -left-8 top-0 w-7.5 h-7.5 rounded-full bg-white flex items-center justify-center shadow-sm z-[2]"
                      style={{
                        border: `2px solid ${colors.color}`,
                        color: colors.color,
                      }}
                    >
                      {getEventIcon(ev.type)}
                    </div>

                    {/* Event Content Card */}
                    <div className="bg-[#faf8f3] border border-primary/10 rounded-2xl p-3.5 sm:py-3.5 sm:px-4 shadow-sm">
                      {/* Top Header */}
                      <div className="flex justify-between items-start flex-wrap gap-2 mb-1.5">
                        <div>
                          <strong className="text-xs sm:text-sm text-foreground block">
                            {ev.title}
                          </strong>
                          {ev.responsibility && (
                            <span className="inline-block text-xs font-bold text-primary bg-primary/8 py-0.5 px-2 rounded-md mt-1">
                              Responsibility: {ev.responsibility}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-muted font-semibold block">
                            {new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                            at {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {ev.metaBadge && (
                            <span
                              className="text-[0.68rem] font-bold py-px px-1.5 rounded mt-0.5 inline-block"
                              style={{
                                background: colors.bg,
                                color: colors.color,
                              }}
                            >
                              {ev.metaBadge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes / Details */}
                      {ev.note && (
                        <div className="py-2 px-3 bg-white rounded-xl border border-primary/8 text-xs sm:text-sm text-foreground mt-1.5 italic leading-normal">
                          &ldquo;{ev.note}&rdquo;
                        </div>
                      )}

                      {ev.subtitle && (
                        <p className="mt-1 mb-0 text-xs text-muted leading-normal">
                          {ev.subtitle}
                        </p>
                      )}

                      {/* Performer Avatar Footer */}
                      {ev.performer && (
                        <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-black/4">
                          <Avatar
                            src={ev.performer.avatar_url}
                            name={ev.performer.full_name}
                            size="sm"
                            border
                          />
                          <span className="text-xs font-semibold text-foreground">
                            {ev.performer.full_name || 'Choir Member'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="py-3.5 px-6 border-t border-primary/10 bg-gradient-to-br from-[#fbfaf6] to-[#f4efe4] flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-secondary !py-2 !px-5 text-xs sm:text-sm !rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
