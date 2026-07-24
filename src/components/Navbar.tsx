'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/app/actions';

interface NavbarProps {
  profile: {
    role: string;
    full_name: string;
  };
  children?: React.ReactNode;
}

type Role = string;

// Role-based admin menu items
const getAdminItems = (role: Role) => {
  const all = [
    { href: '/admin/users',     label: 'Manage Users',  icon: '👥', roles: ['super_admin', 'director', 'secretary'] },
    { href: '/admin/roster',    label: 'Choir Roster',  icon: '🎼', roles: ['super_admin', 'director', 'secretary'] },
    { href: '/admin/attendance',label: 'Attendance',    icon: '📋', roles: ['super_admin', 'director', 'secretary'] },
    { href: '/admin/songs',     label: 'Songs',         icon: '🎵', roles: ['super_admin', 'director', 'secretary'] },
    { href: '/admin/sequences', label: 'Sequences',     icon: '🎤', roles: ['super_admin', 'director', 'secretary'] },
    { href: '/admin/announcements', label: 'Announcements', icon: '📢', roles: ['super_admin', 'director', 'secretary'] },
    { href: '/admin/finances',  label: 'Finances',      icon: '💰', roles: ['super_admin', 'director', 'treasurer'] },
    { href: '/admin/analytics', label: 'Analytics',     icon: '📊', roles: ['super_admin', 'director', 'secretary', 'treasurer'] },
  ];
  return all.filter(item => item.roles.includes(role));
};

const hasAdminAccess = (role: Role) =>
  ['super_admin', 'director', 'secretary', 'treasurer'].includes(role);

