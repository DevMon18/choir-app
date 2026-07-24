'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
}

interface AnalyticsMetrics {
  totalMembers: number;
  roleBreakdown: Record<string, number>;
  dues: {
    paidSum: number;
    unpaidSum: number;
    overdueSum: number;
    totalDues: number;
    completionRate: number;
  };
  attendance: {
    overallRate: number;
    rateByType: Record<string, number>;
  };
  popularSongs: Array<{
    title: string;
    category: string;
    count: number;
  }>;
  growth: Array<{
    month: string;
    count: number;
  }>;
}

interface AnalyticsClientProps {
  currentUserProfile: Profile;
  metrics: AnalyticsMetrics;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  director: 'Music Director',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  member: 'Choir Member',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Rehearsals',
  performance: 'Performances',
  mass: 'Mass Services',
  special_event: 'Special Events',
};

export const AnalyticsClient = ({ currentUserProfile, metrics }: AnalyticsClientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo('.content-anim-item',
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }
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
            
            {/* Header Title */}
            <div className="content-anim-item" style={{ opacity: 0 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>Organizational Analytics</h2>
              <p style={{ color: 'var(--muted)' }}>High-level insights into choir attendance, rosters, repertoire, and finances</p>
            </div>

            {/* Core KPIs Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              
              <div className="glass-container content-anim-item" style={{ padding: '24px', opacity: 0 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Roster Size</p>
                <h4 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>{metrics.totalMembers}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>Active profiles in choir</p>
              </div>

              <div className="glass-container content-anim-item" style={{ padding: '24px', opacity: 0 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Avg Attendance</p>
                <h4 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{metrics.attendance.overallRate}%</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>Presence/Late rate overall</p>
              </div>

              <div className="glass-container content-anim-item" style={{ padding: '24px', opacity: 0 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Dues Completed</p>
                <h4 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{metrics.dues.completionRate}%</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>Payment completion percentage</p>
              </div>

              <div className="glass-container content-anim-item" style={{ padding: '24px', opacity: 0 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Paid Funds</p>
                <h4 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  ₱{metrics.dues.paidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '4px' }}>Dues collection pool</p>
              </div>

            </div>

            {/* Split layout for charts and metrics lists */}
            <div className="responsive-grid-360" style={{ display: 'grid', gap: '30px' }}>
              
              {/* Financial Status Card */}
              <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>Financial Collection Rate</h3>
                
                {/* Progress bar */}
                <div style={{ width: '100%', height: '14px', background: 'rgba(30,58,138,0.06)', borderRadius: '99px', overflow: 'hidden', marginBottom: '20px' }}>
                  <div style={{
                    width: `${metrics.dues.completionRate}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: '99px',
                    transition: 'width 0.8s ease-out',
                  }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Collected Paid Dues:</span>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                      ₱{metrics.dues.paidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Pending Unpaid Dues:</span>
                    <span style={{ fontWeight: 600, color: 'var(--warning)' }}>
                      ₱{metrics.dues.unpaidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                    <span style={{ color: 'var(--muted)' }}>Overdue Dues:</span>
                    <span style={{ fontWeight: 600, color: 'var(--error)' }}>
                      ₱{metrics.dues.overdueSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700 }}>
                    <span>Total Invoiced:</span>
                    <span>₱{metrics.dues.totalDues.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Attendance Trends by Session Type */}
              <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>Attendance Averages</h3>
                
                {Object.keys(metrics.attendance.rateByType).length === 0 ? (
                  <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '24px 0' }}>No attendance sessions logged yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {Object.entries(metrics.attendance.rateByType).map(([type, rate]) => (
                      <div key={type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600 }}>{SESSION_TYPE_LABELS[type] || type}</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{rate}%</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(30,58,138,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${rate}%`,
                            height: '100%',
                            background: 'var(--primary)',
                            borderRadius: '99px',
                            transition: 'width 0.8s ease-out',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Third row: Roles and Repertoire Popularity */}
            <div className="responsive-grid-360" style={{ display: 'grid', gap: '30px' }}>
              
              {/* Roster Role Distribution */}
              <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}> Roster Role Breakdown</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(metrics.roleBreakdown).map(([role, count]) => (
                    <div key={role} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.4)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      <span style={{ fontWeight: 500 }}>{ROLE_DISPLAY_NAMES[role] || role}</span>
                      <span className="badge badge-pending" style={{ background: 'rgba(30,58,138,0.06)', color: 'var(--primary)', fontWeight: 700 }}>
                        {count} {count === 1 ? 'user' : 'users'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Popular Song repertoire */}
              <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px', color: 'var(--primary)' }}>Popular Repertoire Songs</h3>
                
                {metrics.popularSongs.length === 0 ? (
                  <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No songs assigned to Mass sequences yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {metrics.popularSongs.map((song, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.4)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <div>
                          <strong style={{ color: 'var(--primary)' }}>{song.title}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>Category: {song.category}</span>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>
                          Used <strong style={{ color: 'var(--accent)' }}>{song.count}</strong> {song.count === 1 ? 'time' : 'times'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
      </main>
    </div>
  );
};

export default AnalyticsClient;
