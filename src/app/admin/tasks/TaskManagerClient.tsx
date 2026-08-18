'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ActionCenterBanner } from './components/ActionCenterBanner';
import { TaskCreateModal } from './components/TaskCreateModal';
import { ReassignmentApprovalModal } from './components/ReassignmentApprovalModal';
import { TaskTimelineModal } from './components/TaskTimelineModal';
import { CommentsDrawer } from '@/app/tasks/components/CommentsDrawer';
import { getAllTasksAdmin, getPendingRequestsAdmin, resolveBlocker, archiveTask, deleteTask } from './actions';
import { useToast } from '@/components/Toast';
import {
  ListTodo,
  Plus,
  Search,
  CheckCircle2,
  PlayCircle,
  AlertCircle,
  Clock,
  History,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Archive,
  Trash2,
  Music,
  Mic,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import gsap from 'gsap';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { TaskItem, TaskRequestItem, TaskAssignmentItem } from '@/app/tasks/types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
}

interface SongOption {
  id: string;
  title: string;
}

interface SequenceOption {
  id: string;
  title: string;
}

interface TaskManagerClientProps {
  currentUserProfile: { id: string; full_name: string; role: string };
  initialTasks: TaskItem[];
  initialRequests: TaskRequestItem[];
  membersList: MemberOption[];
  songsList: SongOption[];
  sequencesList: SequenceOption[];
}