export const Navbar = ({ profile, children }: NavbarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [adminSheetOpen, setAdminSheetOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const adminItems = getAdminItems(profile.role);
  const isAdminPage = pathname.startsWith('/admin');
  const isFinanceAdmin = ['super_admin', 'director', 'treasurer'].includes(profile.role);

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

  const NavLink = ({ href, icon, label, matchFn }: {
    href: string; icon: React.ReactNode; label: string;
    matchFn?: (p: string) => boolean;
  }) => {
    const active = matchFn ? matchFn(pathname) : pathname === href;
    return (
      <Link href={href} className={`nav-link ${active ? 'active' : ''}`}>
        {icon}{label}
      </Link>
    );
  };

  return (
    <>
      {/* ── Desktop / top navbar ── */}
      <nav className="nav-bar">
        {/* Brand and Children */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            className="nav-brand"
            onClick={() => router.push('/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <img
              src="/logo.png"
              alt="Choir Collective"
              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
            />
            <span>Choir Collective</span>
          </div>
          {children}
        </div>

        {/* Desktop links */}
        <div className="nav-links">
          <NavLink href="/dashboard" label="Dashboard" icon={
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          } />
          <NavLink href="/repertoire" label="Repertoire" matchFn={p => p.startsWith('/repertoire')} icon={
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          } />
          <NavLink href="/live" label="Live Sync" icon={
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          } />
          <NavLink href="/calendar" label="Calendar" icon={
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          } />
          <NavLink href="/directory" label="Directory" matchFn={p => p.startsWith('/directory')} icon={
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          } />
          <NavLink href="/messages" label="Messages" matchFn={p => p.startsWith('/messages')} icon={
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          } />
          <NavLink
            href={isFinanceAdmin ? '/admin/finances' : '/dues'}
            label="Dues"
            matchFn={p => p === '/dues' || p.startsWith('/admin/finances')}
            icon={
              <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <NavLink href="/profile" label="Profile" icon={
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          } />

          {/* Admin dropdown — only for users with admin access */}
          {hasAdminAccess(profile.role) && (
            <div className="nav-dropdown-wrap" ref={dropdownRef}>
              <button
                className={`nav-dropdown-trigger ${isAdminPage ? 'active' : ''} ${dropdownOpen ? 'open' : ''}`}
                onClick={() => setDropdownOpen(p => !p)}
                aria-haspopup="true"
                aria-expanded={dropdownOpen}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Admin
                <svg
                  width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"
                  style={{ transition: 'transform 0.2s ease', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="nav-dropdown-panel" role="menu">
                  <div className="nav-dropdown-label">Admin Panel</div>
                  {adminItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-dropdown-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                      role="menuitem"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="nav-dropdown-icon">{item.icon}</span>
                      {item.label}
                      {pathname.startsWith(item.href) && (
                        <span className="nav-dropdown-active-dot" />
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <form action={logout}>
            <button type="submit" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', minHeight: '38px', borderRadius: '8px' }}>
              Log Out
            </button>
          </form>
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="mobile-bottom-bar" aria-label="Main navigation">
        <Link href="/dashboard" className={`mobile-tab ${pathname === '/dashboard' ? 'active' : ''}`}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span>Home</span>
        </Link>

        <Link href="/messages" className={`mobile-tab ${pathname.startsWith('/messages') ? 'active' : ''}`}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Messages</span>
        </Link>

        <Link href="/calendar" className={`mobile-tab ${pathname === '/calendar' ? 'active' : ''}`}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Calendar</span>
        </Link>

        <Link href="/directory" className={`mobile-tab ${pathname.startsWith('/directory') ? 'active' : ''}`}>
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Directory</span>
        </Link>

        {/* 5th tab: Menu for all users */}
        <button
          className={`mobile-tab ${adminSheetOpen ? 'active' : ''}`}
          onClick={() => setAdminSheetOpen(true)}
          aria-label="Open navigation menu"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span>Menu</span>
        </button>
      </nav>

      {/* ── Mobile Navigation Menu Drawer ── */}
      {adminSheetOpen && (
        <div className="mobile-sheet-overlay" onClick={() => setAdminSheetOpen(false)}>
          <div className="mobile-sheet-panel" onClick={e => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <span>☰ Menu & Settings</span>
              <span className="mobile-sheet-role">{profile.role.replace('_', ' ')}</span>
            </div>
            <div className="mobile-sheet-links">
              <Link href="/profile" className={`mobile-sheet-link ${pathname === '/profile' ? 'active' : ''}`} onClick={() => setAdminSheetOpen(false)}>
                <span className="mobile-sheet-link-icon">👤</span>
                <span>My Profile & Settings</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" style={{ marginLeft: 'auto', opacity: 0.4 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>

              <Link href="/repertoire" className={`mobile-sheet-link ${pathname.startsWith('/repertoire') ? 'active' : ''}`} onClick={() => setAdminSheetOpen(false)}>
                <span className="mobile-sheet-link-icon">🎶</span>
                <span>Repertoire & Songbook</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" style={{ marginLeft: 'auto', opacity: 0.4 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>

              <Link href="/live" className={`mobile-sheet-link ${pathname === '/live' ? 'active' : ''}`} onClick={() => setAdminSheetOpen(false)}>
                <span className="mobile-sheet-link-icon">🎙</span>
                <span>Live Session Sync</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" style={{ marginLeft: 'auto', opacity: 0.4 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>

              <Link href={hasAdminAccess(profile.role) ? '/admin/finances' : '/dues'} className={`mobile-sheet-link ${pathname === '/dues' || pathname.startsWith('/admin/finances') ? 'active' : ''}`} onClick={() => setAdminSheetOpen(false)}>
                <span className="mobile-sheet-link-icon">💳</span>
                <span>My Dues & Finances</span>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" style={{ marginLeft: 'auto', opacity: 0.4 }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>

              {hasAdminAccess(profile.role) && (
                <>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginTop: '12px', marginBottom: '4px' }}>
                    Admin Controls
                  </div>
                  {adminItems.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`mobile-sheet-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
                      onClick={() => setAdminSheetOpen(false)}
                    >
                      <span className="mobile-sheet-link-icon">{item.icon}</span>
                      <span>{item.label}</span>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" style={{ marginLeft: 'auto', opacity: 0.4 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </>
              )}

              <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '8px', paddingTop: '8px' }}>
                <form action={logout} style={{ width: '100%' }}>
                  <button type="submit" className="mobile-sheet-link" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontFamily: 'inherit' }}>
                    <span className="mobile-sheet-link-icon" style={{ background: '#fee2e2' }}>🚪</span>
                    <span>Log Out</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
