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
      { href: '/admin/finances', label: 'Finances & Sinking Fund', subtitle: 'Ledger, dues & receipts', icon: <DollarSign size={16} />, roles: ['super_admin', 'director', 'treasurer'] },
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

        {/* Desktop Links */}
        <div className="nav-links">
          <NavLink href="/dashboard" label="Dashboard" pathname={pathname} icon={<Home size={15} />} />
          <NavLink href="/repertoire" label="Repertoire" pathname={pathname} matchFn={p => p.startsWith('/repertoire')} icon={<Music size={15} />} />
          <NavLink href="/live" label="Live Sync" pathname={pathname} icon={<Radio size={15} />} />
          <NavLink href="/calendar" label="Calendar" pathname={pathname} icon={<Calendar size={15} />} />
          <NavLink href="/directory" label="Directory" pathname={pathname} matchFn={p => p.startsWith('/directory')} icon={<Users size={15} />} />
          <NavLink href="/messages" label="Messages" pathname={pathname} matchFn={p => p.startsWith('/messages')} badge={unreadCount} icon={<MessageSquare size={15} />} />
          <NavLink href="/tasks" label="Tasks" pathname={pathname} matchFn={p => p.startsWith('/tasks')} badge={activeTaskCount} icon={<ListTodo size={15} />} />
          <NavLink
            href={isFinanceAdmin ? '/admin/finances' : '/dues'}
            label="Dues"
            pathname={pathname}
            matchFn={p => p === '/dues' || p.startsWith('/admin/finances')}
            icon={<CreditCard size={15} />}
          />
          {profile.role !== 'super_admin' && (
            <NavLink href="/my-documents" label="Waivers" pathname={pathname} matchFn={p => p === '/my-documents' || p.startsWith('/sign')} icon={<FileText size={15} />} />
          )}
          <NavLink href="/leaderboard" label="Leaderboard" pathname={pathname} icon={<Trophy size={15} />} />
          <NavLink href="/profile" label="Profile" pathname={pathname} icon={<User size={15} />} />

          {/* Categorized Admin Dropdown */}
          {hasAdminAccess(profile.role) && (
            <div className="nav-dropdown-wrap" ref={dropdownRef}>
              <button
                className={`nav-dropdown-trigger ${isAdminPage ? 'active' : ''} ${dropdownOpen ? 'open' : ''}`}
                onClick={() => setDropdownOpen(p => !p)}
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
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
                  style={{ transition: 'transform 0.2s ease', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {dropdownOpen && (
                <div
                  className="nav-dropdown-panel"
                  role="menu"
                  style={{
                    minWidth: '240px',
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

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`nav-dropdown-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                              role="menuitem"
                              onClick={() => setDropdownOpen(false)}
                            >
                              <span className="nav-dropdown-icon">{item.icon}</span>
                              <span>{item.label}</span>
                              {isUsersPending && (
                                <span
                                  style={{
                                    marginLeft: 'auto',
                                    marginRight: pathname.startsWith(item.href) ? '6px' : '0',
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
                                    lineHeight: 1,
                                  }}
                                >
                                  {pendingApprovalCount}
                                </span>
                              )}
                              {isLyricsPending && (
                                <span
                                  style={{
                                    marginLeft: 'auto',
                                    marginRight: pathname.startsWith(item.href) ? '6px' : '0',
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
                                    lineHeight: 1,
                                  }}
                                >
                                  {pendingLyricsCount}
                                </span>
                              )}
                              {pathname.startsWith(item.href) && (
                                <span className="nav-dropdown-active-dot" />
                              )}
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
                      <span className="fb-menu-title">Dues &amp; Finances</span>
                    </div>
                    <span className="fb-menu-subtitle">Sinking fund, dues &amp; statements</span>
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
