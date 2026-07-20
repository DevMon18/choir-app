'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { logout } from '../actions';
import { Navbar } from '@/components/Navbar';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  created_at: string;
}

interface DashboardClientProps {
  profile: Profile;
  isAdmin: boolean;
}

interface CardItem {
  id: string;
  title: string;
  description: string;
  link: string;
  buttonText: string;
  icon: React.ReactNode;
  roles: string[];
}

const DashboardClient = ({ profile, isAdmin }: DashboardClientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo('.anim-header', 
        { opacity: 0, y: -20 }, 
        { opacity: 1, y: 0, duration: 0.7 }
      );

      tl.fromTo('.anim-card', 
        { opacity: 0, y: 30, scale: 0.97 }, 
        { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.08 },
        '-=0.3'
      );
    });

    return () => ctx.revert();
  }, []);

  // Defined cards for each role to prevent viewing work of other roles
  const allCards: CardItem[] = useMemo(() => [
    // 1. User Manager (Super Admin, Director, Secretary)
    {
      id: 'admin_users',
      title: 'User Manager',
      description: 'Approve join requests, provision user accounts, and update profiles or system roles.',
      link: '/admin/users',
      buttonText: 'Open User Manager',
      roles: ['super_admin', 'director', 'secretary'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    // 2. Choir Roster (Super Admin, Director, Secretary)
    {
      id: 'admin_roster',
      title: 'Choir Roster',
      description: 'Audit the master register of all choir members, sorted and filtered by voice parts.',
      link: '/admin/roster',
      buttonText: 'Open Roster',
      roles: ['super_admin', 'director', 'secretary'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    // 3. Attendance Sessions (Super Admin, Director, Secretary)
    {
      id: 'admin_attendance',
      title: 'Track Attendance',
      description: 'Create weekly Mass rehearsals or performance sessions, and record member attendance.',
      link: '/admin/attendance',
      buttonText: 'Record Attendance',
      roles: ['super_admin', 'director', 'secretary'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    // 4. Financial Records (Super Admin, Director, Treasurer)
    {
      id: 'admin_finances',
      title: 'Finances & Collection',
      description: 'Record annual dues invoices and manage weekly Sunday Sinking Fund tally sheets.',
      link: '/admin/finances',
      buttonText: 'Manage Finances',
      roles: ['super_admin', 'director', 'treasurer'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    // 5. System Analytics (Super Admin, Director)
    {
      id: 'admin_analytics',
      title: 'Analytics & Trends',
      description: 'Monitor member registration stats, attendance rates, and weekly collection trends.',
      link: '/admin/analytics',
      buttonText: 'View Analytics',
      roles: ['super_admin', 'director'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    // 6. Repertoire & Songbook (All approved roles)
    {
      id: 'repertoire',
      title: 'Repertoire',
      description: 'Access practice tracks, sheet music, and Chords/Lyrics for current choir performance pieces.',
      link: '/repertoire',
      buttonText: 'Browse Songs',
      roles: ['super_admin', 'director', 'secretary', 'treasurer', 'member'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )
    },
    // 7. Mass Liturgy Sequences (All approved roles)
    {
      id: 'live_sessions',
      title: 'Mass Sequences',
      description: 'View planned musical programs, order of songs, and join live director-synchronized lyrics.',
      link: '/live',
      buttonText: 'Join Live Session',
      roles: ['super_admin', 'director', 'secretary', 'treasurer', 'member'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
      )
    },
    // 8. Personal Dues (Member, Treasurer)
    {
      id: 'member_dues',
      title: 'My Dues',
      description: 'Track your annual membership dues payments, sinking funds history, and remaining balance.',
      link: '/dues',
      buttonText: 'View My Dues',
      roles: ['member', 'treasurer'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    // 9. Community Directory (All approved roles)
    {
      id: 'directory',
      title: 'Member Directory',
      description: 'Access contact listings, phone numbers, emergency details, and rosters of the choir.',
      link: '/directory',
      buttonText: 'Open Directory',
      roles: ['super_admin', 'director', 'secretary', 'treasurer', 'member'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    // 10. My Profile settings (All approved roles)
    {
      id: 'profile',
      title: 'My Profile',
      description: 'Modify directory privacy settings, adjust phone/address details, and upload your profile picture.',
      link: '/profile',
      buttonText: 'Manage Profile',
      roles: ['super_admin', 'director', 'secretary', 'treasurer', 'member'],
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ], [profile.role]);

  const visibleCards = useMemo(() => {
    return allCards.filter(card => card.roles.includes(profile.role));
  }, [allCards, profile.role]);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '600px', height: '600px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '500px', height: '500px' }}></div>

      <Navbar profile={profile} />

      <main style={{ flex: 1, padding: '60px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          
          <div className="glass-container anim-header" style={{ position: 'relative', overflow: 'hidden' }}>
            <h1 style={{ fontSize: '2.25rem', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>
              Welcome back, {profile.full_name}!
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '1.05rem' }}>
              You are signed in as a <strong style={{ color: 'var(--accent)', textTransform: 'uppercase' }}>{profile.role}</strong>.
            </p>
          </div>

          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {visibleCards.map((card) => (
              <div 
                key={card.id}
                className="glass-container anim-card dashboard-card" 
                style={{ 
                  padding: '30px', 
                  opacity: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', color: 'var(--primary)' }}>
                    <div style={{ color: 'var(--primary)' }}>
                      {card.icon}
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{card.title}</h3>
                  </div>
                  <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                    {card.description}
                  </p>
                </div>
                <Link href={card.link} className="btn btn-secondary" style={{ width: '100%', textAlign: 'center', display: 'block', marginTop: 'auto' }}>
                  {card.buttonText}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardClient;
