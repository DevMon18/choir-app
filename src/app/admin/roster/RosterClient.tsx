'use client';

import React, { useEffect, useRef } from 'react';
import { Navbar } from '@/components/Navbar';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  created_at: string;
}

interface RosterClientProps {
  currentUserProfile: Profile;
  roster: Profile[];
}

export const RosterClient = ({ currentUserProfile, roster }: RosterClientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo('.content-anim-item',
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '500px', height: '500px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }}></div>

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="content-anim-item" style={{ opacity: 0 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>Choir Roster</h2>
              <p style={{ color: 'var(--muted)' }}>List of active choir members and their administration roles</p>
            </div>

            <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', color: 'var(--primary)' }}>Active Roster ({roster.length})</h3>
              
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>System Role</th>
                      <th>Member Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((member) => (
                      <tr key={member.id}>
                        <td data-label="Full Name"><strong>{member.full_name}</strong></td>
                        <td data-label="Email">{member.email}</td>
                        <td data-label="System Role">
                          <span 
                            className="badge" 
                            style={{ 
                              background: member.role === 'super_admin' || member.role === 'director' ? 'rgba(30,58,138,0.06)' : 'rgba(0,0,0,0.02)',
                              color: member.role === 'super_admin' || member.role === 'director' ? 'var(--primary)' : 'var(--foreground)'
                            }}
                          >
                            {member.role}
                          </span>
                        </td>
                        <td data-label="Member Since">{new Date(member.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
};

export default RosterClient;
