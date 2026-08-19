'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { TaskCard } from './components/TaskCard';
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
    const active = assignments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;
    const blocked = assignments.filter((a) => a.status === 'blocked').length;
    const completed = assignments.filter((a) => a.status === 'completed').length;
    return { all: assignments.length, active, blocked, completed };
  }, [assignments]);

  const isOfficer = isUserOfficer(currentUserProfile.role);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '500px', height: '500px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }}></div>

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full" style={{ maxWidth: '960px', margin: '0 auto', width: '100%', padding: '20px' }}>
        {/* Header Title & Admin Switch Link */}
        <div className="anim-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ListTodo size={22} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                My Tasks & Responsibilities
              </h1>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '4px 0 0 50px' }}>
              View and track responsibilities assigned to you by Choir Officers.
            </p>
          </div>

          {isOfficer && (
            <Link
              href="/admin/tasks"
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.86rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Settings size={15} /> Manage All Tasks →
            </Link>
          )}
        </div>

        {/* Status Pill Tabs & Search Filter Bar */}
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <PlayCircle size={14} /> Active ({counts.active})
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
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <AlertTriangle size={14} /> Can&apos;t Complete ({counts.blocked})
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                style={{
                  padding: '7px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'completed' ? '#10b981' : 'transparent',
                  color: activeTab === 'completed' ? '#fff' : 'var(--muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={14} /> Completed ({counts.completed})
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
                All ({counts.all})
              </button>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search tasks or responsibilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', height: '36px', fontSize: '0.84rem', borderRadius: '18px' }}
              />
            </div>
          </div>
        </div>

        {/* Task Cards List */}
        {filteredAssignments.length === 0 ? (
          <div className="glass-container anim-card" style={{ padding: '40px 20px', textAlign: 'center', borderRadius: '20px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(11,77,36,0.08)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Sparkles size={28} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--foreground)' }}>
              {activeTab === 'active' ? 'You are all caught up!' : 'No tasks found'}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', maxWidth: '420px', margin: '0 auto 16px' }}>
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
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.84rem' }}
              >
                View All Tasks
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredAssignments.map((assignment) => (
              <TaskCard
                key={assignment.id}
                assignment={assignment}
                onOpenBlocker={(a) => setBlockerTarget(a)}
                onOpenReassign={(a) => setReassignTarget(a)}
                onOpenComments={(a) => setCommentsTarget(a)}
                onRefresh={refreshAssignments}
              />
            ))}
          </div>
        )}
      </main>

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
