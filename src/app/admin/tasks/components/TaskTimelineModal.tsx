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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(11, 77, 36, 0.16)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 26px',
            borderBottom: '1px solid rgba(11, 77, 36, 0.1)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #fbfaf6 0%, #f4efe4 100%)',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(11, 77, 36, 0.2)',
                flexShrink: 0,
              }}
            >
              <History size={22} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: task.priority === 'urgent' ? 'rgba(239,68,68,0.12)' : task.priority === 'high' ? 'rgba(249,115,22,0.12)' : 'rgba(59,130,246,0.12)',
                    color: task.priority === 'urgent' ? '#dc2626' : task.priority === 'high' ? '#ea580c' : '#2563eb',
                  }}
                >
                  {task.priority} Priority
                </span>
                <span style={{ fontSize: '0.76rem', color: '#5c675e' }}>
                  Progress Timeline & Audit History
                </span>
              </div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  margin: 0,
                  color: '#111c14',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {task.title}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: '50%',
              minHeight: 'auto',
              border: '1px solid rgba(11, 77, 36, 0.12)',
              background: '#ffffff',
              color: '#5c675e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Close timeline"
          >
            <X size={18} />
          </button>
        </div>

        {/* Milestone Rollup Banner */}
        <div
          style={{
            padding: '14px 26px',
            background: '#faf8f3',
            borderBottom: '1px solid rgba(11, 77, 36, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Stats Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.1)' }}>
              <span style={{ fontSize: '0.72rem', color: '#5c675e', display: 'block', fontWeight: 600 }}>Delegates</span>
              <strong style={{ fontSize: '1rem', color: '#111c14' }}>{total} Members</strong>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.1)' }}>
              <span style={{ fontSize: '0.72rem', color: '#5c675e', display: 'block', fontWeight: 600 }}>Completed</span>
              <strong style={{ fontSize: '1rem', color: '#059669' }}>{completed}/{total} ({percent}%)</strong>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.1)' }}>
              <span style={{ fontSize: '0.72rem', color: '#5c675e', display: 'block', fontWeight: 600 }}>In Progress</span>
              <strong style={{ fontSize: '1rem', color: '#2563eb' }}>{inProgress} Active</strong>
            </div>
            {blocked > 0 && (
              <div style={{ padding: '8px 12px', borderRadius: '10px', background: '#fef2f2', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                <span style={{ fontSize: '0.72rem', color: '#dc2626', display: 'block', fontWeight: 600 }}>Blockers</span>
                <strong style={{ fontSize: '1rem', color: '#dc2626' }}>{blocked} Blocked</strong>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div style={{ height: '6px', width: '100%', background: 'rgba(0,0,0,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${percent}%`,
                background: percent === 100 ? '#10b981' : 'linear-gradient(90deg, var(--primary), var(--accent))',
                borderRadius: '999px',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>

        {/* Timeline Sorting Controls */}
        <div
          style={{
            padding: '8px 26px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            borderBottom: '1px solid rgba(0,0,0,0.04)',
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5c675e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Milestones ({events.length})
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setSortOrder('desc')}
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: sortOrder === 'desc' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                background: sortOrder === 'desc' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                color: sortOrder === 'desc' ? 'var(--primary)' : '#5c675e',
                cursor: 'pointer',
              }}
            >
              Newest First
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              style={{
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid',
                borderColor: sortOrder === 'asc' ? 'var(--primary)' : 'rgba(0,0,0,0.1)',
                background: sortOrder === 'asc' ? 'rgba(11, 77, 36, 0.08)' : '#ffffff',
                color: sortOrder === 'asc' ? 'var(--primary)' : '#5c675e',
                cursor: 'pointer',
              }}
            >
              Oldest First
            </button>
          </div>
        </div>

        {/* Scrollable Timeline List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 26px',
            background: '#ffffff',
          }}
        >
          <div style={{ position: 'relative', paddingLeft: '32px' }}>
            {/* Vertical Rail */}
            <div
              style={{
                position: 'absolute',
                left: '14px',
                top: '12px',
                bottom: '12px',
                width: '2px',
                background: 'linear-gradient(180deg, var(--primary) 0%, var(--accent) 50%, rgba(11, 77, 36, 0.2) 100%)',
              }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {events.map((ev, index) => {
                const colors = getEventColors(ev.type);

                return (
                  <div key={ev.id} style={{ position: 'relative' }}>
                    {/* Node Dot / Icon Badge */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-32px',
                        top: '0px',
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        border: `2px solid ${colors.color}`,
                        color: colors.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        zIndex: 2,
                      }}
                    >
                      {getEventIcon(ev.type)}
                    </div>

                    {/* Event Content Card */}
                    <div
                      style={{
                        background: '#faf8f3',
                        border: '1px solid rgba(11, 77, 36, 0.1)',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      }}
                    >
                      {/* Top Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                        <div>
                          <strong style={{ fontSize: '0.92rem', color: '#111c14', display: 'block' }}>
                            {ev.title}
                          </strong>
                          {ev.responsibility && (
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                color: 'var(--primary)',
                                background: 'rgba(11, 77, 36, 0.08)',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                marginTop: '4px',
                              }}
                            >
                              Responsibility: {ev.responsibility}
                            </span>
                          )}
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.74rem', color: '#5c675e', fontWeight: 600, display: 'block' }}>
                            {new Date(ev.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                            at {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {ev.metaBadge && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: colors.bg,
                                color: colors.color,
                                marginTop: '2px',
                                display: 'inline-block',
                              }}
                            >
                              {ev.metaBadge}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes / Details */}
                      {ev.note && (
                        <div
                          style={{
                            padding: '8px 12px',
                            background: '#ffffff',
                            borderRadius: '10px',
                            border: '1px solid rgba(11, 77, 36, 0.08)',
                            fontSize: '0.86rem',
                            color: '#111c14',
                            marginTop: '6px',
                            fontStyle: 'italic',
                            lineHeight: 1.4,
                          }}
                        >
                          &ldquo;{ev.note}&rdquo;
                        </div>
                      )}

                      {ev.subtitle && (
                        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#5c675e', lineHeight: 1.4 }}>
                          {ev.subtitle}
                        </p>
                      )}

                      {/* Performer Avatar Footer */}
                      {ev.performer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                          <Avatar
                            src={ev.performer.avatar_url}
                            name={ev.performer.full_name}
                            size="sm"
                            border
                          />
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#111c14' }}>
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
        <div
          style={{
            padding: '14px 26px',
            borderTop: '1px solid rgba(11, 77, 36, 0.1)',
            background: 'linear-gradient(135deg, #fbfaf6 0%, #f4efe4 100%)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '8px 20px', fontSize: '0.88rem', borderRadius: '10px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
