"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/app/actions';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';
import {
  Users,
  Music,
  ClipboardList,
  Music2,
  Mic,
  Megaphone,
  DollarSign,
  BarChart3,
  LogOut,
  User,
  Calendar,
  Radio,
  FileText,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Trophy,
  Sparkles,
  Home,
  CreditCard,
  Settings,
  Menu,
  Award,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  profile: {
    role: string;
    full_name: string;
  };
  children?: React.ReactNode;
}

type Role = string;

// Grouped Admin Navigation items for both Desktop Dropdown & Mobile Drawer
interface AdminCategoryGroup {
  title: string;
  items: {
    href: string;
    label: string;
    subtitle?: string;
    icon: React.ReactNode;
    roles: Role[];
    badgeKey?: 'users' | 'lyrics';
  }[];
}

const ADMIN_GROUPS: AdminCategoryGroup[] = [
  {
    title: 'Music & Liturgy',
    items: [
      { href: '/admin/songs', label: 'Manage Songs', subtitle: 'Repertoire catalog & ChordPro', icon: <Music2 size={16} />, roles: ['super_admin', 'director', 'secretary'] },
      { href: '/admin/sequences', label: 'Sequence Flow', subtitle: 'Mass order of songs', icon: <Mic size={16} />, roles: ['super_admin', 'director', 'secretary'] },
      { href: '/admin/lyrics-review', label: 'Lyrics Review', subtitle: 'Approve member submissions', icon: <Sparkles size={16} />, roles: ['super_admin', 'director'], badgeKey: 'lyrics' },
      { href: '/admin/documents', label: 'Document Templates', subtitle: 'Waivers & consent forms', icon: <FileText size={16} />, roles: ['super_admin', 'director'] },
    ],
  },
  {
    title: 'Members & Operations',
    items: [
      { href: '/admin/users', label: 'Manage Users', subtitle: 'Roster approval & roles', icon: <Users size={16} />, roles: ['super_admin', 'director', 'secretary'], badgeKey: 'users' },
      { href: '/admin/roster', label: 'Choir Roster', subtitle: 'Voice sections & parts', icon: <Music size={16} />, roles: ['super_admin', 'director', 'secretary'] },
      { href: '/admin/attendance', label: 'Attendance', subtitle: 'One-tap rehearsal & Mass roll', icon: <ClipboardList size={16} />, roles: ['super_admin', 'director', 'secretary'] },
      { href: '/admin/tasks', label: 'Manage Tasks', subtitle: 'Assign choir duties', icon: <ListTodo size={16} />, roles: ['super_admin', 'director', 'secretary', 'treasurer'] },
      { href: '/admin/announcements', label: 'Announcements', subtitle: 'Broadcasts & urgent alerts', icon: <Megaphone size={16} />, roles: ['super_admin', 'director', 'secretary'] },
      { href: '/admin/verifications', label: 'Verifications', subtitle: 'Signed waiver verification', icon: <ShieldCheck size={16} />, roles: ['super_admin', 'director', 'secretary'] },
    ],
  },
  {
    title: 'Finances & Reports',
    items: [
      { href: '/admin/finances', label: 'Finances & Sinking Fund', subtitle: 'Ledger, dues & receipts', icon: <DollarSign size={16} />, roles: ['super_admin', 'director', 'treasurer', 'secretary'] },
      { href: '/admin/analytics', label: 'Analytics & Reports', subtitle: 'Attendance & growth charts', icon: <BarChart3 size={16} />, roles: ['super_admin', 'director', 'secretary', 'treasurer'] },
    ],
  },
];

const hasAdminAccess = (role: Role) =>
  ['super_admin', 'director', 'secretary', 'treasurer'].includes(role);

// Desktop Top NavLink Component
const NavLink = ({
  href,
  icon,
  label,
  matchFn,
  pathname,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  matchFn?: (p: string) => boolean;
  pathname: string;
  badge?: number;
}) => {
  const active = matchFn ? matchFn(pathname) : pathname === href;
  return (
    <Link href={href} className={`nav-link ${active ? 'active' : ''}`} title={label}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-6px',
              background: 'var(--error)',
              color: '#ffffff',
              fontSize: '0.6rem',
              fontWeight: 800,
              borderRadius: '999px',
              padding: '1px 4px',
              minWidth: '13px',
              height: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              border: '1.5px solid #ffffff',
            }}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="nav-link-text">{label}</span>
    </Link>
  );
};

