'use client';

import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Search,
  Check,
  Clock,
  Wifi,
  WifiOff,
  RefreshCw,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  Undo2,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import {
  formatPHPFromCentavos,
  pesosToCentavos,
  getCurrentPeriodLabel,
  formatPeriodLabel,
  PaymentMethod,
  DuesPeriod,
  DuesPayment,
} from '@/lib/financeUtils';
import { useOfflineCollectionQueue } from '@/hooks/useOfflineCollectionQueue';
import { recordDuesPayment, voidDuesPayment } from './actions';

export interface MemberProfile {
  id: string;
  full_name: string;
  email: string;
  voice_part?: string | null;
  avatar_url?: string | null;
}

export type DuesPaymentData = DuesPayment;
export type DuesPeriodData = DuesPeriod;

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

interface SundayCollectionTabProps {
  members?: MemberProfile[];
  currentPeriods?: DuesPeriod[];
  periods?: DuesPeriod[];
  payments?: DuesPayment[];
  allPayments?: DuesPayment[];
  currentUserProfile?: any;
  onPaymentSuccess?: () => void;
  attendanceSessions?: AttendanceSession[];
  attendanceRecords?: AttendanceRecord[];
}

const PRESET_AMOUNTS = [5, 10, 20];

export const SundayCollectionTab = ({
  members = [],
  currentPeriods,
  periods,
  payments,
  allPayments,
  currentUserProfile,
  onPaymentSuccess,
  attendanceSessions = [],
  attendanceRecords = [],
}: SundayCollectionTabProps) => {
  const effectivePeriods = currentPeriods || periods || [];
  const effectivePayments = allPayments || payments || [];
  const { addToast } = useToast();
  const currentPeriodLabel = getCurrentPeriodLabel();
  const todayDateStr = new Date().toISOString().substring(0, 10);

  // Auto-detect today's attendance session, or fallback to the most recent session
  const defaultSessionId = useMemo(() => {
    const todaySession = attendanceSessions.find((s) => s.date === todayDateStr);
    if (todaySession) return todaySession.id;
    return attendanceSessions[0]?.id || '';
  }, [attendanceSessions, todayDateStr]);

  // Attendance Session & Filter State
  const [selectedSessionId, setSelectedSessionId] = useState<string>(defaultSessionId);
  const [attendanceFilter, setAttendanceFilter] = useState<'PRESENT' | 'UNPAID_PRESENT' | 'ALL'>('PRESENT');

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [referenceInput, setReferenceInput] = useState('');
  const [customAmountInputs, setCustomAmountInputs] = useState<Record<string, string>>({});
  const [submittingMemberId, setSubmittingMemberId] = useState<string | null>(null);

  // Void / Undo Payment Modal State
  const [undoPaymentData, setUndoPaymentData] = useState<{
    paymentId: string;
    memberName: string;
    amountCentavos: number;
  } | null>(null);
  const [undoReason, setUndoReason] = useState('Accidental tap / Wrong member selected');
  const [undoLoading, setUndoLoading] = useState(false);

  // Close-out Discrepancy Dialog
  const [showCloseOutModal, setShowCloseOutModal] = useState(false);
  const [physicalCashDeclared, setPhysicalCashDeclared] = useState('');

  // Offline Sync Hook
  const { queue, isOnline, isSyncing, pendingCount, failedCount, enqueuePayment, syncQueue } =
    useOfflineCollectionQueue(onPaymentSuccess);

  // Selected Attendance Session Object
  const currentAttendanceSession = useMemo(() => {
    return attendanceSessions.find((s) => s.id === selectedSessionId) || null;
  }, [attendanceSessions, selectedSessionId]);

  // Map member profile ID to their attendance status in the selected session
  const attendanceStatusMap = useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | 'excused' | 'late'>();
    if (!selectedSessionId) return map;

    attendanceRecords
      .filter((r) => r.session_id === selectedSessionId)
      .forEach((r) => {
        map.set(r.profile_id, r.status);
      });
    return map;
  }, [attendanceRecords, selectedSessionId]);

  // Attendance Statistics for this Session
  const attendanceStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let excused = 0;

    attendanceStatusMap.forEach((status) => {
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else if (status === 'absent') absent++;
      else if (status === 'excused') excused++;
    });

    return {
      present,
      late,
      absent,
      excused,
      totalPresent: present + late,
      hasRecords: attendanceStatusMap.size > 0,
    };
  }, [attendanceStatusMap]);

  // Map member to period & payments
  const memberPeriodMap = useMemo(() => {
    const map = new Map<string, DuesPeriodData>();
    effectivePeriods.forEach((p) => {
      map.set(p.member_id, p);
    });
    return map;
  }, [effectivePeriods]);

  // Derived Collection Stats for Today
  const todayPayments = useMemo(() => {
    const list: Array<{ memberId: string; amountCentavos: number }> = [];
    effectivePeriods.forEach((p) => {
      (p.payments || []).forEach((pmt) => {
        if (!pmt.voided_at && pmt.paid_at && pmt.paid_at.startsWith(todayDateStr)) {
          list.push({ memberId: p.member_id, amountCentavos: pmt.amount_centavos });
        }
      });
    });
    return list;
  }, [effectivePeriods, todayDateStr]);

  const totalCollectedTodayCentavos = todayPayments.reduce((sum, p) => sum + p.amountCentavos, 0);
  const uniqueMembersCollectedTodayCount = new Set(todayPayments.map((p) => p.memberId)).size;

  // Process and sort member list according to Attendance & Dues Standing
  const processedMembers = useMemo(() => {
    return members.map((member) => {
      const period = memberPeriodMap.get(member.id);
      const attStatus = attendanceStatusMap.get(member.id) || null;
      const isPresentOrLate = attStatus === 'present' || attStatus === 'late';

      const memberPeriodPayments = effectivePayments.filter(
        (pmt) => pmt.dues_period_id === period?.id
      );
      const allMemberPmts = memberPeriodPayments.length > 0 ? memberPeriodPayments : (period?.payments || []);
      const nonVoidedPayments = allMemberPmts.filter((p) => !p.voided_at);
      const paidMonthCentavos = nonVoidedPayments.reduce((sum, p) => sum + p.amount_centavos, 0);
      const latestPayment = nonVoidedPayments[nonVoidedPayments.length - 1] || null;

      const effectiveDueCentavos = Math.max(
        0,
        (period?.base_amount_centavos || 4000) + (period?.carried_balance_centavos || 0)
      );

      const remainingMonthCentavos = Math.max(0, effectiveDueCentavos - paidMonthCentavos);
      const isMonthPaid = effectiveDueCentavos > 0 ? remainingMonthCentavos === 0 : true;

      return {
        member,
        period,
        attStatus,
        isPresentOrLate,
        paidMonthCentavos,
        effectiveDueCentavos,
        remainingMonthCentavos,
        isMonthPaid,
        latestPayment,
        nonVoidedPayments,
      };
    });
  }, [members, memberPeriodMap, attendanceStatusMap, effectivePayments]);

  // Filter & Sort members: Present members appear first, prioritizing unpaid
  const filteredAndSortedMembers = useMemo(() => {
    let list = processedMembers;

    // 1. Text Search Filter (name, voice, email)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.member.full_name.toLowerCase().includes(q) ||
          (item.member.voice_part && item.member.voice_part.toLowerCase().includes(q)) ||
          item.member.email.toLowerCase().includes(q)
      );
    }

    // 2. Attendance Toggle Filter
    if (attendanceFilter === 'PRESENT' && attendanceStats.hasRecords) {
      list = list.filter((item) => item.isPresentOrLate);
    } else if (attendanceFilter === 'UNPAID_PRESENT' && attendanceStats.hasRecords) {
      list = list.filter((item) => item.isPresentOrLate && !item.isMonthPaid);
    }

    // 3. Smart Sorting:
    // Rank 0: Present & Unpaid (Immediate target for collection)
    // Rank 1: Present & Paid (Already contributed)
    // Rank 2: Absent/Unmarked & Unpaid
    // Rank 3: Absent/Unmarked & Paid
    return [...list].sort((a, b) => {
      const rankA = a.isPresentOrLate ? (a.isMonthPaid ? 1 : 0) : (a.isMonthPaid ? 3 : 2);
      const rankB = b.isPresentOrLate ? (b.isMonthPaid ? 1 : 0) : (b.isMonthPaid ? 3 : 2);

      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return a.member.full_name.localeCompare(b.member.full_name);
    });
  }, [processedMembers, searchQuery, attendanceFilter, attendanceStats.hasRecords]);

  // Count of unpaid present members
  const unpaidPresentCount = useMemo(() => {
    return processedMembers.filter((item) => item.isPresentOrLate && !item.isMonthPaid).length;
  }, [processedMembers]);

  // Handle Recording Payment
  const handleQuickPay = async (member: MemberProfile, pesos: number) => {
    if (pesos <= 0 || isNaN(pesos)) {
      addToast({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid peso amount.' });
      return;
    }

    const centavos = pesosToCentavos(pesos);
    setSubmittingMemberId(member.id);

    if (!navigator.onLine) {
      // Queue offline
      enqueuePayment({
        member_id: member.id,
        period_label: currentPeriodLabel,
        amount_centavos: centavos,
        method: selectedMethod,
        reference: referenceInput.trim() || undefined,
        paid_at: new Date().toISOString(),
        member_name: member.full_name,
      });

      addToast({
        type: 'info',
        title: 'Saved to Offline Queue',
        message: `₱${pesos} recorded for ${member.full_name}. Will sync when connection is restored.`,
      });
      setSubmittingMemberId(null);
      return;
    }

    // Live Server Submission
    const res = await recordDuesPayment({
      memberId: member.id,
      periodLabel: currentPeriodLabel,
      amountCentavos: centavos,
      method: selectedMethod,
      reference: referenceInput.trim() || null,
      paidAt: new Date().toISOString(),
    });

    setSubmittingMemberId(null);

    if (res?.error) {
      addToast({ type: 'error', title: 'Payment Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: `✓ ₱${pesos} Recorded`,
        message: `Sinking fund payment saved for ${member.full_name}.`,
      });

      // Clear custom input for member if any
      setCustomAmountInputs((prev) => {
        const copy = { ...prev };
        delete copy[member.id];
        return copy;
      });

      if (onPaymentSuccess) onPaymentSuccess();
    }
  };

  // Handle Void / Undo Payment
  const handleConfirmUndoPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!undoPaymentData) return;

    setUndoLoading(true);
    const res = await voidDuesPayment({
      paymentId: undoPaymentData.paymentId,
      reason: undoReason.trim() || 'Accidental tap during Sunday collection',
    });
    setUndoLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Undo Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Payment Voided & Reset',
        message: `Payment of ${formatPHPFromCentavos(undoPaymentData.amountCentavos)} for ${undoPaymentData.memberName} has been reset to ₱0 and balance restored.`,
      });
      setUndoPaymentData(null);
      if (onPaymentSuccess) onPaymentSuccess();
    }
  };

  // Close-out Discrepancy Calculation
  const declaredCashCentavos = physicalCashDeclared ? pesosToCentavos(parseFloat(physicalCashDeclared) || 0) : 0;
  const cashDiscrepancyCentavos = declaredCashCentavos - totalCollectedTodayCentavos;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Top Banner: Sunday Collection Summary & Offline Sync Bar */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-amber-500/10 border border-primary/20 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[0.68rem] sm:text-[0.72rem] font-extrabold uppercase tracking-wider text-primary bg-white/80 py-0.5 px-2.5 rounded-full border border-primary/20 flex items-center gap-1">
                <Clock size={12} /> Post-Mass Sunday Tally
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                {formatPeriodLabel(currentPeriodLabel)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl sm:text-3xl font-black text-primary m-0">
                {formatPHPFromCentavos(totalCollectedTodayCentavos)}
              </h2>
              <span className="text-xs text-slate-600 font-bold">collected today</span>
            </div>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              {uniqueMembersCollectedTodayCount} of {members.length} members contributed today
            </p>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Online / Offline Status Badge */}
            <div
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
            >
              {isOnline ? <Wifi size={14} className="text-emerald-600" /> : <WifiOff size={14} className="text-amber-600" />}
              <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
            </div>

            {/* Sync Queue Button (if queue > 0) */}
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={syncQueue}
                disabled={isSyncing || !isOnline}
                className="btn btn-primary !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing…' : `Sync (${pendingCount})`}</span>
              </button>
            )}

            {/* Batch Close-Out Button */}
            <button
              type="button"
              onClick={() => setShowCloseOutModal(true)}
              className="btn btn-secondary !py-2 !px-3.5 text-xs font-bold text-slate-700 bg-white shadow-2xs hover:border-primary shrink-0"
            >
              Close-Out Tally
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Connection & Smart Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          {/* Left: Attendance Session Selector & Sync Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.68rem] font-extrabold uppercase tracking-wider text-slate-400">
              Attendance Link:
            </span>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-primary transition-all"
            >
              {attendanceSessions.length === 0 ? (
                <option value="">No attendance sessions found</option>
              ) : (
                attendanceSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({new Date(s.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })})
                    {s.date === todayDateStr ? ' • Today' : ''}
                  </option>
                ))
              )}
            </select>

            {attendanceStats.hasRecords && (
              <div className="flex items-center gap-1.5 text-[0.68rem] font-bold">
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                  ✓ {attendanceStats.present} Present
                </span>
                {attendanceStats.late > 0 && (
                  <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md">
                    ⏱ {attendanceStats.late} Late
                  </span>
                )}
                {attendanceStats.absent > 0 && (
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                    ✕ {attendanceStats.absent} Absent
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Secretary quick link */}
          {['super_admin', 'director', 'secretary'].includes(currentUserProfile?.role) && (
            <a
              href="/admin/attendance"
              className="text-[0.7rem] font-bold text-primary hover:underline inline-flex items-center gap-1 self-start md:self-center"
            >
              Secretary Roll Sheet →
            </a>
          )}
        </div>

        {/* Attendance Filter Segmented Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setAttendanceFilter('PRESENT')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              attendanceFilter === 'PRESENT'
                ? 'bg-primary text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Present Today ({attendanceStats.totalPresent})
          </button>

          <button
            type="button"
            onClick={() => setAttendanceFilter('UNPAID_PRESENT')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              attendanceFilter === 'UNPAID_PRESENT'
                ? 'bg-amber-700 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Unpaid Present ({unpaidPresentCount})
          </button>

          <button
            type="button"
            onClick={() => setAttendanceFilter('ALL')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              attendanceFilter === 'ALL'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Choir Members ({members.length})
          </button>
        </div>
      </div>

      {/* Offline Alert if pending entries exist */}
      {failedCount > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <span>{failedCount} payment(s) failed to sync. Click retry to sync again.</span>
          </div>
          <button
            type="button"
            onClick={syncQueue}
            className="text-xs font-bold underline bg-transparent border-0 cursor-pointer text-red-900 shrink-0"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Payment Controls Bar: Method & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search member name or voice section…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-primary focus:bg-white transition-all text-slate-800"
          />
        </div>

        {/* Payment Method Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 sm:pb-0">
          <span className="text-[0.68rem] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden md:inline">
            Method:
          </span>
          {(['cash', 'gcash', 'bank_transfer', 'other'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMethod(m)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                selectedMethod === m
                  ? 'bg-primary text-white border-primary shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {m === 'cash' ? 'Cash' : m === 'gcash' ? 'GCash' : m === 'bank_transfer' ? 'Bank' : 'Other'}
            </button>
          ))}
        </div>
      </div>

      {/* Member Rapid Tap List with Attendance Badges */}
      <div className="flex flex-col gap-2.5">
        {filteredAndSortedMembers.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs sm:text-sm">
            {attendanceFilter === 'PRESENT'
              ? 'No members marked present for this session. Switch to "All Choir Members" or select another session.'
              : attendanceFilter === 'UNPAID_PRESENT'
              ? 'All present members have fully settled their dues! Great job!'
              : `No choir members matched "${searchQuery}"`}
          </div>
        ) : (
          filteredAndSortedMembers.map((item) => {
            const { member, isPresentOrLate, attStatus, paidMonthCentavos, effectiveDueCentavos, remainingMonthCentavos, isMonthPaid, latestPayment } = item;
            const isSubmitting = submittingMemberId === member.id;
            const customVal = customAmountInputs[member.id] || '';

            return (
              <div
                key={member.id}
                className={`p-3 sm:p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs ${
                  isMonthPaid
                    ? 'bg-emerald-50/25 border-emerald-200/60'
                    : isPresentOrLate
                    ? 'bg-white border-primary/40 ring-1 ring-primary/10'
                    : 'bg-white/80 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {/* Member Identity & Attendance Status */}
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={member.avatar_url}
                    name={member.full_name}
                    size={38}
                    className="flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                        {member.full_name}
                      </span>
                      
                      {member.voice_part && (
                        <span className="text-[0.65rem] sm:text-[0.68rem] font-semibold text-primary bg-primary/10 px-1.5 py-0.2 rounded border border-primary/15">
                          {member.voice_part}
                        </span>
                      )}

                      {/* Attendance Indicator Pill */}
                      {attStatus === 'present' && (
                        <span className="text-[0.62rem] sm:text-[0.65rem] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                          ● Present
                        </span>
                      )}
                      {attStatus === 'late' && (
                        <span className="text-[0.62rem] sm:text-[0.65rem] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                          ⏱ Late
                        </span>
                      )}
                      {attStatus === 'absent' && (
                        <span className="text-[0.62rem] sm:text-[0.65rem] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded-full">
                          ✕ Absent
                        </span>
                      )}
                      {attStatus === 'excused' && (
                        <span className="text-[0.62rem] sm:text-[0.65rem] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full">
                          ~ Excused
                        </span>
                      )}

                      {/* Payment Status Pill */}
                      {isMonthPaid && (
                        <span className="text-[0.65rem] sm:text-[0.68rem] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                          <Check size={11} /> Paid
                        </span>
                      )}
                    </div>
                    
                    <div className="text-[0.7rem] sm:text-[0.72rem] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>
                        Paid this month: <strong className="text-slate-800">{formatPHPFromCentavos(paidMonthCentavos)}</strong> / {formatPHPFromCentavos(effectiveDueCentavos)}
                      </span>
                      {remainingMonthCentavos > 0 && (
                        <span className="text-amber-800 font-bold">
                          ({formatPHPFromCentavos(remainingMonthCentavos)} left)
                        </span>
                      )}
                      {latestPayment && paidMonthCentavos > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setUndoPaymentData({
                              paymentId: latestPayment.id,
                              memberName: member.full_name,
                              amountCentavos: latestPayment.amount_centavos,
                            });
                            setUndoReason('Accidental tap on wrong member during Sunday collection');
                          }}
                          className="text-[0.65rem] font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 px-1.5 py-0.2 rounded transition-colors inline-flex items-center gap-0.5 cursor-pointer ml-1 active:scale-95"
                          title={`Undo / Void latest payment of ${formatPHPFromCentavos(latestPayment.amount_centavos)} for ${member.full_name}`}
                        >
                          <Undo2 size={10} />
                          <span>Undo / Void ({formatPHPFromCentavos(latestPayment.amount_centavos)})</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* One-Tap Payment Action Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-between md:justify-end w-full md:w-auto pt-1 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
                    {PRESET_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleQuickPay(member, amt)}
                        className="flex-1 sm:flex-none py-2 px-3 sm:py-1.5 sm:px-3 rounded-xl text-xs font-black bg-white text-primary border border-primary/30 hover:bg-primary hover:text-white transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50 text-center"
                        title={`Collect ₱${amt} for ${member.full_name}`}
                      >
                        +₱{amt}
                      </button>
                    ))}
                  </div>

                  {/* Custom Peso Input */}
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      placeholder="₱ Custom"
                      min={1}
                      value={customVal}
                      onChange={(e) =>
                        setCustomAmountInputs((prev) => ({
                          ...prev,
                          [member.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customVal) {
                          handleQuickPay(member, parseFloat(customVal));
                        }
                      }}
                      className="w-20 px-2 py-2 sm:py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-mono text-center outline-none focus:border-primary focus:bg-white"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting || !customVal}
                      onClick={() => handleQuickPay(member, parseFloat(customVal))}
                      className="py-2 px-2.5 sm:py-1.5 sm:px-2.5 rounded-xl text-xs font-bold bg-primary text-white border-0 hover:bg-primary-hover disabled:opacity-40 cursor-pointer shadow-2xs"
                    >
                      Record
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Undo / Void Modal for Sunday Collection */}
      {undoPaymentData && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
          onClick={() => setUndoPaymentData(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-700 border-b border-slate-100 pb-3">
              <ShieldAlert size={20} />
              <h3 className="text-base font-bold m-0">Undo / Void Sunday Payment</h3>
            </div>

            <form onSubmit={handleConfirmUndoPayment} className="flex flex-col gap-3 text-xs sm:text-sm">
              <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl text-xs text-red-900 leading-relaxed">
                <strong>Reverting Payment:</strong> You are about to void the payment of{' '}
                <strong className="text-red-700 font-bold font-mono">
                  {formatPHPFromCentavos(undoPaymentData.amountCentavos)}
                </strong>{' '}
                recorded for <strong>{undoPaymentData.memberName}</strong>. This will deduct the amount from today&apos;s collection tally and restore their unpaid balance.
              </div>

              <div>
                <label className="input-label" htmlFor="undoReasonInput">
                  Reason for Voiding *
                </label>
                <input
                  id="undoReasonInput"
                  type="text"
                  required
                  value={undoReason}
                  onChange={(e) => setUndoReason(e.target.value)}
                  className="input-field text-xs sm:text-sm"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setUndoPaymentData(null)}
                  disabled={undoLoading}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={undoLoading || !undoReason.trim()}
                  className="btn !bg-red-600 hover:!bg-red-700 !text-white !py-2 !px-4 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Undo2 size={13} />
                  <span>{undoLoading ? 'Voiding…' : 'Confirm Void & Revert'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close-Out Verification Modal */}
      {showCloseOutModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
          onClick={() => setShowCloseOutModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" />
                Sunday Collection Close-Out
              </h3>
              <button
                type="button"
                onClick={() => setShowCloseOutModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-transparent border-0 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs sm:text-sm text-slate-700">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center">
                <span>System Recorded Total:</span>
                <strong className="text-primary font-bold text-base">
                  {formatPHPFromCentavos(totalCollectedTodayCentavos)}
                </strong>
              </div>

              <div>
                <label className="input-label" htmlFor="physicalCashInput">
                  Enter Physical Cash Counted (₱)
                </label>
                <input
                  id="physicalCashInput"
                  type="number"
                  placeholder="e.g. 340.00"
                  value={physicalCashDeclared}
                  onChange={(e) => setPhysicalCashDeclared(e.target.value)}
                  className="input-field text-base font-bold font-mono"
                  autoFocus
                />
              </div>

              {physicalCashDeclared && (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    cashDiscrepancyCentavos === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  {cashDiscrepancyCentavos === 0 ? (
                    <>
                      <Check size={16} className="text-emerald-600 flex-shrink-0" />
                      <span>Physical cash matches the system total perfectly!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                      <span>
                        Discrepancy detected: {formatPHPFromCentavos(cashDiscrepancyCentavos)}{' '}
                        {cashDiscrepancyCentavos > 0 ? '(Overage)' : '(Shortfall)'}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCloseOutModal(false)}
                className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
