'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  CalendarCheck,
  PiggyBank,
  Sparkles,
  FileText,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { DuesPeriod, DuesPayment, Solicitation, SolicitationContribution } from '@/lib/financeUtils';
import { SundayCollectionTab } from './SundayCollectionTab';
import { DuesLedgerTab } from './DuesLedgerTab';
import { SolicitationsManagerTab } from './SolicitationsManagerTab';
import { FinanceReportsTab } from './FinanceReportsTab';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  created_at: string;
  voice_part?: string | null;
  avatar_url?: string | null;
  is_dues_exempt?: boolean;
}

interface AttendanceSession {
  id: string;
  name: string;
  date: string;
  type: 'rehearsal' | 'performance' | 'mass' | 'special_event';
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  profile_id: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  created_at: string;
}

interface FinancesClientProps {
  currentUserProfile: Profile;
  periods: DuesPeriod[];
  payments: DuesPayment[];
  solicitations: Solicitation[];
  contributions: SolicitationContribution[];
  members: Profile[];
  attendanceSessions?: AttendanceSession[];
  attendanceRecords?: AttendanceRecord[];
}

export const FinancesClient: React.FC<FinancesClientProps> = ({
  currentUserProfile,
  periods = [],
  payments = [],
  solicitations = [],
  contributions = [],
  members = [],
  attendanceSessions = [],
  attendanceRecords = [],
}) => {
  const [activeTab, setActiveTab] = useState<'sunday' | 'dues' | 'solicitations' | 'reports'>('sunday');

  const isSecretary = currentUserProfile.role === 'secretary';
  const canMutate = ['super_admin', 'director', 'treasurer'].includes(currentUserProfile.role);

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full !pt-3 sm:!pt-6 !pb-28 sm:!pb-16 !px-3 sm:!px-6 max-w-[1240px] mx-auto w-full">
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 bg-white/60 backdrop-blur-md p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[0.68rem] sm:text-xs font-extrabold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <DollarSign size={12} /> Financial Administration
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-[1.75rem] font-black text-slate-900 tracking-tight flex items-center gap-2">
                Choir Sinking Fund & Finances
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Manage monthly Sinking Fund dues, rapid Sunday Mass tallies, fundraising solicitations, and audit reports.
              </p>
            </div>

            {isSecretary && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3.5 py-2.5 rounded-xl self-start md:self-center">
                <Info size={16} className="shrink-0 text-blue-600" />
                <span className="font-semibold">Secretary View (Read-only financial records)</span>
              </div>
            )}
          </div>

          {/* Navigation Tabs - Fluid scrollable on mobile & tablet */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-3 px-3 sm:mx-0 sm:px-0 border-b border-slate-200/80 pb-3">
            <button
              onClick={() => setActiveTab('sunday')}
              className={`py-2 px-3.5 sm:py-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'sunday'
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <CalendarCheck size={16} />
              <span>Sunday Collection</span>
            </button>

            <button
              onClick={() => setActiveTab('dues')}
              className={`py-2 px-3.5 sm:py-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'dues'
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <PiggyBank size={16} />
              <span>Monthly Dues</span>
            </button>

            <button
              onClick={() => setActiveTab('solicitations')}
              className={`py-2 px-3.5 sm:py-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'solicitations'
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Sparkles size={16} />
              <span>Solicitations</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`py-2 px-3.5 sm:py-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                activeTab === 'reports'
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <FileText size={16} />
              <span>Reports & PDF</span>
            </button>
          </div>

          {/* Tab Content Display */}
          <div className="mt-1">
            {activeTab === 'sunday' && (
              <SundayCollectionTab
                periods={periods}
                payments={payments}
                members={members}
                currentUserProfile={currentUserProfile}
                attendanceSessions={attendanceSessions}
                attendanceRecords={attendanceRecords}
              />
            )}

            {activeTab === 'dues' && (
              <DuesLedgerTab
                periods={periods}
                payments={payments}
                members={members}
                currentUserProfile={currentUserProfile}
                attendanceSessions={attendanceSessions}
                attendanceRecords={attendanceRecords}
              />
            )}

            {activeTab === 'solicitations' && (
              <SolicitationsManagerTab
                solicitations={solicitations}
                contributions={contributions}
                members={members}
                currentUserProfile={currentUserProfile}
              />
            )}

            {activeTab === 'reports' && (
              <FinanceReportsTab
                periods={periods}
                payments={payments}
                solicitations={solicitations}
                contributions={contributions}
                members={members}
                currentUserProfile={currentUserProfile}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default FinancesClient;
