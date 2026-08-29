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

      tl.from('.content-anim-item',
        { opacity: 0, y: 14, duration: 0.35, stagger: 0.035 }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
        <div className="flex flex-col gap-7.5">
          <div className="content-anim-item">
            <h2 className="text-2xl sm:text-[1.75rem] font-bold mb-2 text-primary">Choir Roster</h2>
            <p className="text-muted text-sm sm:text-base">List of active choir members and their administration roles</p>
          </div>

          <div className="glass-container content-anim-item p-7.5">
            <h3 className="text-xl sm:text-[1.25rem] font-semibold mb-4 text-primary">Active Roster ({roster.length})</h3>
            
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
                          className={`badge ${
                            member.role === 'super_admin' || member.role === 'director'
                              ? 'bg-primary/6 text-primary'
                              : 'bg-black/2 text-foreground'
                          }`}
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
