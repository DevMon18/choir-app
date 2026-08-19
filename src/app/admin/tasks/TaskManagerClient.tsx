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
import { CustomGroupModal } from './components/CustomGroupModal';
import { ForwardTaskModal } from './components/ForwardTaskModal';
import { MergeTasksModal } from './components/MergeTasksModal';
import { CommentsDrawer } from '@/app/tasks/components/CommentsDrawer';
import { findDuplicateTaskClusters } from './utils/similarity';
import {
  getAllTasksAdmin,
  getPendingRequestsAdmin,
  getCustomGroupsAdmin,
  resolveCantComplete,
  archiveTask,
  deleteTask,
  removeTaskAssignment,
} from './actions';
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
  Users,
  UserPlus,
  GitMerge,
  Layers,
  X,
} from 'lucide-react';
import gsap from 'gsap';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { TaskItem, TaskRequestItem, TaskAssignmentItem, CustomGroup } from '@/app/tasks/types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
  avatar_url?: string | null;
  role?: string;
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
  initialCustomGroups: CustomGroup[];
  membersList: MemberOption[];
  songsList: SongOption[];
  sequencesList: SequenceOption[];
}

export const TaskManagerClient: React.FC<TaskManagerClientProps> = ({
  currentUserProfile,
  initialTasks,
  initialRequests,
  initialCustomGroups,
  membersList,
  songsList,
  sequencesList,
}) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [requests, setRequests] = useState<TaskRequestItem[]>(initialRequests);
  const [customGroups, setCustomGroups] = useState<CustomGroup[]>(initialCustomGroups);
  const [activeTab, setActiveTab] = useState<'active' | 'blocked' | 'overdue' | 'all' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetTask, setMergeTargetTask] = useState<TaskItem | null>(null);
  const [mergeSourceTasks, setMergeSourceTasks] = useState<TaskItem[]>([]);
  const [ignoredClusterIds, setIgnoredClusterIds] = useState<string[]>([]);
  const [forwardTargetTask, setForwardTargetTask] = useState<TaskItem | null>(null);
  const [reviewingRequest, setReviewingRequest] = useState<TaskRequestItem | null>(null);
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const [deleteAssignmentTarget, setDeleteAssignmentTarget] = useState<{
    id: string;
    memberName: string;
    taskTitle: string;
    responsibility: string;
  } | null>(null);
  const [timelineTask, setTimelineTask] = useState<TaskItem | null>(null);
  const [selectedCommentAssignment, setSelectedCommentAssignment] = useState<{ assignment: TaskAssignmentItem; taskTitle: string } | null>(null);

  const isDirectorOrSuperAdmin = ['super_admin', 'director'].includes(currentUserProfile.role);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  useEffect(() => {
    setCustomGroups(initialCustomGroups);
  }, [initialCustomGroups]);

  const refreshData = async () => {
    const [freshTasks, freshReqs, freshGroups] = await Promise.all([
      getAllTasksAdmin(),
      getPendingRequestsAdmin(),
      getCustomGroupsAdmin(),
    ]);
    setTasks(freshTasks);
    setRequests(freshReqs);
    setCustomGroups(freshGroups);
  };

  // Realtime subscription for director tasks & action center & groups
  useRealtimeSync({
    channelName: `admin-tasks-sync-${currentUserProfile.id}`,
    tables: [
      { table: 'tasks' },
      { table: 'task_assignments' },
      { table: 'task_requests' },
      { table: 'custom_groups' },
      { table: 'custom_group_members' },
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

  // Detect duplicate task clusters on active tasks (95% - 100% similarity on title & description)
  const allDuplicateClusters = useMemo(() => {
    return findDuplicateTaskClusters(tasks, 0.92);
  }, [tasks]);

  const duplicateClusters = useMemo(() => {
    return allDuplicateClusters.filter((c) => !ignoredClusterIds.includes(c.id));
  }, [allDuplicateClusters, ignoredClusterIds]);

  // Set of task IDs that actually have high-similarity duplicates
  const tasksWithDuplicates = useMemo(() => {
    const ids = new Set<string>();
    allDuplicateClusters.forEach((c) => {
      ids.add(c.primaryTask.id);
      c.duplicateTasks.forEach((d) => ids.add(d.id));
    });
    return ids;
  }, [allDuplicateClusters]);

  // Collect all "Can't Complete" assignments across active tasks
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

  // Collect all Overdue assignments across active tasks
  const overdueAssignments = useMemo(() => {
    const list: TaskAssignmentItem[] = [];
    tasks.forEach((t) => {
      if (!t.is_archived && t.assignments) {
        t.assignments.forEach((a) => {
          if (a.status === 'overdue') list.push(a);
        });
      }
    });
    return list;
  }, [tasks]);

  // Filter tasks based on search & tab
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Tab filter
      if (activeTab === 'archived' && !t.is_archived) return false;
      if (activeTab !== 'archived' && t.is_archived && activeTab !== 'all') return false;

      if (activeTab === 'blocked') {
        const hasBlocked = t.assignments?.some((a) => a.status === 'blocked');
        if (!hasBlocked) return false;
      }

      if (activeTab === 'overdue') {
        const hasOverdue = t.assignments?.some((a) => a.status === 'overdue');
        if (!hasOverdue) return false;
      }

      if (activeTab === 'active') {
        if (t.is_archived) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchResponsibility = t.assignments?.some(
          (a) =>
            a.responsibility.toLowerCase().includes(q) ||
            a.member?.full_name.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchDesc && !matchResponsibility) return false;
      }

      return true;
    });
  }, [tasks, activeTab, searchQuery]);

  const handleToggleArchive = async (task: TaskItem) => {
    const res = await archiveTask(task.id, !task.is_archived);
    if (res.error) {
      addToast({ type: 'error', title: 'Error', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: task.is_archived ? 'Task Restored' : 'Task Archived',
        message: `"${task.title}" was ${task.is_archived ? 'restored' : 'archived'}.`,
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
      addToast({ type: 'success', title: 'Task Deleted', message: 'The task and its responsibilities were deleted.' });
      refreshData();
    }
  };

  const handleRemoveAssignment = async () => {
    if (!deleteAssignmentTarget) return;
    const res = await removeTaskAssignment(deleteAssignmentTarget.id);
    const target = deleteAssignmentTarget;
    setDeleteAssignmentTarget(null);

    if (res.error) {
      addToast({ type: 'error', title: 'Removal Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Member Removed',
        message: `${target.memberName} was removed from "${target.taskTitle}".`,
      });
      refreshData();
    }
  };

  const handleResolveCantComplete = async (assignment: TaskAssignmentItem) => {
    const note = prompt(`Enter resolution note or assistance instructions for ${assignment.member?.full_name}:`, 'Issue resolved by Officer');
    if (note === null) return; // user cancelled

    const res = await resolveCantComplete(assignment.id, note);
    if (res.error) {
      addToast({ type: 'error', title: 'Resolution Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Status Resolved',
        message: `Task resumed for ${assignment.member?.full_name}.`,
      });
      refreshData();
    }
  };

  const startMergeCluster = (cluster: { primaryTask: TaskItem; duplicateTasks: TaskItem[] }) => {
    setMergeTargetTask(cluster.primaryTask);
    setMergeSourceTasks(cluster.duplicateTasks);
    setShowMergeModal(true);
  };

  const openGeneralMergeModal = () => {
    if (duplicateClusters.length > 0) {
      setMergeTargetTask(duplicateClusters[0].primaryTask);
      setMergeSourceTasks(duplicateClusters[0].duplicateTasks);
    } else {
      setMergeTargetTask(null);
      setMergeSourceTasks([]);
    }
    setShowMergeModal(true);
  };

  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <Navbar profile={currentUserProfile} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 16px 100px 16px' }}>
        {/* Header Title Bar */}
        <div
          className="anim-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  boxShadow: '0 6px 18px rgba(11, 77, 36, 0.25)',
                }}
              >
                <ListTodo size={22} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--foreground)' }}>
                  Task Manager & Delegation
                </h1>
                <p style={{ fontSize: '0.86rem', color: 'var(--muted)', margin: '2px 0 0' }}>
                  Delegate choir tasks, manage voice section responsibilities & committees
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isDirectorOrSuperAdmin && (
              <button
                onClick={openGeneralMergeModal}
                className="btn btn-secondary"
                style={{
                  padding: '10px 16px',
                  fontSize: '0.88rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: duplicateClusters.length > 0 ? '#2563eb' : undefined,
                  color: duplicateClusters.length > 0 ? '#2563eb' : undefined,
                  background: duplicateClusters.length > 0 ? 'rgba(37, 99, 235, 0.06)' : undefined,
                }}
                title="Consolidate duplicate tasks into one"
              >
                <GitMerge size={16} />
                <span>Merge Tasks</span>
                {duplicateClusters.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: '#2563eb',
                      color: '#ffffff',
                    }}
                  >
                    {duplicateClusters.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setShowGroupModal(true)}
              className="btn btn-secondary"
              style={{
                padding: '10px 16px',
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              title="Manage Custom Groups and Committees"
            >
              <Users size={16} />
              <span>Custom Groups ({customGroups.length})</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                borderRadius: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(11, 77, 36, 0.3)',
              }}
            >
              <Plus size={18} />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* Action Center Banner */}
        <ActionCenterBanner
          requests={requests}
          blockedAssignments={blockedAssignments}
          overdueCount={overdueAssignments.length}
          onReviewRequest={(req) => setReviewingRequest(req)}
          onResolveBlocker={handleResolveCantComplete}
          onSelectTab={(tab) => setActiveTab(tab)}
        />

        {/* Smart Duplicate Task Cluster Notice (Director & Super Admin only) */}
        {isDirectorOrSuperAdmin && duplicateClusters.length > 0 && (
          <div
            className="anim-card"
            style={{
              marginBottom: '20px',
              padding: '14px 18px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              border: '1.5px solid rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 4px 16px rgba(37, 99, 235, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#2563eb',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Layers size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '0.92rem', color: '#1e3a8a', display: 'block' }}>
                  {duplicateClusters.length} Potential Duplicate Task Group(s) Detected
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#3b82f6' }}>
                  e.g. {duplicateClusters.map((c) => `"${c.commonTitle}"`).slice(0, 2).join(', ')} have high similarity (95%+) and can be consolidated.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {duplicateClusters.slice(0, 2).map((cluster, idx) => (
                <button
                  key={idx}
                  onClick={() => startMergeCluster(cluster)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid rgba(37, 99, 235, 0.3)',
                    color: '#1d4ed8',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <GitMerge size={13} /> Merge &ldquo;{cluster.commonTitle}&rdquo;
                </button>
              ))}

              <button
                onClick={() => setIgnoredClusterIds((prev) => [...prev, ...duplicateClusters.map((c) => c.id)])}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid rgba(100, 116, 139, 0.25)',
                  color: '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Dismiss duplicate notice"
              >
                Ignore
              </button>
            </div>
          </div>
        )}

        {/* Filter and Tab Bar */}
        <div
          className="glass-container anim-card"
          style={{
            padding: '12px 18px',
            borderRadius: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.04)', padding: '4px', borderRadius: '24px', flexWrap: 'wrap' }}>
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
                  transition: 'all 0.15s ease',
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
                  background: activeTab === 'blocked' ? '#ea580c' : 'transparent',
                  color: activeTab === 'blocked' ? '#fff' : 'var(--muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                Can&apos;t Complete ({blockedAssignments.length})
              </button>

              <button
                onClick={() => setActiveTab('overdue')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'overdue' ? '#dc2626' : 'transparent',
                  color: activeTab === 'overdue' ? '#fff' : 'var(--muted)',
                  transition: 'all 0.15s ease',
                }}
              >
                Overdue ({overdueAssignments.length})
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
                placeholder="Search tasks, members, or roles..."
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
              const isExpanded = expandedTasks[t.id] ?? true;

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setForwardTargetTask(t)}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          borderColor: 'rgba(11, 77, 36, 0.25)',
                          color: 'var(--primary)',
                          background: 'rgba(11, 77, 36, 0.04)',
                        }}
                        title="Forward / Add Assignees to this task"
                        aria-label="Forward / Add Assignees to this task"
                      >
                        <UserPlus size={14} /> Add Assignee
                      </button>

                      {isDirectorOrSuperAdmin && tasksWithDuplicates.has(t.id) && (
                        <button
                          onClick={() => {
                            setMergeTargetTask(t);
                            setMergeSourceTasks([]);
                            setShowMergeModal(true);
                          }}
                          className="btn btn-secondary"
                          style={{
                            padding: '6px 10px',
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#2563eb',
                            borderColor: 'rgba(37, 99, 235, 0.2)',
                            background: 'rgba(37, 99, 235, 0.04)',
                          }}
                          title="Merge duplicate task"
                          aria-label="Merge duplicate task"
                        >
                          <GitMerge size={13} /> Merge
                        </button>
                      )}

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
                            background: a.status === 'blocked' ? 'rgba(249,115,22,0.08)' : a.status === 'overdue' ? 'rgba(239,68,68,0.08)' : a.status === 'completed' ? 'rgba(16,185,129,0.05)' : 'rgba(0,0,0,0.02)',
                            border: a.status === 'blocked' ? '1px solid rgba(249,115,22,0.25)' : a.status === 'overdue' ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--glass-border)',
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
                                <div style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 600, marginTop: '2px' }}>
                                  Reason: {a.blocker_reason}
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
                                  ? 'rgba(249,115,22,0.18)'
                                  : a.status === 'overdue'
                                  ? 'rgba(239,68,68,0.15)'
                                  : a.status === 'in_progress'
                                  ? 'rgba(59,130,246,0.15)'
                                  : 'rgba(100,116,139,0.12)',
                                color: a.status === 'completed'
                                  ? '#059669'
                                  : a.status === 'blocked'
                                  ? '#ea580c'
                                  : a.status === 'overdue'
                                  ? '#dc2626'
                                  : a.status === 'in_progress'
                                  ? '#2563eb'
                                  : '#64748b',
                                textTransform: 'capitalize',
                              }}
                            >
                              {a.status === 'blocked' ? "Can't Complete" : a.status.replace('_', ' ')}
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

                            <button
                              onClick={() =>
                                setDeleteAssignmentTarget({
                                  id: a.id,
                                  memberName: a.member?.full_name || 'Member',
                                  taskTitle: t.title,
                                  responsibility: a.responsibility,
                                })
                              }
                              className="btn btn-secondary"
                              style={{
                                padding: '4px 7px',
                                fontSize: '0.74rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--error)',
                                borderColor: 'rgba(220, 38, 38, 0.22)',
                                background: 'rgba(220, 38, 38, 0.04)',
                              }}
                              title={`Remove ${a.member?.full_name || 'member'} from this task`}
                              aria-label={`Remove ${a.member?.full_name || 'member'} from this task`}
                            >
                              <X size={13} />
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

      {/* Create Task Modal (with live duplicate detection) */}
      {showCreateModal && (
        <TaskCreateModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          members={membersList}
          songs={songsList}
          sequences={sequencesList}
          customGroups={customGroups}
          existingTasks={tasks}
          onOpenGroupManager={() => {
            setShowCreateModal(false);
            setShowGroupModal(true);
          }}
          onSuccess={refreshData}
        />
      )}

      {/* Custom Groups & Committees Modal */}
      {showGroupModal && (
        <CustomGroupModal
          isOpen={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          groups={customGroups}
          members={membersList}
          onRefresh={refreshData}
        />
      )}

      {/* Merge Duplicate Tasks Modal */}
      {showMergeModal && (
        <MergeTasksModal
          isOpen={showMergeModal}
          onClose={() => {
            setShowMergeModal(false);
            setMergeTargetTask(null);
            setMergeSourceTasks([]);
          }}
          tasks={tasks}
          initialTargetTask={mergeTargetTask}
          initialSourceTasks={mergeSourceTasks}
          onSuccess={refreshData}
        />
      )}

      {/* Forward Task Assignees Modal */}
      {forwardTargetTask && (
        <ForwardTaskModal
          isOpen={Boolean(forwardTargetTask)}
          onClose={() => setForwardTargetTask(null)}
          task={forwardTargetTask}
          members={membersList}
          customGroups={customGroups}
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

      {/* Confirm Remove Member Assignment Modal */}
      {deleteAssignmentTarget && (
        <ConfirmModal
          title="Remove Member from Task?"
          message={`Are you sure you want to remove ${deleteAssignmentTarget.memberName} from "${deleteAssignmentTarget.responsibility}" in "${deleteAssignmentTarget.taskTitle}"?`}
          confirmLabel="Remove Member"
          isDanger
          onConfirm={handleRemoveAssignment}
          onCancel={() => setDeleteAssignmentTarget(null)}
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
