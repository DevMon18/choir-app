'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  RefreshCw,
  Plus,
  FileDown,
  AlertCircle,
  Check,
  X,
  Clock,
  Sparkles,
  ShieldAlert,
  History,
  RotateCcw,
  Undo2,
  Receipt,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import {
  formatPHPFromCentavos,
  formatPeriodLabel,
  formatPaymentMethod,
  getCurrentPeriodLabel,
  getPreviousPeriodLabel,
  PaymentMethod,
  DuesPeriod,
  DuesPayment,
} from '@/lib/financeUtils';
import {
  recordDuesPayment,
  voidDuesPayment,
  toggleMemberDuesExemption,
  triggerMonthlyRollover,
} from './actions';

const VOID_PRESET_REASONS = [
  'Incorrect member selected',
  'Wrong amount encoded',
  'Duplicate payment entry',
  'Cash refunded to member',
  'Correction requested by member',
];

interface MemberProfile {
  id: string;
  full_name: string;
  email: string;
  voice_part?: string | null;
  avatar_url?: string | null;
}

interface AttendanceSession {
  id: string;
  name: string;
  date: string;
  type: string;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  profile_id: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  created_at: string;
}

interface DuesLedgerTabProps {
  members?: MemberProfile[];
  allPeriods?: DuesPeriod[];
  periods?: DuesPeriod[];
  allPayments?: DuesPayment[];
  payments?: DuesPayment[];
  currentUserProfile?: any;
  onRefresh?: () => void;
  attendanceSessions?: AttendanceSession[];
  attendanceRecords?: AttendanceRecord[];
}