export const TaskManagerClient: React.FC<TaskManagerClientProps> = ({
  currentUserProfile,
  initialTasks,
  initialRequests,
  membersList,
  songsList,
  sequencesList,
}) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [requests, setRequests] = useState<TaskRequestItem[]>(initialRequests);
  const [activeTab, setActiveTab] = useState<'active' | 'blocked' | 'all' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<TaskRequestItem | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const [timelineTask, setTimelineTask] = useState<TaskItem | null>(null);
  const [selectedCommentAssignment, setSelectedCommentAssignment] = useState<{ assignment: TaskAssignmentItem; taskTitle: string } | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const refreshData = async () => {
    const [freshTasks, freshReqs] = await Promise.all([
      getAllTasksAdmin(),
      getPendingRequestsAdmin(),
    ]);
    setTasks(freshTasks);
    setRequests(freshReqs);
  };

  // Realtime subscription for director tasks & action center
  useRealtimeSync({
    channelName: `admin-tasks-sync-${currentUserProfile.id}`,
    tables: [
      { table: 'tasks' },
      { table: 'task_assignments' },
      { table: 'task_requests' },
    ],
    onEvent: () => {
      refreshData();
    },
  });

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.anim-header', { opacity: 0, y: -12, duration: 0.35 });
      tl.from('.anim-card', { opacity: 0, y: 14, duration: 0.35, stagger: 0.035 }, '-=0.15');
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Collect all blocked assignments across all active tasks
  const blockedAssignments = useMemo(() => {
    const list: TaskAssignmentItem[] = [];
    tasks.forEach((t) => {
      if (!t.is_archived && t.assignments) {
        t.assignments.forEach((a) => {
          if (a.status === 'blocked') list.push(a);
        });
      }
    });
    return list;
  }, [tasks]);

  const handleResolveBlocker = async (assignment: TaskAssignmentItem) => {
    const res = await resolveBlocker(assignment.id);
    if (res.error) {
      addToast({ type: 'error', title: 'Action Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Blocker Cleared', message: 'The blocker has been marked resolved.' });
      refreshData();
    }
  };

  const handleToggleArchive = async (task: TaskItem) => {
    const nextState = !task.is_archived;
    const res = await archiveTask(task.id, nextState);
    if (res.error) {
      addToast({ type: 'error', title: 'Archive Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: nextState ? 'Task Archived' : 'Task Restored',
        message: nextState ? 'Task moved to archives.' : 'Task restored to active list.',
      });
      refreshData();
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteConfirmTaskId) return;
    const res = await deleteTask(deleteConfirmTaskId);
    setDeleteConfirmTaskId(null);
    if (res.error) {
      addToast({ type: 'error', title: 'Delete Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Task Deleted', message: 'Task and all related assignments were removed.' });
      refreshData();
    }
  };

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tab filter
      if (activeTab === 'active' && t.is_archived) return false;
      if (activeTab === 'archived' && !t.is_archived) return false;
      if (activeTab === 'blocked') {
        const hasBlocked = t.assignments?.some((a) => a.status === 'blocked');
        if (!hasBlocked) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchResp = t.assignments?.some((a) =>
          a.responsibility.toLowerCase().includes(q) || a.member?.full_name.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchDesc && !matchResp) return false;
      }

      return true;
    });
  }, [tasks, activeTab, searchQuery]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '500px', height: '500px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }}></div>

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full" style={{ maxWidth: '1060px', margin: '0 auto', width: '100%', padding: '20px' }}>
        {/* Header Title & Create Button */}
        <div className="anim-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ListTodo size={22} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                Choir Tasks & Delegation
              </h1>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '4px 0 0 50px' }}>
              Create overarching tasks, delegate specific responsibilities, and monitor choir execution.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Link
              href="/tasks"
              className="btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.86rem' }}
            >
              My Own Tasks →
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary tasks-desktop-create"
              style={{ padding: '8px 18px', fontSize: '0.86rem', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} /> Create Task
            </button>
          </div>
        </div>

        {/* Action Center Banner */}
        <ActionCenterBanner
          requests={requests}
          blockedAssignments={blockedAssignments}
          onReviewRequest={(req) => setReviewingRequest(req)}
          onResolveBlocker={handleResolveBlocker}
        />

        {/* Filter Bar */}
        <div className="anim-card" style={{ padding: '12px 16px', borderRadius: '18px', background: '#ffffff', border: '1px solid rgba(11, 77, 36, 0.12)', boxShadow: '0 4px 16px rgba(11, 77, 36, 0.05)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
              <button
                onClick={() => setActiveTab('active')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'active' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'active' ? '#fff' : 'var(--muted)',
                }}
              >
                Active Tasks ({tasks.filter((t) => !t.is_archived).length})
              </button>

              <button
                onClick={() => setActiveTab('blocked')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'blocked' ? 'var(--error)' : 'transparent',
                  color: activeTab === 'blocked' ? '#fff' : 'var(--muted)',
                }}
              >
                Blocked ({blockedAssignments.length})
              </button>

              <button
                onClick={() => setActiveTab('all')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'all' ? 'rgba(0,0,0,0.08)' : 'transparent',
                  color: activeTab === 'all' ? 'var(--foreground)' : 'var(--muted)',
                }}
              >
                All ({tasks.length})
              </button>

              <button
                onClick={() => setActiveTab('archived')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'archived' ? 'rgba(0,0,0,0.08)' : 'transparent',
                  color: activeTab === 'archived' ? 'var(--foreground)' : 'var(--muted)',
                }}
              >
                Archived ({tasks.filter((t) => t.is_archived).length})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search tasks, members, or responsibilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', height: '36px', fontSize: '0.84rem', borderRadius: '18px' }}
              />
            </div>
          </div>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="glass-container anim-card" style={{ padding: '40px 20px', textAlign: 'center', borderRadius: '20px' }}>
            <ListTodo size={40} style={{ margin: '0 auto 12px', opacity: 0.35, color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--foreground)' }}>
              No tasks found
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
              {activeTab === 'active'
                ? 'Create a new task and delegate responsibilities to choir members.'
                : 'No tasks match your current filter or query.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.86rem' }}
            >
              + Create First Task
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredTasks.map((t) => {
              const assignments = t.assignments || [];
              const total = assignments.length;
              const completed = assignments.filter((a) => a.status === 'completed').length;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isExpanded = expandedTasks[t.id] ?? true; // expanded by default

              return (
                <div
                  key={t.id}
                  className="anim-card"
                  style={{
                    padding: '22px 24px',
                    borderRadius: '20px',
                    background: '#ffffff',
                    border: '1px solid rgba(11, 77, 36, 0.12)',
                    boxShadow: '0 4px 20px rgba(11, 77, 36, 0.06)',
                  }}
                >
                  {/* Task Card Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: '240px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: t.priority === 'urgent' ? 'rgba(239,68,68,0.12)' : t.priority === 'high' ? 'rgba(249,115,22,0.12)' : 'rgba(59,130,246,0.12)',
                            color: t.priority === 'urgent' ? '#dc2626' : t.priority === 'high' ? '#ea580c' : '#2563eb',
                            textTransform: 'uppercase',
                          }}
                        >
                          {t.priority}
                        </span>

                        {t.is_archived && (
                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(100,116,139,0.15)', color: '#64748b' }}>
                            Archived
                          </span>
                        )}

                        {t.due_date && (
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={13} /> Due: {new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', margin: '0 0 6px 0' }}>
                        {t.title}
                      </h2>
                      {t.description && (
                        <p style={{ margin: '0 0 10px 0', fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.4 }}>
                          {t.description}
                        </p>
                      )}

                      {/* Related Entities */}
                      {(t.related_song || t.related_sequence) && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          {t.related_song && (
                            <Link
                              href={`/repertoire/${t.related_song.id}`}
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
                              <Music size={12} /> Song: {t.related_song.title}
                            </Link>
                          )}
                          {t.related_sequence && (
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
                              <Mic size={12} /> Mass: {t.related_sequence.title}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Action Menu */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => setTimelineTask(t)}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          borderColor: 'rgba(11, 77, 36, 0.2)',
                          color: 'var(--primary)',
                          background: 'rgba(11, 77, 36, 0.04)',
                        }}
                        title="View Task Progress History & Timeline"
                        aria-label="View Task Progress History & Timeline"
                      >
                        <History size={14} /> Timeline
                      </button>

                      <button
                        onClick={() => handleToggleArchive(t)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title={t.is_archived ? 'Restore Task' : 'Archive Task'}
                        aria-label={t.is_archived ? 'Restore Task' : 'Archive Task'}
                      >
                        <Archive size={14} /> {t.is_archived ? 'Restore' : 'Archive'}
                      </button>

                      <button
                        onClick={() => setDeleteConfirmTaskId(t.id)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.78rem', color: 'var(--error)', border: 'none' }}
                        title="Delete Task"
                        aria-label="Delete Task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Rollup Bar */}
                  <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>
                        Overall Progress: {completed}/{total} Completed ({percent}%)
                      </span>
                      <button
                        onClick={() => toggleExpand(t.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Hide responsibilities for ${t.title}` : `View responsibilities for ${t.title}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {isExpanded ? <>Hide Responsibilities <ChevronUp size={14} /></> : <>View Responsibilities ({total}) <ChevronDown size={14} /></>}
                      </button>
                    </div>

                    <div style={{ height: '8px', width: '100%', background: 'rgba(0,0,0,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
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

                  {/* Collapsible Responsibilities List */}
                  {isExpanded && (
                    <div
                      style={{
                        borderTop: '1px solid var(--glass-border)',
                        paddingTop: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {assignments.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '12px',
                            background: a.status === 'blocked' ? 'rgba(239,68,68,0.06)' : a.status === 'completed' ? 'rgba(16,185,129,0.05)' : 'rgba(0,0,0,0.02)',
                            border: a.status === 'blocked' ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--glass-border)',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '220px' }}>
                            <Avatar
                              src={a.member?.avatar_url}
                              name={a.member?.full_name}
                              size="sm"
                              border
                            />
                            <div>
                              <strong style={{ fontSize: '0.9rem', color: 'var(--foreground)', display: 'block' }}>
                                {a.member?.full_name || 'Unassigned'}
                              </strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                                {a.responsibility}
                              </span>
                              {a.blocker_reason && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--error)', fontWeight: 600, marginTop: '2px' }}>
                                  Blocker: {a.blocker_reason}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: 600,
                                background: a.status === 'completed'
                                  ? 'rgba(16,185,129,0.15)'
                                  : a.status === 'blocked'
                                  ? 'rgba(239,68,68,0.15)'
                                  : a.status === 'in_progress'
                                  ? 'rgba(59,130,246,0.15)'
                                  : 'rgba(100,116,139,0.12)',
                                color: a.status === 'completed'
                                  ? '#059669'
                                  : a.status === 'blocked'
                                  ? '#dc2626'
                                  : a.status === 'in_progress'
                                  ? '#2563eb'
                                  : '#64748b',
                                textTransform: 'capitalize',
                              }}
                            >
                              {a.status.replace('_', ' ')}
                            </span>

                            {a.due_date && (
                              <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
                                Due {new Date(a.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            )}

                            <button
                              onClick={() => setSelectedCommentAssignment({ assignment: a, taskTitle: t.title })}
                              className="btn btn-secondary"
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.74rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                              title="View Discussion & Audit Trail"
                              aria-label="View Discussion & Audit Trail"
                            >
                              <MessageSquare size={13} />
                              <span>{(a.comments || []).length > 0 ? (a.comments || []).length : 'Chat'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mobile Sticky Floating Action Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="btn btn-primary tasks-mobile-fab"
        aria-label="Create New Task"
      >
        <Plus size={18} style={{ marginRight: '6px' }} /> Create Task
      </button>

      {/* Create Task Modal */}
      {showCreateModal && (
        <TaskCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          members={membersList}
          songs={songsList}
          sequences={sequencesList}
          onSuccess={refreshData}
        />
      )}

      {/* Review Reassignment Request Modal */}
      {reviewingRequest && (
        <ReassignmentApprovalModal
          isOpen={Boolean(reviewingRequest)}
          onClose={() => setReviewingRequest(null)}
          request={reviewingRequest}
          members={membersList}
          onSuccess={refreshData}
        />
      )}

      {/* Confirm Delete Modal */}
      {deleteConfirmTaskId && (
        <ConfirmModal
          title="Delete Task?"
          message="Are you sure you want to permanently delete this task and all assigned responsibilities? This action cannot be undone."
          confirmLabel="Delete Task"
          isDanger
          onConfirm={handleDeleteTask}
          onCancel={() => setDeleteConfirmTaskId(null)}
        />
      )}

      {/* Task Progress Timeline Modal */}
      {timelineTask && (
        <TaskTimelineModal
          isOpen={Boolean(timelineTask)}
          onClose={() => setTimelineTask(null)}
          task={timelineTask}
        />
      )}

      {/* Discussion & Audit Trail Drawer */}
      {selectedCommentAssignment && (
        <CommentsDrawer
          isOpen={Boolean(selectedCommentAssignment)}
          onClose={() => setSelectedCommentAssignment(null)}
          assignmentId={selectedCommentAssignment.assignment.id}
          taskTitle={selectedCommentAssignment.taskTitle}
          responsibility={selectedCommentAssignment.assignment.responsibility}
          initialComments={selectedCommentAssignment.assignment.comments || []}
          initialHistory={selectedCommentAssignment.assignment.history || []}
          currentUserId={currentUserProfile.id}
        />
      )}
    </div>
  );
};