export const Navbar = ({ profile, children }: NavbarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { addToast } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adminSheetOpen, setAdminSheetOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingLyricsCount, setPendingLyricsCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const isAdminPage = pathname.startsWith('/admin');
  const isFinanceAdmin = ['super_admin', 'director', 'treasurer'].includes(profile.role);
  const canManageUsers = ['super_admin', 'director', 'secretary'].includes(profile.role);
  const isLyricsReviewer = ['super_admin', 'director'].includes(profile.role);

  // Unread messages & active tasks & pending signup approvals count & Realtime listener
  useEffect(() => {
    let channel: any;
    let isMounted = true;

    async function fetchPendingApprovals() {
      try {
        const [profilesRes, joinRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'pending'),
          supabase.from('join_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
        const count = (profilesRes.count || 0) + (joinRes.count || 0);
        if (isMounted) setPendingApprovalCount(count);
      } catch (err) {
        console.error('Navbar pending approvals fetch error:', err);
      }
    }

    async function fetchPendingLyrics() {
      try {
        const { count } = await supabase
          .from('song_submissions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending');
        if (isMounted) setPendingLyricsCount(count || 0);
      } catch (err) {
        console.error('Navbar pending lyrics fetch error:', err);
      }
    }

    async function fetchActiveTasks(userId: string) {
      try {
        const { data: assignments } = await supabase
          .from('task_assignments')
          .select('id, status, archived_at, task:task_id(is_archived)')
          .eq('member_id', userId)
          .is('archived_at', null)
          .neq('status', 'completed');

        if (isMounted && assignments) {
          const count = assignments.filter((a: any) => !a.task?.is_archived).length;
          setActiveTaskCount(count);
        }
      } catch (err) {
        console.error('Navbar task count fetch error:', err);
      }
    }

    async function fetchUnread() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !isMounted) return;

        // Initial task count fetch
        fetchActiveTasks(user.id);

        // Initial pending signups fetch for super_admin and officers
        if (canManageUsers) {
          fetchPendingApprovals();
        }

        // Initial pending lyrics fetch for directors and super_admin
        if (isLyricsReviewer) {
          fetchPendingLyrics();
        }

        const { data: convs } = await supabase
          .from('conversations')
          .select('id')
          .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);

        if (convs && convs.length > 0 && isMounted) {
          const convIds = convs.map((c) => c.id);
          const { count } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .in('conversation_id', convIds)
            .neq('sender_id', user.id)
            .is('read_at', null);

          if (isMounted) setUnreadCount(count || 0);
        }

        const channelTopic = `navbar-live-${user.id}-${Math.random().toString(36).substring(2, 7)}`;

        channel = supabase
          .channel(channelTopic)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
              const newMsg = payload.new as any;
              if (newMsg && newMsg.sender_id !== user.id) {
                setUnreadCount((prev) => prev + 1);
                if (!pathname.includes(newMsg.conversation_id)) {
                  addToast({
                    type: 'info',
                    title: '💬 New Direct Message',
                    message: newMsg.body ? newMsg.body.substring(0, 80) : 'You received a new message.',
                  });
                }
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'task_assignments', filter: `member_id=eq.${user.id}` },
            (payload) => {
              fetchActiveTasks(user.id);
              if (payload.eventType === 'INSERT') {
                addToast({
                  type: 'info',
                  title: '📋 New Task Assigned',
                  message: 'A new choir task or responsibility has been assigned to you.',
                });
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'tasks' },
            () => {
              fetchActiveTasks(user.id);
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            (payload) => {
              if (canManageUsers) {
                fetchPendingApprovals();
                if (payload.eventType === 'INSERT') {
                  const newProfile = payload.new as any;
                  if (newProfile?.role === 'pending') {
                    addToast({
                      type: 'info',
                      title: '👤 New Sign-Up Waiting for Approval',
                      message: `${newProfile.full_name || 'A new user'} has signed up and is waiting for your approval.`,
                    });
                  }
                }
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'join_requests' },
            (payload) => {
              if (canManageUsers) {
                fetchPendingApprovals();
                if (payload.eventType === 'INSERT') {
                  const newReq = payload.new as any;
                  if (newReq?.status === 'pending') {
                    addToast({
                      type: 'info',
                      title: '📝 New Join Application Submitted',
                      message: `${newReq.full_name || 'A new applicant'} applied to join the choir and is waiting for review.`,
                    });
                  }
                }
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'song_submissions' },
            (payload) => {
              if (isLyricsReviewer) {
                fetchPendingLyrics();
                if (payload.eventType === 'INSERT') {
                  addToast({
                    type: 'info',
                    title: '✨ New Lyrics Submitted for Review',
                    message: 'A choir member submitted new Mass Part lyrics waiting for your review.',
                  });
                }
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'announcements' },
            (payload) => {
              const ann = payload.new as any;
              addToast({
                type: 'info',
                title: '📢 New Announcement',
                message: ann?.title || 'A new choir announcement was posted.',
              });
              router.refresh();
            }
          )
          .subscribe();
      } catch (err) {
        console.error('Navbar real-time listener error:', err);
      }
    }

    fetchUnread();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUnread();
        router.refresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, pathname, addToast, router, canManageUsers, isLyricsReviewer]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on route change
  useEffect(() => {
    setDropdownOpen(false);
    setAdminSheetOpen(false);
  }, [pathname]);

  const totalAdminPending = (canManageUsers ? pendingApprovalCount : 0) + (isLyricsReviewer ? pendingLyricsCount : 0);
  const communityBadgeCount = (unreadCount > 0 ? unreadCount : 0) + (activeTaskCount > 0 ? activeTaskCount : 0);

  // Active matching helpers for top-level dropdown triggers
  const isMusicActive = pathname.startsWith('/repertoire') || pathname === '/live' || pathname === '/leaderboard' || pathname === '/profile/my-contributions';
  const isCommunityActive = pathname === '/calendar' || pathname.startsWith('/directory') || pathname.startsWith('/messages') || pathname.startsWith('/tasks');
  const isRecordsActive = pathname === '/dues' || pathname.startsWith('/solicitations') || pathname === '/my-documents' || pathname.startsWith('/sign') || pathname === '/profile';

  return (
    <>
      {/* ── Desktop / Top Navbar ── */}
      <nav className="nav-bar">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          <Link
            href="/dashboard"
            className="nav-brand"
            style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', color: 'inherit', flexShrink: 0 }}
          >
            <Image
              src="/collective-logo.png"
              alt="Choir Collective"
              width={32}
              height={32}
              priority
              style={{ borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
            />
            <span style={{ whiteSpace: 'nowrap' }}>Choir Collective</span>
          </Link>
          {children}
        </div>

        {/* Grouped Desktop Navigation */}
        <div className="nav-links" ref={dropdownRef}>
          <NavLink href="/dashboard" label="Dashboard" pathname={pathname} icon={<Home size={15} />} />

          {/* Group 1: 🎵 Music & Liturgy */}
          <div className="nav-dropdown-wrap">
            <button
              className={`nav-dropdown-trigger ${isMusicActive ? 'active' : ''} ${dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'music' ? 'open' : ''}`}
              onClick={() => {
                if (dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'music') {
                  setDropdownOpen(false);
                  dropdownRef.current?.removeAttribute('data-active-menu');
                } else {
                  setDropdownOpen(true);
                  dropdownRef.current?.setAttribute('data-active-menu', 'music');
                }
              }}
              aria-haspopup="true"
              title="Music & Liturgy"
            >
              <Music size={15} />
              <span className="nav-dropdown-text">Music &amp; Liturgy</span>
              <ChevronDown
                size={12}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'music' ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'music' && (
              <div className="nav-dropdown-panel" role="menu" style={{ minWidth: '260px' }}>
                <div className="nav-dropdown-label">Music &amp; Liturgy</div>
                <Link
                  href="/repertoire"
                  className={`nav-dropdown-item ${pathname.startsWith('/repertoire') ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><Music size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Repertoire &amp; Songbook</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Mass parts, hymn catalog &amp; chords</span>
                  </div>
                  {pathname.startsWith('/repertoire') && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                <Link
                  href="/live"
                  className={`nav-dropdown-item ${pathname === '/live' ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><Radio size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Live Sync Session</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Real-time synchronized Mass flow</span>
                  </div>
                  {pathname === '/live' && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                <Link
                  href="/leaderboard"
                  className={`nav-dropdown-item ${pathname === '/leaderboard' ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><Trophy size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Contributor Leaderboard</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Points &amp; contributor rankings</span>
                  </div>
                  {pathname === '/leaderboard' && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                <Link
                  href="/profile/my-contributions"
                  className={`nav-dropdown-item ${pathname === '/profile/my-contributions' ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><Sparkles size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>My Lyrics &amp; Submissions</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Track submission status &amp; points</span>
                  </div>
                  {pathname === '/profile/my-contributions' && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>
              </div>
            )}
          </div>

          {/* Group 2: 👥 Community & Schedules */}
          <div className="nav-dropdown-wrap">
            <button
              className={`nav-dropdown-trigger ${isCommunityActive ? 'active' : ''} ${dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'community' ? 'open' : ''}`}
              onClick={() => {
                if (dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'community') {
                  setDropdownOpen(false);
                  dropdownRef.current?.removeAttribute('data-active-menu');
                } else {
                  setDropdownOpen(true);
                  dropdownRef.current?.setAttribute('data-active-menu', 'community');
                }
              }}
              aria-haspopup="true"
              title="Community & Schedules"
            >
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <Users size={15} />
                {communityBadgeCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      background: 'var(--error)',
                      color: '#ffffff',
                      fontSize: '0.6rem',
                      fontWeight: 800,
                      borderRadius: '999px',
                      padding: '1px 4px',
                      minWidth: '13px',
                      height: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      border: '1.5px solid #ffffff',
                    }}
                  >
                    {communityBadgeCount > 9 ? '9+' : communityBadgeCount}
                  </span>
                )}
              </div>
              <span className="nav-dropdown-text">Community</span>
              <ChevronDown
                size={12}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'community' ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'community' && (
              <div className="nav-dropdown-panel" role="menu" style={{ minWidth: '260px' }}>
                <div className="nav-dropdown-label">Community &amp; Schedules</div>
                <Link
                  href="/calendar"
                  className={`nav-dropdown-item ${pathname === '/calendar' ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><Calendar size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Calendar &amp; Schedules</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Rehearsals, Mass times &amp; calls</span>
                  </div>
                  {pathname === '/calendar' && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                <Link
                  href="/directory"
                  className={`nav-dropdown-item ${pathname.startsWith('/directory') ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><Users size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Member Directory</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Roster, voice sections &amp; contacts</span>
                  </div>
                  {pathname.startsWith('/directory') && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                <Link
                  href="/messages"
                  className={`nav-dropdown-item ${pathname.startsWith('/messages') ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><MessageSquare size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Direct Messages</span>
                      {unreadCount > 0 && (
                        <span
                          style={{
                            background: 'var(--error)',
                            color: '#ffffff',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            borderRadius: '999px',
                            padding: '1px 6px',
                            height: '15px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Choir group &amp; private chat</span>
                  </div>
                  {pathname.startsWith('/messages') && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                <Link
                  href="/tasks"
                  className={`nav-dropdown-item ${pathname.startsWith('/tasks') ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><ListTodo size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>My Tasks &amp; Duties</span>
                      {activeTaskCount > 0 && (
                        <span
                          style={{
                            background: 'var(--error)',
                            color: '#ffffff',
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            borderRadius: '999px',
                            padding: '1px 6px',
                            height: '15px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {activeTaskCount > 9 ? '9+' : activeTaskCount}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Assigned responsibilities</span>
                  </div>
                  {pathname.startsWith('/tasks') && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>
              </div>
            )}
          </div>

          {/* Group 3: 💳 Personal & Records */}
          <div className="nav-dropdown-wrap">
            <button
              className={`nav-dropdown-trigger ${isRecordsActive ? 'active' : ''} ${dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'records' ? 'open' : ''}`}
              onClick={() => {
                if (dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'records') {
                  setDropdownOpen(false);
                  dropdownRef.current?.removeAttribute('data-active-menu');
                } else {
                  setDropdownOpen(true);
                  dropdownRef.current?.setAttribute('data-active-menu', 'records');
                }
              }}
              aria-haspopup="true"
              title="Personal & Finances"
            >
              <CreditCard size={15} />
              <span className="nav-dropdown-text">Personal &amp; Finances</span>
              <ChevronDown
                size={12}
                style={{
                  transition: 'transform 0.2s ease',
                  transform: dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'records' ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'records' && (
              <div className="nav-dropdown-panel" role="menu" style={{ minWidth: '260px' }}>
                <div className="nav-dropdown-label">Personal &amp; Records</div>
                <Link
                  href="/dues"
                  className={`nav-dropdown-item ${pathname === '/dues' ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><DollarSign size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>My Dues &amp; Sinking Fund</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Monthly ₱40 progress &amp; payment history</span>
                  </div>
                  {pathname === '/dues' && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                <Link
                  href="/solicitations"
                  className={`nav-dropdown-item ${pathname.startsWith('/solicitations') ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><Sparkles size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Choir Fundraising</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Special campaigns &amp; ministry projects</span>
                  </div>
                  {pathname.startsWith('/solicitations') && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>

                {profile.role !== 'super_admin' && (
                  <Link
                    href="/my-documents"
                    className={`nav-dropdown-item ${pathname === '/my-documents' || pathname.startsWith('/sign') ? 'active' : ''}`}
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                    style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                  >
                    <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><FileText size={16} /></span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Documents &amp; Waivers</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Signed waivers &amp; consent forms</span>
                    </div>
                    {(pathname === '/my-documents' || pathname.startsWith('/sign')) && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                  </Link>
                )}

                <Link
                  href="/profile"
                  className={`nav-dropdown-item ${pathname === '/profile' ? 'active' : ''}`}
                  role="menuitem"
                  onClick={() => setDropdownOpen(false)}
                  style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                >
                  <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}><User size={16} /></span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>My Profile &amp; Settings</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>Voice section, avatar &amp; account</span>
                  </div>
                  {pathname === '/profile' && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                </Link>
              </div>
            )}
          </div>

          {/* Group 4: ⚡ Categorized Admin Dropdown */}
          {hasAdminAccess(profile.role) && (
            <div className="nav-dropdown-wrap">
              <button
                className={`nav-dropdown-trigger ${isAdminPage ? 'active' : ''} ${dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'admin' ? 'open' : ''}`}
                onClick={() => {
                  if (dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'admin') {
                    setDropdownOpen(false);
                    dropdownRef.current?.removeAttribute('data-active-menu');
                  } else {
                    setDropdownOpen(true);
                    dropdownRef.current?.setAttribute('data-active-menu', 'admin');
                  }
                }}
                aria-haspopup="true"
                title="Admin Panel"
              >
                <Settings size={15} />
                <span className="nav-dropdown-text">Admin</span>
                {totalAdminPending > 0 && (
                  <span
                    style={{
                      marginLeft: '4px',
                      background: 'var(--error)',
                      color: '#ffffff',
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      borderRadius: '999px',
                      padding: '1px 5px',
                      minWidth: '14px',
                      height: '14px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      border: '1.5px solid #ffffff',
                    }}
                  >
                    {totalAdminPending > 9 ? '9+' : totalAdminPending}
                  </span>
                )}
                <ChevronDown
                  size={12}
                  style={{
                    transition: 'transform 0.2s ease',
                    transform: dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'admin' ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {dropdownOpen && dropdownRef.current?.getAttribute('data-active-menu') === 'admin' && (
                <div
                  className="nav-dropdown-panel"
                  role="menu"
                  style={{
                    minWidth: '260px',
                    padding: '8px',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                  }}
                >
                  {ADMIN_GROUPS.map((group, gIdx) => {
                    const accessibleItems = group.items.filter(item => item.roles.includes(profile.role));
                    if (accessibleItems.length === 0) return null;

                    return (
                      <div key={group.title} style={{ marginBottom: gIdx < ADMIN_GROUPS.length - 1 ? '10px' : '0' }}>
                        <div className="nav-dropdown-label" style={{ fontSize: '0.68rem', opacity: 0.75 }}>
                          {group.title}
                        </div>
                        {accessibleItems.map((item) => {
                          const isUsersPending = item.badgeKey === 'users' && pendingApprovalCount > 0;
                          const isLyricsPending = item.badgeKey === 'lyrics' && pendingLyricsCount > 0;
                          const active = pathname.startsWith(item.href);

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`nav-dropdown-item ${active ? 'active' : ''}`}
                              role="menuitem"
                              onClick={() => setDropdownOpen(false)}
                              style={{ alignItems: 'flex-start', padding: '8px 12px' }}
                            >
                              <span className="nav-dropdown-icon" style={{ marginTop: '2px' }}>{item.icon}</span>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.label}</span>
                                  {isUsersPending && (
                                    <span
                                      style={{
                                        background: 'var(--error)',
                                        color: '#ffffff',
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        borderRadius: '999px',
                                        padding: '1px 6px',
                                        height: '15px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {pendingApprovalCount}
                                    </span>
                                  )}
                                  {isLyricsPending && (
                                    <span
                                      style={{
                                        background: 'var(--accent)',
                                        color: '#ffffff',
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        borderRadius: '999px',
                                        padding: '1px 6px',
                                        height: '15px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                      }}
                                    >
                                      {pendingLyricsCount}
                                    </span>
                                  )}
                                </div>
                                {item.subtitle && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 400 }}>{item.subtitle}</span>
                                )}
                              </div>
                              {active && <span className="nav-dropdown-active-dot" style={{ marginTop: '6px' }} />}
                            </Link>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <form action={logout}>
            <button
              type="submit"
              className="btn btn-secondary nav-logout-btn"
              title="Log Out"
              style={{
                padding: '6px 10px',
                fontSize: '0.8rem',
                minHeight: '34px',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <LogOut size={14} />
              <span className="nav-logout-text">Log Out</span>
            </button>
          </form>
        </div>
      </nav>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="mobile-bottom-bar" aria-label="Main navigation">
        <Link href="/dashboard" className={`mobile-tab ${pathname === '/dashboard' ? 'active' : ''}`}>
          <Home size={20} />
          <span>Home</span>
        </Link>

        <Link href="/messages" className={`mobile-tab ${pathname.startsWith('/messages') ? 'active' : ''}`}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <MessageSquare size={20} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: 'var(--error)',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  borderRadius: '999px',
                  padding: '1px 4px',
                  minWidth: '13px',
                  height: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  border: '1.5px solid #ffffff',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span>Messages</span>
        </Link>

        <Link href="/live" className={`mobile-tab ${pathname === '/live' ? 'active' : ''}`}>
          <Radio size={20} />
          <span>Live Sync</span>
        </Link>

        <Link href="/tasks" className={`mobile-tab ${pathname.startsWith('/tasks') || pathname.startsWith('/admin/tasks') ? 'active' : ''}`}>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <ListTodo size={20} />
            {activeTaskCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: 'var(--error)',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  borderRadius: '999px',
                  padding: '1px 4px',
                  minWidth: '13px',
                  height: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  border: '1.5px solid #ffffff',
                }}
              >
                {activeTaskCount > 9 ? '9+' : activeTaskCount}
              </span>
            )}
          </div>
          <span>Tasks</span>
        </Link>

        {/* 5th Tab: Facebook-style Menu Trigger */}
        <button
          className={`mobile-tab ${adminSheetOpen ? 'active' : ''}`}
          onClick={() => setAdminSheetOpen(true)}
          aria-label="Open navigation menu"
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <Menu size={20} />
            {totalAdminPending > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-6px',
                  background: 'var(--error)',
                  color: '#ffffff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  borderRadius: '999px',
                  padding: '1px 4px',
                  minWidth: '13px',
                  height: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  border: '1.5px solid #ffffff',
                }}
              >
                {totalAdminPending > 9 ? '9+' : totalAdminPending}
              </span>
            )}
          </div>
          <span>Menu</span>
        </button>
      </nav>

      {/* ── Facebook-Style Categorized Mobile Menu Drawer ── */}
      {adminSheetOpen && (
        <div className="mobile-sheet-overlay" onClick={() => setAdminSheetOpen(false)}>
          <div className="mobile-sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />

            {/* Top Facebook-Style Profile Card */}
            <Link
              href="/profile"
              className="fb-profile-card"
              onClick={() => setAdminSheetOpen(false)}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  boxShadow: '0 2px 8px rgba(11, 77, 36, 0.2)',
                  flexShrink: 0,
                }}
              >
                {profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'C'}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    {profile.full_name || 'Choir Member'}
                  </span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      background: 'rgba(11, 77, 36, 0.08)',
                      color: 'var(--primary)',
                      padding: '2px 7px',
                      borderRadius: '999px',
                      border: '1px solid rgba(11, 77, 36, 0.15)',
                    }}
                  >
                    {profile.role.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '2px' }}>
                  View Profile, Voice Part &amp; Settings
                </div>
              </div>

              <ChevronRight size={18} style={{ color: 'var(--muted)', opacity: 0.6 }} />
            </Link>

            {/* ── Group 1: 🎵 Liturgy & Music ── */}
            <div className="fb-menu-section">
              <div className="fb-menu-section-title">
                <Music size={13} style={{ color: 'var(--primary)' }} />
                <span>Music &amp; Liturgy</span>
              </div>
              <div className="fb-menu-group">
                <Link
                  href="/repertoire"
                  className={`fb-menu-item ${pathname.startsWith('/repertoire') ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#ecfdf5', color: '#047857' }}>
                    <Music size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">Repertoire &amp; Songbook</span>
                    </div>
                    <span className="fb-menu-subtitle">Mass parts, hymn catalog &amp; chords</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                <Link
                  href="/live"
                  className={`fb-menu-item ${pathname === '/live' ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#fffbeb', color: '#b45309' }}>
                    <Radio size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">Live Sync Session</span>
                    </div>
                    <span className="fb-menu-subtitle">Real-time synchronized Mass flow</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                <Link
                  href="/leaderboard"
                  className={`fb-menu-item ${pathname === '/leaderboard' ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <Trophy size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">Contributor Leaderboard</span>
                    </div>
                    <span className="fb-menu-subtitle">Points &amp; contributor rankings</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                <Link
                  href="/profile/my-contributions"
                  className={`fb-menu-item ${pathname === '/profile/my-contributions' ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#faf5ff', color: '#7e22ce' }}>
                    <Sparkles size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">My Lyrics &amp; Recordings</span>
                    </div>
                    <span className="fb-menu-subtitle">Track submission status &amp; points</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>
              </div>
            </div>

            {/* ── Group 2: 👥 Choir Community & Activities ── */}
            <div className="fb-menu-section">
              <div className="fb-menu-section-title">
                <Users size={13} style={{ color: 'var(--primary)' }} />
                <span>Community &amp; Schedules</span>
              </div>
              <div className="fb-menu-group">
                <Link
                  href="/calendar"
                  className={`fb-menu-item ${pathname === '/calendar' ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                    <Calendar size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">Calendar &amp; Events</span>
                    </div>
                    <span className="fb-menu-subtitle">Rehearsals, Mass times &amp; calls</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                <Link
                  href="/directory"
                  className={`fb-menu-item ${pathname.startsWith('/directory') ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#f0fdfa', color: '#0f766e' }}>
                    <Users size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">Member Directory</span>
                    </div>
                    <span className="fb-menu-subtitle">Roster, voice sections &amp; contacts</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                <Link
                  href="/messages"
                  className={`fb-menu-item ${pathname.startsWith('/messages') ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#eef2ff', color: '#4338ca' }}>
                    <MessageSquare size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">Direct Messages</span>
                      {unreadCount > 0 && (
                        <span className="fb-menu-badge error">{unreadCount} new</span>
                      )}
                    </div>
                    <span className="fb-menu-subtitle">Choir group &amp; private chat</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                <Link
                  href="/tasks"
                  className={`fb-menu-item ${pathname.startsWith('/tasks') ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#ecfdf5', color: '#065f46' }}>
                    <ListTodo size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">My Tasks &amp; Duties</span>
                      {activeTaskCount > 0 && (
                        <span className="fb-menu-badge error">{activeTaskCount} active</span>
                      )}
                    </div>
                    <span className="fb-menu-subtitle">Assigned responsibilities</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>
              </div>
            </div>

            {/* ── Group 3: 💳 Personal & Records ── */}
            <div className="fb-menu-section">
              <div className="fb-menu-section-title">
                <CreditCard size={13} style={{ color: 'var(--primary)' }} />
                <span>Personal &amp; Records</span>
              </div>
              <div className="fb-menu-group">
                <Link
                  href={isFinanceAdmin ? '/admin/finances' : '/dues'}
                  className={`fb-menu-item ${pathname === '/dues' || pathname.startsWith('/admin/finances') ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#f0fdf4', color: '#15803d' }}>
                    <CreditCard size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">{isFinanceAdmin ? 'Finances Management' : 'My Dues & Sinking Fund'}</span>
                    </div>
                    <span className="fb-menu-subtitle">{isFinanceAdmin ? 'Treasurer ledger, tallies & reports' : 'View personal monthly dues & payments'}</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                <Link
                  href="/solicitations"
                  className={`fb-menu-item ${pathname.startsWith('/solicitations') ? 'active' : ''}`}
                  onClick={() => setAdminSheetOpen(false)}
                >
                  <div className="fb-menu-icon-wrap" style={{ background: '#faf5ff', color: '#9333ea' }}>
                    <Sparkles size={18} />
                  </div>
                  <div className="fb-menu-content">
                    <div className="fb-menu-title-row">
                      <span className="fb-menu-title">Choir Fundraising</span>
                    </div>
                    <span className="fb-menu-subtitle">Special campaigns &amp; ministry projects</span>
                  </div>
                  <ChevronRight size={16} className="fb-menu-chevron" />
                </Link>

                {profile.role !== 'super_admin' && (
                  <Link
                    href="/my-documents"
                    className={`fb-menu-item ${pathname === '/my-documents' || pathname.startsWith('/sign') ? 'active' : ''}`}
                    onClick={() => setAdminSheetOpen(false)}
                  >
                    <div className="fb-menu-icon-wrap" style={{ background: '#f1f5f9', color: '#334155' }}>
                      <FileText size={18} />
                    </div>
                    <div className="fb-menu-content">
                      <div className="fb-menu-title-row">
                        <span className="fb-menu-title">Documents &amp; Waivers</span>
                      </div>
                      <span className="fb-menu-subtitle">Signed waivers &amp; consent forms</span>
                    </div>
                    <ChevronRight size={16} className="fb-menu-chevron" />
                  </Link>
                )}
              </div>
            </div>

            {/* ── Group 4: ⚡ Categorized Director & Admin Controls ── */}
            {hasAdminAccess(profile.role) && (
              <div className="fb-menu-section">
                <div className="fb-menu-section-title" style={{ color: 'var(--primary)' }}>
                  <Settings size={13} style={{ color: 'var(--primary)' }} />
                  <span>Director &amp; Admin Controls</span>
                </div>

                {ADMIN_GROUPS.map((group) => {
                  const accessibleItems = group.items.filter(item => item.roles.includes(profile.role));
                  if (accessibleItems.length === 0) return null;

                  return (
                    <div key={group.title} style={{ marginBottom: '10px' }}>
                      <div
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--muted)',
                          paddingLeft: '6px',
                          marginBottom: '4px',
                        }}
                      >
                        {group.title}
                      </div>

                      <div className="fb-menu-group">
                        {accessibleItems.map((item) => {
                          const isUsersPending = item.badgeKey === 'users' && pendingApprovalCount > 0;
                          const isLyricsPending = item.badgeKey === 'lyrics' && pendingLyricsCount > 0;

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`fb-menu-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                              onClick={() => setAdminSheetOpen(false)}
                            >
                              <div
                                className="fb-menu-icon-wrap"
                                style={{
                                  background: pathname.startsWith(item.href) ? 'rgba(11, 77, 36, 0.12)' : '#f4f4f5',
                                  color: pathname.startsWith(item.href) ? 'var(--primary)' : 'var(--foreground)',
                                }}
                              >
                                {item.icon}
                              </div>

                              <div className="fb-menu-content">
                                <div className="fb-menu-title-row">
                                  <span className="fb-menu-title">{item.label}</span>
                                  {isUsersPending && (
                                    <span className="fb-menu-badge error">
                                      {pendingApprovalCount} pending
                                    </span>
                                  )}
                                  {isLyricsPending && (
                                    <span className="fb-menu-badge accent">
                                      {pendingLyricsCount} pending
                                    </span>
                                  )}
                                </div>
                                {item.subtitle && (
                                  <span className="fb-menu-subtitle">{item.subtitle}</span>
                                )}
                              </div>

                              <ChevronRight size={16} className="fb-menu-chevron" />
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Log Out Button ── */}
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <form action={logout} style={{ width: '100%' }}>
                <button
                  type="submit"
                  className="fb-menu-item"
                  style={{
                    width: '100%',
                    background: '#fff',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    color: 'var(--error)',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 16px',
                    fontWeight: 700,
                    gap: '8px',
                  }}
                >
                  <LogOut size={16} />
                  <span>Log Out of Choir Collective</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
