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
import { ResolveCantCompleteModal } from './components/ResolveCantCompleteModal';
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
  const [resolvingAssignment, setResolvingAssignment] = useState<{
    assignment: TaskAssignmentItem;
    taskTitle?: string;
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

  const handleResolveCantComplete = (assignment: TaskAssignmentItem) => {
    const parentTask = tasks.find((t) => t.assignments?.some((a) => a.id === assignment.id));
    setResolvingAssignment({
      assignment,
      taskTitle: parentTask?.title,
    });
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
    <div ref={containerRef} className="min-h-screen bg-background text-foreground">
      <Navbar profile={currentUserProfile} />

      <main className="max-w-[1200px] mx-auto pt-8 px-4 pb-[100px]">
        {/* Header Title Bar */}
        <div className="anim-header flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10.5 h-10.5 rounded-xl bg-gradient-to-br from-primary to-green-700 text-white flex items-center justify-center shadow-lg shadow-primary/25">
                <ListTodo size={22} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-[1.75rem] font-extrabold m-0 tracking-tight text-foreground">
                  Task Manager & Delegation
                </h1>
                <p className="text-xs sm:text-sm text-muted mt-0.5 mb-0">
                  Delegate choir tasks, manage voice section responsibilities & committees
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {isDirectorOrSuperAdmin && (
              <button
                onClick={openGeneralMergeModal}
                className={`btn btn-secondary !py-2.5 !px-4 text-xs sm:text-sm inline-flex items-center gap-1.5 ${
                  duplicateClusters.length > 0
                    ? '!border-blue-600 !text-blue-600 !bg-blue-600/6'
                    : ''
                }`}
                title="Consolidate duplicate tasks into one"
              >
                <GitMerge size={16} />
                <span>Merge Tasks</span>
                {duplicateClusters.length > 0 && (
                  <span className="text-[0.72rem] font-extrabold py-px px-1.5 rounded-full bg-blue-600 text-white">
                    {duplicateClusters.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setShowGroupModal(true)}
              className="btn btn-secondary !py-2.5 !px-4 text-xs sm:text-sm inline-flex items-center gap-1.5"
              title="Manage Custom Groups and Committees"
            >
              <Users size={16} />
              <span>Custom Groups ({customGroups.length})</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary !py-2.5 !px-5 text-xs sm:text-sm !rounded-xl font-bold inline-flex items-center gap-2 shadow-md shadow-primary/30"
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
          <div className="anim-card mb-5 py-3.5 px-4.5 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border-[1.5px] border-blue-600/25 flex items-center justify-between flex-wrap gap-3 shadow-md shadow-blue-600/8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <Layers size={18} />
              </div>
              <div>
                <strong className="text-xs sm:text-sm text-blue-900 block">
                  {duplicateClusters.length} Potential Duplicate Task Group(s) Detected
                </strong>
                <p className="mt-0.5 mb-0 text-xs text-blue-600">
                  e.g. {duplicateClusters.map((c) => `"${c.commonTitle}"`).slice(0, 2).join(', ')} have high similarity (95%+) and can be consolidated.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {duplicateClusters.slice(0, 2).map((cluster, idx) => (
                <button
                  key={idx}
                  onClick={() => startMergeCluster(cluster)}
                  className="py-1.5 px-3 rounded-lg bg-white border border-blue-600/30 text-blue-700 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <GitMerge size={13} /> Merge &ldquo;{cluster.commonTitle}&rdquo;
                </button>
              ))}

              <button
                onClick={() => setIgnoredClusterIds((prev) => [...prev, ...duplicateClusters.map((c) => c.id)])}
                className="py-1.5 px-3 rounded-lg bg-white border border-slate-500/25 text-slate-600 text-xs font-semibold cursor-pointer"
                title="Dismiss duplicate notice"
              >
                Ignore
              </button>
            </div>
          </div>
        )}

        {/* Filter and Tab Bar */}
        <div className="glass-container anim-card py-3 px-4.5 rounded-2xl mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap w-full justify-between">
            {/* Tabs */}
            <div className="flex gap-1.5 bg-black/4 p-1 rounded-full flex-wrap">
              <button
                onClick={() => setActiveTab('active')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-none cursor-pointer transition-all duration-150 ${
                  activeTab === 'active'
                    ? 'bg-primary text-white'
                    : 'bg-transparent text-muted'
                }`}
              >
                Active Tasks ({tasks.filter((t) => !t.is_archived).length})
              </button>

              <button
                onClick={() => setActiveTab('blocked')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-none cursor-pointer transition-all duration-150 ${
                  activeTab === 'blocked'
                    ? 'bg-orange-600 text-white'
                    : 'bg-transparent text-muted'
                }`}
              >
                Can&apos;t Complete ({blockedAssignments.length})
              </button>

              <button
                onClick={() => setActiveTab('overdue')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-none cursor-pointer transition-all duration-150 ${
                  activeTab === 'overdue'
                    ? 'bg-red-600 text-white'
                    : 'bg-transparent text-muted'
                }`}
              >
                Overdue ({overdueAssignments.length})
              </button>

              <button
                onClick={() => setActiveTab('all')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-none cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-black/8 text-foreground'
                    : 'bg-transparent text-muted'
                }`}
              >
                All ({tasks.length})
              </button>

              <button
                onClick={() => setActiveTab('archived')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-none cursor-pointer ${
                  activeTab === 'archived'
                    ? 'bg-black/8 text-foreground'
                    : 'bg-transparent text-muted'
                }`}
              >
                Archived ({tasks.filter((t) => t.is_archived).length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 max-w-[320px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search tasks, members, or roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full pl-8.5 pr-3 h-9 text-xs rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="glass-container anim-card py-10 px-5 text-center rounded-3xl">
            <ListTodo size={40} className="mx-auto mb-3 opacity-35 text-primary" />
            <h3 className="text-lg sm:text-xl font-bold m-0 mb-1.5 text-foreground">
              No tasks found
            </h3>
            <p className="text-xs sm:text-sm text-muted max-w-[420px] mx-auto mb-4">
              {activeTab === 'active'
                ? 'Create a new task and delegate responsibilities to choir members.'
                : 'No tasks match your current filter or query.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary !py-2 !px-4.5 text-xs sm:text-sm"
            >
              + Create First Task
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredTasks.map((t) => {
              const assignments = t.assignments || [];
              const total = assignments.length;
              const completed = assignments.filter((a) => a.status === 'completed').length;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isExpanded = expandedTasks[t.id] ?? true;

              return (
                <div
                  key={t.id}
                  className="anim-card p-5.5 sm:py-5.5 sm:px-6 rounded-3xl bg-white border border-primary/12 shadow-sm"
                >
                  {/* Task Card Header */}
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`py-0.5 px-2 rounded-md text-[0.74rem] font-bold uppercase ${
                            t.priority === 'urgent'
                              ? 'bg-red-500/12 text-red-600'
                              : t.priority === 'high'
                              ? 'bg-orange-500/12 text-orange-600'
                              : 'bg-blue-500/12 text-blue-600'
                          }`}
                        >
                          {t.priority}
                        </span>

                        {t.is_archived && (
                          <span className="py-0.5 px-2 rounded-md text-[0.72rem] font-semibold bg-slate-500/15 text-slate-600">
                            Archived
                          </span>
                        )}

                        {t.due_date && (
                          <span className="text-xs text-muted inline-flex items-center gap-1">
                            <Calendar size={13} /> Due: {new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg sm:text-xl font-extrabold text-foreground m-0 mb-1.5">
                        {t.title}
                      </h2>
                      {t.description && (
                        <p className="m-0 mb-2.5 text-xs sm:text-sm text-muted leading-normal">
                          {t.description}
                        </p>
                      )}

                      {/* Related Entities */}
                      {(t.related_song || t.related_sequence) && (
                        <div className="flex gap-2 flex-wrap mb-2">
                          {t.related_song && (
                            <Link
                              href={`/repertoire/${t.related_song.id}`}
                              className="no-underline inline-flex items-center gap-1.5 py-0.5 px-2 rounded-lg text-xs font-semibold bg-blue-900/8 text-primary"
                            >
                              <Music size={12} /> Song: {t.related_song.title}
                            </Link>
                          )}
                          {t.related_sequence && (
                            <Link
                              href={`/calendar`}
                              className="no-underline inline-flex items-center gap-1.5 py-0.5 px-2 rounded-lg text-xs font-semibold bg-accent/12 text-accent"
                            >
                              <Mic size={12} /> Mass: {t.related_sequence.title}
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Action Menu */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setForwardTargetTask(t)}
                        className="btn btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 !border-primary/25 !text-primary !bg-primary/4"
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
                          className="btn btn-secondary !py-1.5 !px-2.5 text-xs inline-flex items-center gap-1 !text-blue-600 !border-blue-600/20 !bg-blue-600/4"
                          title="Merge duplicate task"
                          aria-label="Merge duplicate task"
                        >
                          <GitMerge size={13} /> Merge
                        </button>
                      )}

                      <button
                        onClick={() => setTimelineTask(t)}
                        className="btn btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1.5 !border-primary/20 !text-primary !bg-primary/4"
                        title="View Task Progress History & Timeline"
                        aria-label="View Task Progress History & Timeline"
                      >
                        <History size={14} /> Timeline
                      </button>

                      <button
                        onClick={() => handleToggleArchive(t)}
                        className="btn btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                        title={t.is_archived ? 'Restore Task' : 'Archive Task'}
                        aria-label={t.is_archived ? 'Restore Task' : 'Archive Task'}
                      >
                        <Archive size={14} /> {t.is_archived ? 'Restore' : 'Archive'}
                      </button>

                      <button
                        onClick={() => setDeleteConfirmTaskId(t.id)}
                        className="btn btn-secondary !py-1.5 !px-2.5 text-xs !text-error !border-none"
                        title="Delete Task"
                        aria-label="Delete Task"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Progress Rollup Bar */}
                  <div className="my-3.5">
                    <div className="flex justify-between items-center mb-1.5 text-xs sm:text-[0.82rem]">
                      <span className="font-bold text-foreground">
                        Overall Progress: {completed}/{total} Completed ({percent}%)
                      </span>
                      <button
                        onClick={() => toggleExpand(t.id)}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Hide responsibilities for ${t.title}` : `View responsibilities for ${t.title}`}
                        className="bg-transparent border-none text-primary cursor-pointer font-semibold text-xs inline-flex items-center gap-1"
                      >
                        {isExpanded ? <>Hide Responsibilities <ChevronUp size={14} /></> : <>View Responsibilities ({total}) <ChevronDown size={14} /></>}
                      </button>
                    </div>

                    <div className="h-2 w-full bg-black/8 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-400 ${
                          percent === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-accent'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Collapsible Responsibilities List */}
                  {isExpanded && (
                    <div className="border-t border-glass-border pt-3.5 flex flex-col gap-2">
                      {assignments.map((a) => (
                        <div
                          key={a.id}
                          className={`flex items-center justify-between p-2.5 sm:py-2.5 sm:px-3.5 rounded-xl flex-wrap gap-2 ${
                            a.status === 'blocked'
                              ? 'bg-orange-500/8 border border-orange-500/25'
                              : a.status === 'overdue'
                              ? 'bg-red-500/8 border border-red-500/25'
                              : a.status === 'completed'
                              ? 'bg-emerald-500/5 border border-glass-border'
                              : 'bg-black/2 border border-glass-border'
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-[220px]">
                            <Avatar
                              src={a.member?.avatar_url}
                              name={a.member?.full_name}
                              size="sm"
                              border
                            />
                            <div>
                              <strong className="text-xs sm:text-sm text-foreground block">
                                {a.member?.full_name || 'Unassigned'}
                              </strong>
                              <span className="text-xs text-muted">
                                {a.responsibility}
                              </span>
                              {a.blocker_reason && (
                                <div className="text-xs text-orange-600 font-semibold mt-0.5">
                                  Reason: {a.blocker_reason}
                                </div>
                              )}
                              {a.status === 'completed' && a.completion_comment && (
                                <div className="text-xs text-primary font-semibold mt-0.5">
                                  Note: &ldquo;{a.completion_comment}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`py-0.5 px-2 rounded-md text-[0.74rem] font-semibold capitalize ${
                                a.status === 'completed'
                                  ? 'bg-emerald-500/15 text-emerald-600'
                                  : a.status === 'blocked'
                                  ? 'bg-orange-500/18 text-orange-600'
                                  : a.status === 'overdue'
                                  ? 'bg-red-500/15 text-red-600'
                                  : a.status === 'in_progress'
                                  ? 'bg-blue-500/15 text-blue-600'
                                  : 'bg-slate-500/12 text-slate-600'
                              }`}
                            >
                              {a.status === 'blocked' ? "Can't Complete" : a.status.replace('_', ' ')}
                            </span>

                            {a.due_date && (
                              <span className="text-xs text-muted">
                                Due {new Date(a.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </span>
                            )}

                            <button
                              onClick={() => setSelectedCommentAssignment({ assignment: a, taskTitle: t.title })}
                              className="btn btn-secondary !py-1 !px-2 text-xs inline-flex items-center gap-1"
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
                              className="btn btn-secondary !py-1 !px-1.5 text-xs inline-flex items-center justify-center !text-error !border-red-600/22 !bg-red-600/4"
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
        <Plus size={18} className="mr-1.5" /> Create Task
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

      {/* Resolve Can't Complete Modal */}
      {resolvingAssignment && (
        <ResolveCantCompleteModal
          isOpen={Boolean(resolvingAssignment)}
          onClose={() => setResolvingAssignment(null)}
          assignment={resolvingAssignment.assignment}
          taskTitle={resolvingAssignment.taskTitle}
          onSuccess={refreshData}
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
