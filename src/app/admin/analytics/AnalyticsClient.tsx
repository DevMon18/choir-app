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
          {/* Header Title */}
          <div className="content-anim-item">
            <h2 className="text-2xl sm:text-[1.75rem] font-bold mb-2 text-primary">Organizational Analytics</h2>
            <p className="text-muted text-sm sm:text-base">High-level insights into choir attendance, rosters, repertoire, and finances</p>
          </div>

          {/* Core KPIs Row */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
            <div className="glass-container content-anim-item p-6">
              <p className="text-xs font-bold text-muted uppercase mb-2">Roster Size</p>
              <h4 className="text-3xl sm:text-[2rem] font-bold text-primary">{metrics.totalMembers}</h4>
              <p className="text-xs text-muted mt-1">Active profiles in choir</p>
            </div>

            <div className="glass-container content-anim-item p-6">
              <p className="text-xs font-bold text-muted uppercase mb-2">Avg Attendance</p>
              <h4 className="text-3xl sm:text-[2rem] font-bold text-success">{metrics.attendance.overallRate}%</h4>
              <p className="text-xs text-muted mt-1">Presence/Late rate overall</p>
            </div>

            <div className="glass-container content-anim-item p-6">
              <p className="text-xs font-bold text-muted uppercase mb-2">Dues Completed</p>
              <h4 className="text-3xl sm:text-[2rem] font-bold text-accent">{metrics.dues.completionRate}%</h4>
              <p className="text-xs text-muted mt-1">Payment completion percentage</p>
            </div>

            <div className="glass-container content-anim-item p-6">
              <p className="text-xs font-bold text-muted uppercase mb-2">Total Paid Funds</p>
              <h4 className="text-3xl sm:text-[2rem] font-bold text-foreground">
                ₱{metrics.dues.paidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h4>
              <p className="text-xs text-muted mt-1">Dues collection pool</p>
            </div>
          </div>

          {/* Split layout for charts and metrics lists */}
          <div className="responsive-grid-360 grid gap-7.5">
            {/* Financial Status Card */}
            <div className="glass-container content-anim-item p-7.5">
              <h3 className="text-lg font-bold mb-5 text-primary">Financial Collection Rate</h3>
              
              {/* Progress bar */}
              <div className="w-full h-3.5 bg-blue-900/6 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-accent rounded-full transition-[width] duration-800 ease-out"
                  style={{ width: `${metrics.dues.completionRate}%` }}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between text-sm sm:text-[0.95rem]">
                  <span className="text-muted">Collected Paid Dues:</span>
                  <span className="font-semibold text-success">
                    ₱{metrics.dues.paidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm sm:text-[0.95rem]">
                  <span className="text-muted">Pending Unpaid Dues:</span>
                  <span className="font-semibold text-warning">
                    ₱{metrics.dues.unpaidSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm sm:text-[0.95rem]">
                  <span className="text-muted">Overdue Dues:</span>
                  <span className="font-semibold text-error">
                    ₱{metrics.dues.overdueSum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-px bg-glass-border my-1" />
                <div className="flex justify-between text-base font-bold">
                  <span>Total Invoiced:</span>
                  <span>₱{metrics.dues.totalDues.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Attendance Trends by Session Type */}
            <div className="glass-container content-anim-item p-7.5">
              <h3 className="text-lg font-bold mb-5 text-primary">Attendance Averages</h3>
              
              {Object.keys(metrics.attendance.rateByType).length === 0 ? (
                <p className="text-muted text-center py-6">No attendance sessions logged yet.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {Object.entries(metrics.attendance.rateByType).map(([type, rate]) => (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-semibold">{SESSION_TYPE_LABELS[type] || type}</span>
                        <span className="text-primary font-bold">{rate}%</span>
                      </div>
                      <div className="w-full h-2 bg-blue-900/6 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-[width] duration-800 ease-out"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Third row: Roles and Repertoire Popularity */}
          <div className="responsive-grid-360 grid gap-7.5">
            {/* Roster Role Distribution */}
            <div className="glass-container content-anim-item p-7.5">
              <h3 className="text-lg font-bold mb-5 text-primary">Roster Role Breakdown</h3>
              <div className="flex flex-col gap-3">
                {Object.entries(metrics.roleBreakdown).map(([role, count]) => (
                  <div key={role} className="flex justify-between items-center py-2.5 px-3.5 bg-white/40 rounded-lg border border-glass-border">
                    <span className="font-medium">{ROLE_DISPLAY_NAMES[role] || role}</span>
                    <span className="badge badge-pending !bg-blue-900/6 !text-primary !font-bold">
                      {count} {count === 1 ? 'user' : 'users'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular Song repertoire */}
            <div className="glass-container content-anim-item p-7.5">
              <h3 className="text-lg font-bold mb-5 text-primary">Popular Repertoire Songs</h3>
              
              {metrics.popularSongs.length === 0 ? (
                <p className="text-muted text-center py-10">No songs assigned to Mass sequences yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {metrics.popularSongs.map((song, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 px-3.5 bg-white/40 rounded-lg border border-glass-border">
                      <div>
                        <strong className="text-primary">{song.title}</strong>
                        <span className="text-xs text-muted block mt-0.5">Category: {song.category}</span>
                      </div>
                      <span className="text-sm text-muted font-semibold">
                        Used <strong className="text-accent">{song.count}</strong> {song.count === 1 ? 'time' : 'times'}
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
