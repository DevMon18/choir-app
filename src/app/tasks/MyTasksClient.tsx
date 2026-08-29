'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { TaskCard } from './components/TaskCard';
import { CompleteTaskModal } from './components/CompleteTaskModal';
import { BlockerModal } from './components/BlockerModal';
import { ReassignmentModal } from './components/ReassignmentModal';
import { CommentsDrawer } from './components/CommentsDrawer';
import { getMyTaskAssignments } from './actions';
import { CheckCircle2, PlayCircle, AlertTriangle, Clock, Search, ListTodo, Sparkles, Settings } from 'lucide-react';
import gsap from 'gsap';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { isUserOfficer } from './types';
import type { TaskAssignmentItem } from './types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
}

interface MyTasksClientProps {
  currentUserProfile: { id: string; full_name: string; role: string };
  initialAssignments: TaskAssignmentItem[];
  membersList: MemberOption[];
}

export const MyTasksClient: React.FC<MyTasksClientProps> = ({
  currentUserProfile,
  initialAssignments,
  membersList,
}) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [assignments, setAssignments] = useState<TaskAssignmentItem[]>(initialAssignments);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'blocked' | 'completed'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [completeTarget, setCompleteTarget] = useState<TaskAssignmentItem | null>(null);
  const [blockerTarget, setBlockerTarget] = useState<TaskAssignmentItem | null>(null);
  const [reassignTarget, setReassignTarget] = useState<TaskAssignmentItem | null>(null);
  const [commentsTarget, setCommentsTarget] = useState<TaskAssignmentItem | null>(null);

  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  const refreshAssignments = async () => {
    const fresh = await getMyTaskAssignments();
    setAssignments(fresh);
  };

  // Realtime synchronization for member tasks
  useRealtimeSync({
    channelName: `my-tasks-sync-${currentUserProfile.id}`,
    tables: [
      { table: 'task_assignments' },
      { table: 'tasks' },
      { table: 'task_requests' },
    ],
    onEvent: () => {
      refreshAssignments();
    },
  });

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.anim-header', { opacity: 0, y: -12, duration: 0.35 });
      tl.from('.anim-card', { opacity: 0, y: 14, scale: 0.98, duration: 0.35, stagger: 0.035 }, '-=0.15');
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Filtered list
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      // Tab filter
      if (activeTab === 'active' && (a.status === 'completed' || a.status === 'reassigned')) return false;
      if (activeTab === 'blocked' && a.status !== 'blocked') return false;
      if (activeTab === 'completed' && a.status !== 'completed') return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTask = a.task?.title.toLowerCase().includes(q);
        const matchResp = a.responsibility.toLowerCase().includes(q);
        const matchDesc = a.task?.description?.toLowerCase().includes(q);
        if (!matchTask && !matchResp && !matchDesc) return false;
      }

      return true;
    });
  }, [assignments, activeTab, searchQuery]);

  // Counts
  const counts = useMemo(() => {
    const active = assignments.filter((a) => a.status !== 'completed' && a.status !== 'reassigned').length;
    const blocked = assignments.filter((a) => a.status === 'blocked').length;
    const completed = assignments.filter((a) => a.status === 'completed').length;
    return { all: assignments.length, active, blocked, completed };
  }, [assignments]);

  const isOfficer = isUserOfficer(currentUserProfile.role);

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full max-w-[960px] mx-auto w-full p-5">
        {/* Header Title & Admin Switch Link */}
        <div className="anim-header flex justify-between items-start mb-5 flex-wrap gap-3.5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-700 text-white flex items-center justify-center shadow-md">
                <ListTodo size={22} />
              </div>
              <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-foreground m-0">
                My Tasks & Responsibilities
              </h1>
            </div>
            <p className="text-muted text-sm mt-1 ml-0 sm:ml-12.5">
              View and track responsibilities assigned to you by Choir Officers.
            </p>
          </div>

          {isOfficer && (
            <Link
              href="/admin/tasks"
              className="btn btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1.5"
            >
              <Settings size={15} /> Manage All Tasks →
            </Link>
          )}
        </div>

        {/* Status Pill Tabs & Search Filter Bar */}
        <div className="anim-card py-3 px-4 rounded-2xl bg-white border border-primary/12 shadow-sm mb-5">
          <div className="flex justify-between items-center flex-wrap gap-3">
            {/* Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 max-w-full">
              <button
                onClick={() => setActiveTab('active')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-0 cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                  activeTab === 'active' ? 'bg-primary text-white' : 'bg-transparent text-muted hover:bg-black/5'
                }`}
              >
                <PlayCircle size={14} /> Active ({counts.active})
              </button>

              <button
                onClick={() => setActiveTab('blocked')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-0 cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                  activeTab === 'blocked' ? 'bg-orange-600 text-white' : 'bg-transparent text-muted hover:bg-black/5'
                }`}
              >
                <AlertTriangle size={14} /> Can&apos;t Complete ({counts.blocked})
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-0 cursor-pointer inline-flex items-center gap-1.5 transition-all ${
                  activeTab === 'completed' ? 'bg-emerald-500 text-white' : 'bg-transparent text-muted hover:bg-black/5'
                }`}
              >
                <CheckCircle2 size={14} /> Completed ({counts.completed})
              </button>

              <button
                onClick={() => setActiveTab('all')}
                className={`py-1.5 px-3.5 rounded-full text-xs font-semibold border-0 cursor-pointer transition-all ${
                  activeTab === 'all' ? 'bg-black/8 text-foreground' : 'bg-transparent text-muted hover:bg-black/5'
                }`}
              >
                All ({counts.all})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 max-w-[320px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search tasks or responsibilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field w-full pl-8.5 pr-3 h-9 text-xs sm:text-sm !rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Task Cards List */}
        {filteredAssignments.length === 0 ? (
          <div className="glass-container anim-card py-10 px-5 text-center rounded-2xl">
            <div className="w-14 h-14 rounded-full bg-primary/8 text-primary flex items-center justify-center mx-auto mb-3.5">
              <Sparkles size={28} />
            </div>
            <h3 className="text-xl font-bold mb-1.5 text-foreground">
              {activeTab === 'active' ? 'You are all caught up!' : 'No tasks found'}
            </h3>
            <p className="text-sm text-muted max-w-[420px] mx-auto mb-4">
              {activeTab === 'active'
                ? 'You currently have no active responsibilities assigned. Check back later or review your completed tasks.'
                : activeTab === 'blocked'
                ? 'No "Can\'t Complete" items reported.'
                : 'No responsibilities match your search or filter.'}
            </p>
            {activeTab !== 'all' && (
              <button
                onClick={() => {
                  setActiveTab('all');
                  setSearchQuery('');
                }}
                className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm"
              >
                View All Tasks
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {filteredAssignments.map((assignment) => (
              <TaskCard
                key={assignment.id}
                assignment={assignment}
                onOpenComplete={(a) => setCompleteTarget(a)}
                onOpenBlocker={(a) => setBlockerTarget(a)}
                onOpenReassign={(a) => setReassignTarget(a)}
                onOpenComments={(a) => setCommentsTarget(a)}
                onRefresh={refreshAssignments}
              />
            ))}
          </div>
        )}
      </main>

      {/* Complete Task Confirmation Modal */}
      {completeTarget && (
        <CompleteTaskModal
          isOpen={Boolean(completeTarget)}
          onClose={() => setCompleteTarget(null)}
          assignmentId={completeTarget.id}
          taskTitle={completeTarget.task?.title || 'Task'}
          responsibility={completeTarget.responsibility}
          onSuccess={refreshAssignments}
        />
      )}

      {/* Can't Complete Modal */}
      {blockerTarget && (
        <BlockerModal
          isOpen={Boolean(blockerTarget)}
          onClose={() => setBlockerTarget(null)}
          assignmentId={blockerTarget.id}
          taskTitle={blockerTarget.task?.title || 'Task'}
          responsibility={blockerTarget.responsibility}
          onSuccess={refreshAssignments}
        />
      )}

      {/* Reassignment Modal */}
      {reassignTarget && (
        <ReassignmentModal
          isOpen={Boolean(reassignTarget)}
          onClose={() => setReassignTarget(null)}
          assignmentId={reassignTarget.id}
          taskTitle={reassignTarget.task?.title || 'Task'}
          responsibility={reassignTarget.responsibility}
          members={membersList.filter((m) => m.id !== currentUserProfile.id)}
          isOfficer={isOfficer}
          onSuccess={refreshAssignments}
        />
      )}

      {/* Comments & Audit Trail Drawer */}
      {commentsTarget && (
        <CommentsDrawer
          isOpen={Boolean(commentsTarget)}
          onClose={() => setCommentsTarget(null)}
          assignmentId={commentsTarget.id}
          taskTitle={commentsTarget.task?.title || 'Task'}
          responsibility={commentsTarget.responsibility}
          initialComments={commentsTarget.comments || []}
          initialHistory={commentsTarget.history || []}
          currentUserId={currentUserProfile.id}
        />
      )}
    </div>
  );
};