export const DuesLedgerTab = ({
  members = [],
  allPeriods,
  periods,
  allPayments,
  payments,
  currentUserProfile,
  onRefresh,
  attendanceSessions = [],
  attendanceRecords = [],
}: DuesLedgerTabProps) => {
  const effectivePeriods = allPeriods || periods || [];
  const effectivePayments = allPayments || payments || [];
  const { addToast } = useToast();
  const currentPeriod = getCurrentPeriodLabel();

  // Period Filter Selection
  const [selectedPeriodLabel, setSelectedPeriodLabel] = useState<string>(currentPeriod);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PRESENT' | 'PAID' | 'UNPAID' | 'EXEMPT'>('ALL');

  // Payment Recording Modal State
  const [activePaymentMember, setActivePaymentMember] = useState<MemberProfile | null>(null);
  const [payAmount, setPayAmount] = useState('40');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payReference, setPayReference] = useState('');
  const [recordingLoading, setRecordingLoading] = useState(false);

  // View Member Payments Modal State
  const [viewingMemberPayments, setViewingMemberPayments] = useState<MemberProfile | null>(null);

  // Void Payment Modal State
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidingLoading, setVoidingLoading] = useState(false);

  // Rollover trigger loading
  const [rolloverLoading, setRolloverLoading] = useState(false);

  // List of distinct period labels available
  const availablePeriodLabels = useMemo(() => {
    const set = new Set<string>([currentPeriod, getPreviousPeriodLabel(currentPeriod)]);
    effectivePeriods.forEach((p) => set.add(p.period_label));
    return Array.from(set).sort().reverse();
  }, [effectivePeriods, currentPeriod]);

  // Payments for selected period
  const periodPayments = useMemo(() => {
    const periodIds = new Set(
      effectivePeriods.filter((p) => p.period_label === selectedPeriodLabel).map((p) => p.id)
    );
    return effectivePayments.filter((pmt) => periodIds.has(pmt.dues_period_id));
  }, [effectivePeriods, effectivePayments, selectedPeriodLabel]);

  // Auto-detect latest session or today's session
  const todayDateStr = new Date().toISOString().substring(0, 10);
  const activeAttendanceSession = useMemo(() => {
    const todaySession = attendanceSessions.find((s) => s.date === todayDateStr);
    return todaySession || attendanceSessions[0] || null;
  }, [attendanceSessions, todayDateStr]);

  // Map member profile ID to attendance status
  const attendanceStatusMap = useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | 'excused' | 'late'>();
    if (!activeAttendanceSession) return map;

    attendanceRecords
      .filter((r) => r.session_id === activeAttendanceSession.id)
      .forEach((r) => {
        map.set(r.profile_id, r.status);
      });
    return map;
  }, [attendanceRecords, activeAttendanceSession]);

  // Combined Member Dues Records for selected period
  const memberDuesRows = useMemo(() => {
    return members.map((member) => {
      const period = effectivePeriods.find(
        (p) => p.member_id === member.id && p.period_label === selectedPeriodLabel
      );

      const payments = periodPayments.filter((pmt) => pmt.dues_period_id === period?.id);
      const nonVoidedPayments = payments.filter((p) => !p.voided_at);

      const totalPaidCentavos = nonVoidedPayments.reduce((sum, p) => sum + p.amount_centavos, 0);

      const baseAmountCentavos = period ? period.base_amount_centavos : 4000;
      const carriedBalanceCentavos = period ? period.carried_balance_centavos : 0;
      const isExempt = !!period?.is_exempt;

      const grossTarget = baseAmountCentavos + carriedBalanceCentavos;
      const effectiveDueCentavos = isExempt ? 0 : Math.max(0, grossTarget);
      const remainingBalanceCentavos = effectiveDueCentavos - totalPaidCentavos;

      const isFullyPaid = isExempt || (effectiveDueCentavos === 0 && totalPaidCentavos >= 0) || remainingBalanceCentavos <= 0;
      const attStatus = attendanceStatusMap.get(member.id);
      const isPresent = attStatus === 'present' || attStatus === 'late';

      return {
        member,
        period,
        baseAmountCentavos,
        carriedBalanceCentavos,
        effectiveDueCentavos,
        totalPaidCentavos,
        remainingBalanceCentavos,
        isExempt,
        isFullyPaid,
        payments,
        attStatus,
        isPresent,
      };
    });
  }, [members, effectivePeriods, periodPayments, selectedPeriodLabel, attendanceStatusMap]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const list = memberDuesRows.filter((row) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          row.member.full_name.toLowerCase().includes(q) ||
          row.member.email.toLowerCase().includes(q) ||
          (row.member.voice_part && row.member.voice_part.toLowerCase().includes(q));
        if (!match) return false;
      }

      if (statusFilter === 'PRESENT' && !row.isPresent) return false;
      if (statusFilter === 'PAID' && !row.isFullyPaid) return false;
      if (statusFilter === 'UNPAID' && (row.isFullyPaid || row.isExempt)) return false;
      if (statusFilter === 'EXEMPT' && !row.isExempt) return false;

      return true;
    });

    // If status filter is ALL, sort present members first
    return list.sort((a, b) => {
      if (a.isPresent && !b.isPresent) return -1;
      if (!a.isPresent && b.isPresent) return 1;
      return a.member.full_name.localeCompare(b.member.full_name);
    });
  }, [memberDuesRows, searchQuery, statusFilter]);

  // Aggregate Metrics for this period
  const totalTargetCentavos = memberDuesRows.reduce((sum, r) => sum + r.effectiveDueCentavos, 0);
  const totalPaidCentavos = memberDuesRows.reduce((sum, r) => sum + r.totalPaidCentavos, 0);
  const totalOutstandingCentavos = memberDuesRows.reduce(
    (sum, r) => sum + Math.max(0, r.remainingBalanceCentavos),
    0
  );

  // Handle Record Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePaymentMember) return;

    const pesos = parseFloat(payAmount);
    if (isNaN(pesos) || pesos <= 0) {
      addToast({ type: 'error', title: 'Invalid Amount', message: 'Enter a valid amount.' });
      return;
    }

    setRecordingLoading(true);
    const res = await recordDuesPayment({
      memberId: activePaymentMember.id,
      periodLabel: selectedPeriodLabel,
      amountCentavos: Math.round(pesos * 100),
      method: payMethod,
      reference: payReference.trim() || null,
    });
    setRecordingLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Payment Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: '✓ Payment Recorded',
        message: `₱${pesos} recorded for ${activePaymentMember.full_name}.`,
      });
      setActivePaymentMember(null);
      setPayReference('');
      if (onRefresh) onRefresh();
    }
  };

  // Handle Void Payment
  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidPaymentId) return;

    if (!voidReason.trim()) {
      addToast({ type: 'error', title: 'Reason Required', message: 'Please provide a reason for voiding.' });
      return;
    }

    setVoidingLoading(true);
    const res = await voidDuesPayment({
      paymentId: voidPaymentId,
      reason: voidReason.trim(),
    });
    setVoidingLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Void Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Payment Voided',
        message: 'The transaction was successfully voided and logged in audit.',
      });
      setVoidPaymentId(null);
      setVoidReason('');
      if (onRefresh) onRefresh();
    }
  };

  // Handle Rollover Execution
  const handleRunRollover = async () => {
    const confirmMsg = `Run monthly rollover for ${formatPeriodLabel(selectedPeriodLabel)}? This will compute carryovers from previous month and generate period obligations for all active members.`;
    if (!window.confirm(confirmMsg)) return;

    setRolloverLoading(true);
    const res = await triggerMonthlyRollover({ targetPeriodLabel: selectedPeriodLabel });
    setRolloverLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Rollover Error', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Rollover Complete',
        message: `Created ${res.createdCount} new period(s) for ${selectedPeriodLabel}.`,
      });
      if (onRefresh) onRefresh();
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = ['Member Name', 'Email', 'Voice Part', 'Period', 'Base Amount', 'Carry Balance', 'Total Due', 'Total Paid', 'Remaining Balance', 'Status'];
    const rows = memberDuesRows.map((r) => [
      `"${r.member.full_name}"`,
      `"${r.member.email}"`,
      `"${r.member.voice_part || ''}"`,
      `"${selectedPeriodLabel}"`,
      (r.baseAmountCentavos / 100).toFixed(2),
      (r.carriedBalanceCentavos / 100).toFixed(2),
      (r.effectiveDueCentavos / 100).toFixed(2),
      (r.totalPaidCentavos / 100).toFixed(2),
      (r.remainingBalanceCentavos / 100).toFixed(2),
      r.isExempt ? 'Exempt' : r.isFullyPaid ? 'Paid' : 'Unpaid',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `choir_sinking_fund_${selectedPeriodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Period Selection & Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[0.65rem] sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider">
              Total Target Due
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-800">
            {formatPHPFromCentavos(totalTargetCentavos)}
          </div>
          <span className="text-[0.68rem] text-slate-400 font-medium block mt-0.5">
            across {memberDuesRows.length} active members
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[0.65rem] sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider">
              Collected Inflow
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-primary">
            {formatPHPFromCentavos(totalPaidCentavos)}
          </div>
          <span className="text-[0.68rem] text-emerald-700 font-bold block mt-0.5">
            {totalTargetCentavos > 0
              ? `${Math.round((totalPaidCentavos / totalTargetCentavos) * 100)}% collected`
              : '0% collected'}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[0.65rem] sm:text-xs text-slate-500 font-extrabold uppercase tracking-wider">
              Outstanding Balance
            </span>
          </div>
          <div className="text-lg sm:text-2xl font-black text-amber-800">
            {formatPHPFromCentavos(totalOutstandingCentavos)}
          </div>
          <span className="text-[0.68rem] text-amber-700 font-medium block mt-0.5">
            pending collection for {formatPeriodLabel(selectedPeriodLabel)}
          </span>
        </div>
      </div>

      {/* Toolbar Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Left: Period Selector & Rollover Button */}
        <div className="flex items-center gap-2 flex-1 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl flex-1 sm:flex-none">
            <Calendar size={15} className="text-primary shrink-0" />
            <select
              value={selectedPeriodLabel}
              onChange={(e) => setSelectedPeriodLabel(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer border-0 w-full"
            >
              {availablePeriodLabels.map((label) => (
                <option key={label} value={label}>
                  {formatPeriodLabel(label)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleRunRollover}
            disabled={rolloverLoading}
            className="btn btn-secondary !py-2 !px-3 text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
            title="Recalculate or generate dues periods for this month"
          >
            <RefreshCw size={13} className={rolloverLoading ? 'animate-spin' : ''} />
            <span>{rolloverLoading ? 'Running…' : 'Generate / Rollover'}</span>
          </button>
        </div>

        {/* Right: Search, Filter, Export */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[140px] sm:min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search member…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-primary text-slate-800"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer shrink-0"
          >
            <option value="ALL">All Status</option>
            <option value="PRESENT">Present Today/Latest</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
            <option value="EXEMPT">Exempt</option>
          </select>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary !py-2 !px-3 text-xs font-bold inline-flex items-center gap-1 shrink-0"
            title="Export CSV"
          >
            <FileDown size={13} />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Member Dues List - Responsive Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Mobile Feed View (<768px) */}
        <div className="block md:hidden divide-y divide-slate-100">
          {filteredRows.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No members match the selected criteria.
            </div>
          ) : (
            filteredRows.map((row) => {
              return (
                <div key={row.member.id} className="p-3.5 flex flex-col gap-3">
                  {/* Top Row: Avatar + Name + Voice + Status Pill */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar
                        src={row.member.avatar_url}
                        name={row.member.full_name}
                        size={34}
                        className="shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                            {row.member.full_name}
                          </span>
                          {row.attStatus === 'present' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-emerald-100 text-emerald-800">
                              ● Present
                            </span>
                          )}
                          {row.attStatus === 'late' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-amber-100 text-amber-900">
                              ⏱ Late
                            </span>
                          )}
                          {row.attStatus === 'absent' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-slate-100 text-slate-500">
                              ✕ Absent
                            </span>
                          )}
                          {row.attStatus === 'excused' && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-purple-100 text-purple-800">
                              ~ Excused
                            </span>
                          )}
                        </div>
                        <span className="text-[0.68rem] text-slate-400">
                          {row.member.voice_part || 'Member'}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div>
                      {row.isExempt ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          Exempt
                        </span>
                      ) : row.isFullyPaid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Paid ✓
                        </span>
                      ) : row.totalPaidCentavos > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                          Partial
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-red-50 text-red-800 border border-red-200">
                          Unpaid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 4-Chip Stats Grid */}
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-50/80 p-2 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[0.6rem] uppercase tracking-wider text-slate-400 font-bold block">
                        Base
                      </span>
                      <span className="text-xs font-mono font-semibold text-slate-700">
                        {formatPHPFromCentavos(row.baseAmountCentavos)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[0.6rem] uppercase tracking-wider text-slate-400 font-bold block">
                        Carry
                      </span>
                      <span className="text-xs font-mono">
                        {row.carriedBalanceCentavos === 0 ? (
                          <span className="text-slate-400">₱0.00</span>
                        ) : row.carriedBalanceCentavos > 0 ? (
                          <span className="text-amber-700 font-bold">
                            +{formatPHPFromCentavos(row.carriedBalanceCentavos)}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold">
                            {formatPHPFromCentavos(row.carriedBalanceCentavos)}
                          </span>
                        )}
                      </span>
                    </div>

                    <div>
                      <span className="text-[0.6rem] uppercase tracking-wider text-slate-400 font-bold block">
                        Total Due
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900">
                        {formatPHPFromCentavos(row.effectiveDueCentavos)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[0.6rem] uppercase tracking-wider text-slate-400 font-bold block">
                        Paid
                      </span>
                      {row.payments.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setViewingMemberPayments(row.member)}
                          className="text-xs font-mono font-bold text-primary hover:underline inline-flex items-center justify-center gap-0.5 cursor-pointer bg-transparent border-0 p-0 mx-auto"
                          title="Click to view payment breakdown and void / reset to ₱0"
                        >
                          <span>{formatPHPFromCentavos(row.totalPaidCentavos)}</span>
                          <span className="text-[0.6rem] font-bold bg-primary/10 text-primary px-1 rounded">
                            ({row.payments.length})
                          </span>
                        </button>
                      ) : (
                        <span className="text-xs font-mono font-bold text-slate-400">
                          ₱0.00
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="text-xs font-semibold">
                      {row.remainingBalanceCentavos <= 0 ? (
                        <span className="text-emerald-700 text-xs font-bold inline-flex items-center gap-1">
                          <Check size={13} /> Balanced Sunk
                        </span>
                      ) : (
                        <span className="text-amber-800 text-xs font-bold">
                          Remaining: {formatPHPFromCentavos(row.remainingBalanceCentavos)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {row.payments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setViewingMemberPayments(row.member)}
                          className="py-1.5 px-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 inline-flex items-center gap-1 cursor-pointer active:scale-95"
                          title="View payment history and void / reset payments"
                        >
                          <History size={12} className="text-slate-500" />
                          <span>History</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActivePaymentMember(row.member);
                          setPayAmount(
                            row.remainingBalanceCentavos > 0
                              ? (row.remainingBalanceCentavos / 100).toString()
                              : '40'
                          );
                        }}
                        className="py-1.5 px-3 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-colors shadow-2xs cursor-pointer active:scale-95"
                      >
                        + Record Pay
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop / Tablet Table View (>=768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[0.68rem] tracking-wider">
                <th className="p-3.5 pl-4">Member</th>
                <th className="p-3.5">Base</th>
                <th className="p-3.5">Carry</th>
                <th className="p-3.5">Total Due</th>
                <th className="p-3.5">Paid</th>
                <th className="p-3.5">Remaining</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    No members match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  return (
                    <tr key={row.member.id} className="hover:bg-slate-50/75 transition-colors">
                      {/* Member Info */}
                      <td className="p-3 pl-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            src={row.member.avatar_url}
                            name={row.member.full_name}
                            size={32}
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 block truncate max-w-[150px]">
                                {row.member.full_name}
                              </span>
                              {row.attStatus === 'present' && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                  ● Present
                                </span>
                              )}
                              {row.attStatus === 'late' && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-amber-100 text-amber-900 shrink-0">
                                  ⏱ Late
                                </span>
                              )}
                              {row.attStatus === 'absent' && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-slate-100 text-slate-500 shrink-0">
                                  ✕ Absent
                                </span>
                              )}
                              {row.attStatus === 'excused' && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-purple-100 text-purple-800 shrink-0">
                                  ~ Excused
                                </span>
                              )}
                            </div>
                            <span className="text-[0.68rem] text-slate-400">
                              {row.member.voice_part || 'Member'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Base Target */}
                      <td className="p-3 font-mono text-slate-600">
                        {formatPHPFromCentavos(row.baseAmountCentavos)}
                      </td>

                      {/* Carry */}
                      <td className="p-3 font-mono">
                        {row.carriedBalanceCentavos === 0 ? (
                          <span className="text-slate-400">₱0.00</span>
                        ) : row.carriedBalanceCentavos > 0 ? (
                          <span className="text-amber-700 font-bold">
                            +{formatPHPFromCentavos(row.carriedBalanceCentavos)}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold">
                            {formatPHPFromCentavos(row.carriedBalanceCentavos)} (Credit)
                          </span>
                        )}
                      </td>

                      {/* Effective Due */}
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {formatPHPFromCentavos(row.effectiveDueCentavos)}
                      </td>

                      {/* Paid */}
                      <td className="p-3 font-mono text-primary font-bold">
                        {row.payments.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setViewingMemberPayments(row.member)}
                            className="font-mono text-primary font-bold hover:underline inline-flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 text-xs"
                            title="Click to view payments & void / reset to ₱0"
                          >
                            <span>{formatPHPFromCentavos(row.totalPaidCentavos)}</span>
                            <span className="text-[0.62rem] font-bold bg-primary/10 text-primary px-1 py-0.2 rounded">
                              ({row.payments.length})
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-400">₱0.00</span>
                        )}
                      </td>

                      {/* Remaining */}
                      <td className="p-3 font-mono">
                        {row.remainingBalanceCentavos <= 0 ? (
                          <span className="text-emerald-700 font-bold">₱0.00</span>
                        ) : (
                          <span className="text-amber-800 font-bold">
                            {formatPHPFromCentavos(row.remainingBalanceCentavos)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        {row.isExempt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Exempt
                          </span>
                        ) : row.isFullyPaid ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Paid ✓
                          </span>
                        ) : row.totalPaidCentavos > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-red-50 text-red-800 border border-red-200">
                            Unpaid
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.payments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setViewingMemberPayments(row.member)}
                              className="py-1 px-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200 cursor-pointer inline-flex items-center gap-1"
                              title="View payments and void / reset"
                            >
                              <History size={11} className="text-slate-500" />
                              <span>History</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setActivePaymentMember(row.member);
                              setPayAmount(
                                row.remainingBalanceCentavos > 0
                                  ? (row.remainingBalanceCentavos / 100).toString()
                                  : '40'
                              );
                            }}
                            className="py-1 px-2.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors border border-primary/20 cursor-pointer whitespace-nowrap"
                          >
                            + Record Pay
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History & Voiding Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 m-0">
            Payment Transactions for {formatPeriodLabel(selectedPeriodLabel)}
          </h3>
          <span className="text-[0.68rem] text-slate-400 font-semibold">
            {periodPayments.length} recorded
          </span>
        </div>

        {periodPayments.length === 0 ? (
          <p className="text-xs text-slate-400 m-0 py-4 text-center">
            No payment transactions recorded for this period yet.
          </p>
        ) : (
          <>
            {/* Mobile View (<768px) for Transactions */}
            <div className="block md:hidden divide-y divide-slate-100">
              {periodPayments.map((pmt) => {
                const period = effectivePeriods.find((p) => p.id === pmt.dues_period_id);
                const member = members.find((m) => m.id === period?.member_id);
                const isVoid = !!pmt.voided_at;

                return (
                  <div
                    key={pmt.id}
                    className={`py-3 flex items-center justify-between gap-2 ${
                      isVoid ? 'opacity-50 line-through' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 text-xs truncate">
                          {member?.full_name || 'Member'}
                        </span>
                        <span className="text-[0.65rem] text-slate-400 uppercase font-semibold">
                          • {formatPaymentMethod(pmt.method)}
                        </span>
                      </div>
                      <div className="text-[0.68rem] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{new Date(pmt.paid_at).toLocaleDateString('en-PH')}</span>
                        {pmt.reference && <span>Ref: {pmt.reference}</span>}
                        {isVoid && (
                          <span className="text-red-600 font-bold">Voided ({pmt.voided_reason})</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-primary text-xs sm:text-sm">
                        {formatPHPFromCentavos(pmt.amount_centavos)}
                      </span>
                      {!isVoid && (
                        <button
                          type="button"
                          onClick={() => {
                            setVoidPaymentId(pmt.id);
                            setVoidReason('');
                          }}
                          className="text-[0.68rem] font-bold text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded-lg border border-red-200 cursor-pointer"
                        >
                          Void
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>=768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[0.68rem] text-slate-400 uppercase font-bold">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Member</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {periodPayments.map((pmt) => {
                    const period = effectivePeriods.find((p) => p.id === pmt.dues_period_id);
                    const member = members.find((m) => m.id === period?.member_id);
                    const isVoid = !!pmt.voided_at;

                    return (
                      <tr
                        key={pmt.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isVoid ? 'opacity-50 line-through bg-slate-50/50' : ''
                        }`}
                      >
                        <td className="py-2 text-slate-500">
                          {new Date(pmt.paid_at).toLocaleDateString('en-PH')}
                        </td>
                        <td className="py-2 font-bold text-slate-800">
                          {member?.full_name || 'Member'}
                        </td>
                        <td className="py-2 font-mono font-bold text-primary">
                          {formatPHPFromCentavos(pmt.amount_centavos)}
                        </td>
                        <td className="py-2 text-slate-600">
                          {formatPaymentMethod(pmt.method)}
                        </td>
                        <td className="py-2 text-slate-400 font-mono">
                          {pmt.reference || '—'}
                        </td>
                        <td className="py-2">
                          {isVoid ? (
                            <span
                              className="text-[0.65rem] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200"
                              title={`Reason: ${pmt.voided_reason}`}
                            >
                              Voided ({pmt.voided_reason})
                            </span>
                          ) : (
                            <span className="text-[0.65rem] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              Valid
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          {!isVoid && (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidPaymentId(pmt.id);
                                setVoidReason('');
                              }}
                              className="text-[0.7rem] font-bold text-red-600 hover:text-red-800 bg-transparent border-0 cursor-pointer"
                            >
                              Void
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      {activePaymentMember && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
          onClick={() => setActivePaymentMember(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 m-0">Record Dues Payment</h3>
                <p className="text-xs text-slate-500 m-0 mt-0.5">
                  Member: <strong className="text-primary">{activePaymentMember.full_name}</strong> ({formatPeriodLabel(selectedPeriodLabel)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActivePaymentMember(null)}
                className="text-slate-400 hover:text-slate-700 bg-transparent border-0 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} className="flex flex-col gap-3 text-xs sm:text-sm">
              <div>
                <label className="input-label" htmlFor="payAmt">
                  Payment Amount (₱) *
                </label>
                <input
                  id="payAmt"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="input-field text-base font-bold font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="input-label" htmlFor="payMeth">
                  Payment Method *
                </label>
                <select
                  id="payMeth"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="input-field cursor-pointer"
                >
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="input-label" htmlFor="payRef">
                  Reference / Receipt No. (Optional)
                </label>
                <input
                  id="payRef"
                  type="text"
                  placeholder="e.g. GCash Ref # 12345"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setActivePaymentMember(null)}
                  disabled={recordingLoading}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingLoading}
                  className="btn btn-primary !py-2 !px-5 text-xs font-bold"
                >
                  {recordingLoading ? 'Recording…' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Payments Breakdown & Void Modal */}
      {viewingMemberPayments && (() => {
        const memberPeriod = effectivePeriods.find(
          (p) => p.member_id === viewingMemberPayments.id && p.period_label === selectedPeriodLabel
        );
        const memberPayments = effectivePayments.filter(
          (pmt) => pmt.dues_period_id === memberPeriod?.id
        );
        const nonVoidedTotal = memberPayments
          .filter((p) => !p.voided_at)
          .reduce((sum, p) => sum + p.amount_centavos, 0);

        return (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
            onClick={() => setViewingMemberPayments(null)}
          >
            <div
              className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={viewingMemberPayments.avatar_url}
                    name={viewingMemberPayments.full_name}
                    size={38}
                  />
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0">
                      Payment History & Void Ledger
                    </h3>
                    <p className="text-xs text-slate-500 m-0 mt-0.5">
                      <strong className="text-slate-800">{viewingMemberPayments.full_name}</strong> •{' '}
                      {formatPeriodLabel(selectedPeriodLabel)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingMemberPayments(null)}
                  className="text-slate-400 hover:text-slate-700 bg-transparent border-0 cursor-pointer text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Status Banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block">Total Active Payments:</span>
                  <span className="text-base font-black text-primary font-mono">
                    {formatPHPFromCentavos(nonVoidedTotal)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 font-semibold block">Transactions:</span>
                  <span className="font-bold text-slate-700">{memberPayments.length} recorded</span>
                </div>
              </div>

              {/* Payments List */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 m-0">
                  Itemized Payments
                </h4>

                {memberPayments.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                    No payment records found for {formatPeriodLabel(selectedPeriodLabel)}.
                  </div>
                ) : (
                  memberPayments.map((pmt) => {
                    const isVoid = !!pmt.voided_at;
                    return (
                      <div
                        key={pmt.id}
                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                          isVoid
                            ? 'bg-slate-50/70 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-xs sm:text-sm font-mono font-bold ${
                                isVoid ? 'line-through text-slate-400' : 'text-primary'
                              }`}
                            >
                              {formatPHPFromCentavos(pmt.amount_centavos)}
                            </span>
                            <span className="text-[0.68rem] text-slate-500 font-semibold uppercase bg-slate-100 px-1.5 py-0.2 rounded">
                              {formatPaymentMethod(pmt.method)}
                            </span>
                            {isVoid ? (
                              <span className="text-[0.65rem] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                                Voided
                              </span>
                            ) : (
                              <span className="text-[0.65rem] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                                Confirmed
                              </span>
                            )}
                          </div>

                          <div className="text-[0.68rem] text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span>📅 {new Date(pmt.paid_at).toLocaleString('en-PH')}</span>
                            {pmt.reference && <span>• Ref: {pmt.reference}</span>}
                            {isVoid && pmt.voided_reason && (
                              <span className="text-red-600 font-medium block w-full mt-0.5">
                                Reason: &quot;{pmt.voided_reason}&quot;
                              </span>
                            )}
                          </div>
                        </div>

                        {!isVoid && (
                          <button
                            type="button"
                            onClick={() => {
                              setVoidPaymentId(pmt.id);
                              setVoidReason('');
                            }}
                            className="py-1.5 px-3 rounded-lg text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer shrink-0"
                            title="Void this payment and reset member balance to ₱0"
                          >
                            <Undo2 size={12} />
                            <span>Void / Reset</span>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setViewingMemberPayments(null)}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Void Confirmation Modal */}
      {voidPaymentId && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
          onClick={() => setVoidPaymentId(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-700 border-b border-slate-100 pb-3">
              <ShieldAlert size={20} />
              <h3 className="text-base font-bold m-0">Void Payment Transaction</h3>
            </div>

            <form onSubmit={handleConfirmVoid} className="flex flex-col gap-3 text-xs sm:text-sm">
              <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl text-xs text-red-900 leading-relaxed">
                <strong>Financial Reversal Notice:</strong> Voiding marks this transaction as invalid in the ledger, zeroes out the payment amount, and restores the member&apos;s remaining dues balance. For complete transparency, this action is permanently recorded in the audit log.
              </div>

              <div>
                <label className="input-label mb-1.5 block">
                  Quick Select Reason:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {VOID_PRESET_REASONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setVoidReason(preset)}
                      className={`text-[0.68rem] px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                        voidReason === preset
                          ? 'bg-red-600 text-white border-red-600 shadow-2xs scale-102'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <label className="input-label" htmlFor="voidReasonInput">
                  Specific Reason / Notes *
                </label>
                <textarea
                  id="voidReasonInput"
                  required
                  rows={2}
                  placeholder="e.g. Incorrect member encoded by mistake"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="input-field text-xs sm:text-sm"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVoidPaymentId(null)}
                  disabled={voidingLoading}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidingLoading || !voidReason.trim()}
                  className="btn !bg-red-600 hover:!bg-red-700 !text-white !py-2 !px-4 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Undo2 size={13} />
                  <span>{voidingLoading ? 'Voiding…' : 'Confirm Void & Reset'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
