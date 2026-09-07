'use client';

import React, { useState } from 'react';
import { FileText, Download, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { generateFinancialStatementPdf } from '@/lib/pdf-financial-report';
import {
  DuesPeriod,
  DuesPayment,
  Solicitation,
  SolicitationContribution,
  formatPHPFromCentavos,
  formatPeriodLabel,
} from '@/lib/financeUtils';
import { useToast } from '@/components/Toast';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface FinanceReportsTabProps {
  periods?: DuesPeriod[];
  payments?: DuesPayment[];
  solicitations?: Solicitation[];
  contributions?: SolicitationContribution[];
  members?: Profile[];
  currentUserProfile: Profile;
}

export const FinanceReportsTab: React.FC<FinanceReportsTabProps> = ({
  periods = [],
  payments = [],
  solicitations = [],
  contributions = [],
  members = [],
  currentUserProfile,
}) => {
  const { addToast } = useToast();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>(periods[0]?.id || 'all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Selected period or all periods
  const currentPeriod = periods.find((p) => p.id === selectedPeriodId);

  // Filter payments & contributions based on period
  const activePayments = payments.filter((p) => {
    if (p.voided_at) return false;
    if (selectedPeriodId === 'all') return true;
    return p.dues_period_id === selectedPeriodId;
  });

  const activeContributions = contributions.filter((c) => {
    if (c.voided_at) return false;
    if (selectedPeriodId === 'all') return true;
    if (!currentPeriod) return true;
    // Check if within the month of the period
    return c.contributed_at && c.contributed_at.startsWith(currentPeriod.period_label);
  });

  // Calculate KPIs
  const totalSinkingFundCentavos = activePayments.reduce((acc, p) => acc + p.amount_centavos, 0);
  const totalSolicitationsCentavos = activeContributions.reduce((acc, c) => acc + c.amount_centavos, 0);
  const totalInflowCentavos = totalSinkingFundCentavos + totalSolicitationsCentavos;

  // Expected Target for the Period
  const activeMembersCount = members.filter((m) => !['super_admin'].includes(m.role)).length;
  const targetPerMemberCentavos = currentPeriod ? currentPeriod.base_amount_centavos : 4000;
  const expectedTotalTargetCentavos = currentPeriod
    ? activeMembersCount * targetPerMemberCentavos
    : periods.length * activeMembersCount * 4000;

  const collectionRate = expectedTotalTargetCentavos > 0
    ? Math.min(100, Math.round((totalSinkingFundCentavos / expectedTotalTargetCentavos) * 100))
    : 0;

  // Member map for quick lookup
  const memberMap = new Map<string, Profile>();
  members.forEach((m) => memberMap.set(m.id, m));

  const periodMap = new Map<string, DuesPeriod>();
  periods.forEach((p) => periodMap.set(p.id, p));

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const periodLabel = currentPeriod
        ? formatPeriodLabel(currentPeriod.period_label)
        : 'All Time Comprehensive';
      const periodRange = currentPeriod
        ? `Month of ${formatPeriodLabel(currentPeriod.period_label)}`
        : 'All Active Records';

      const periodPaymentMap = new Map<string, DuesPayment[]>();
      payments.forEach((pmt) => {
        const arr = periodPaymentMap.get(pmt.dues_period_id) || [];
        arr.push(pmt);
        periodPaymentMap.set(pmt.dues_period_id, arr);
      });

      const relevantPeriods = currentPeriod ? [currentPeriod] : periods;

      const pdfBytes = await generateFinancialStatementPdf({
        organizationName: 'San Jose Parish Grand Choir',
        reportTitle: 'Financial Audit & Sinking Fund Statement',
        dateRangeLabel: periodRange,
        generatedBy: currentUserProfile?.full_name || 'Choir Treasurer',
        duesPeriods: relevantPeriods.map((p) => {
          const member = memberMap.get(p.member_id);
          const pPayments = periodPaymentMap.get(p.id) || [];
          const paid = pPayments.filter((pmt) => !pmt.voided_at).reduce((s, pmt) => s + pmt.amount_centavos, 0);
          const target = (p.base_amount_centavos || 4000) + (p.carried_balance_centavos || 0);
          const effectiveDue = p.is_exempt ? 0 : Math.max(0, target);
          return {
            period_label: p.period_label,
            member_name: member?.full_name || 'Member',
            voice_part: (member as any)?.voice_part || null,
            effective_due_centavos: effectiveDue,
            total_paid_centavos: paid,
            remaining_balance_centavos: Math.max(0, effectiveDue - paid),
            is_fully_paid: !!p.is_exempt || paid >= effectiveDue,
          };
        }),
        payments: activePayments.map((p) => {
          const pPeriod = periodMap.get(p.dues_period_id);
          const pMember = pPeriod ? memberMap.get(pPeriod.member_id) : null;
          return {
            paid_at: p.paid_at,
            member_name: pMember?.full_name || 'Choir Member',
            amount_centavos: p.amount_centavos,
            method: p.method,
            reference: p.reference,
            period_label: pPeriod?.period_label || 'Current',
            is_voided: !!p.voided_at,
          };
        }),
        contributions: activeContributions.map((c) => {
          const cMember = c.member_id ? memberMap.get(c.member_id) : null;
          const sol = solicitations.find((s) => s.id === c.solicitation_id);
          return {
            contributed_at: c.contributed_at,
            campaign_title: sol?.title || 'Special Campaign',
            contributor_name: c.contributor_name || cMember?.full_name || 'Anonymous Donor',
            amount_centavos: c.amount_centavos,
            method: c.method,
            is_voided: !!c.voided_at,
          };
        }),
      });

      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial_statement_${periodLabel.toLowerCase().replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'PDF Report Generated',
        message: `Official Statement for ${periodLabel} has been generated and downloaded.`,
      });
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      addToast({
        type: 'error',
        title: 'PDF Generation Error',
        message: err.message || 'Unable to build financial statement PDF.',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportCsv = (type: 'dues' | 'solicitations') => {
    if (type === 'dues') {
      const headers = ['Payment ID', 'Date', 'Member Name', 'Period', 'Amount (PHP)', 'Method', 'Reference Number'];
      const rows = activePayments.map((p) => {
        const pPeriod = periodMap.get(p.dues_period_id);
        const pMember = pPeriod ? memberMap.get(pPeriod.member_id) : null;
        return [
          p.id,
          p.paid_at,
          `"${pMember?.full_name || 'Member'}"`,
          `"${pPeriod?.period_label || ''}"`,
          (p.amount_centavos / 100).toFixed(2),
          p.method,
          `"${p.reference || ''}"`,
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `SinkingFund_Ledger_${selectedPeriodId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      const headers = ['Contribution ID', 'Date', 'Campaign', 'Donor Name', 'Is External', 'Amount (PHP)', 'Method', 'Reference Number'];
      const rows = activeContributions.map((c) => {
        const cMember = c.member_id ? memberMap.get(c.member_id) : null;
        const sol = solicitations.find((s) => s.id === c.solicitation_id);
        return [
          c.id,
          c.contributed_at,
          `"${sol?.title || 'Campaign'}"`,
          `"${c.contributor_name || cMember?.full_name || 'Anonymous'}"`,
          c.contributor_type === 'external' ? 'Yes' : 'No',
          (c.amount_centavos / 100).toFixed(2),
          c.method,
          `"${c.reference || ''}"`,
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Solicitations_Ledger_${selectedPeriodId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    addToast({
      type: 'info',
      title: 'CSV Exported',
      message: `Downloaded ${type === 'dues' ? 'Sinking Fund' : 'Solicitations'} ledger records.`,
    });
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header & Period Scope */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 m-0">
            <FileText className="text-primary shrink-0" size={20} />
            Official Financial Statement & Reports
          </h3>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            Generate formal transparency statements, audit-ready summaries, and downloadable PDF reports.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full md:w-auto">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 flex-1 sm:flex-none">
            <Calendar size={15} className="text-slate-400 shrink-0" />
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="bg-transparent text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none cursor-pointer w-full"
            >
              <option value="all">All Periods Combined</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPeriodLabel(p.period_label)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="btn btn-primary !py-2 !px-4 text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-2xs shrink-0 flex-1 sm:flex-none"
          >
            <Download size={15} />
            {isGeneratingPdf ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs border-l-4 border-l-emerald-500 flex flex-col justify-between">
          <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Sinking Fund Inflow</span>
          <div className="mt-1.5">
            <div className="text-lg sm:text-2xl font-black text-emerald-600">
              {formatPHPFromCentavos(totalSinkingFundCentavos)}
            </div>
            <span className="text-[0.68rem] text-slate-400">
              {activePayments.length} Sunday payments
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs border-l-4 border-l-purple-500 flex flex-col justify-between">
          <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Solicitations</span>
          <div className="mt-1.5">
            <div className="text-lg sm:text-2xl font-black text-purple-600">
              {formatPHPFromCentavos(totalSolicitationsCentavos)}
            </div>
            <span className="text-[0.68rem] text-slate-400">
              {activeContributions.length} contributions
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs border-l-4 border-l-blue-500 flex flex-col justify-between">
          <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Total Net Inflow</span>
          <div className="mt-1.5">
            <div className="text-lg sm:text-2xl font-black text-blue-600">
              {formatPHPFromCentavos(totalInflowCentavos)}
            </div>
            <span className="text-[0.68rem] text-slate-400">
              Combined funds
            </span>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs border-l-4 border-l-amber-500 flex flex-col justify-between">
          <span className="text-[0.65rem] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Completion</span>
          <div className="mt-1.5">
            <div className="text-lg sm:text-2xl font-black text-amber-600">
              {collectionRate}%
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-amber-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Ledger Preview & CSV Exports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sinking Fund Breakdown */}
        <div className="glass-container p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground text-base flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-500" />
              Sinking Fund Transactions ({activePayments.length})
            </h4>
            <button
              onClick={() => handleExportCsv('dues')}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            {activePayments.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No Sinking Fund payments recorded for this scope.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-glass-border text-xs text-muted">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Member</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border/40">
                  {activePayments.slice(0, 15).map((p) => {
                    const pPeriod = periodMap.get(p.dues_period_id);
                    const pMember = pPeriod ? memberMap.get(pPeriod.member_id) : null;
                    return (
                      <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-2.5 text-xs text-muted">{new Date(p.paid_at).toLocaleDateString()}</td>
                        <td className="py-2.5 font-medium text-foreground">{pMember?.full_name || 'Member'}</td>
                        <td className="py-2.5 text-xs uppercase text-muted">{p.method}</td>
                        <td className="py-2.5 text-right font-semibold text-emerald-600">
                          {formatPHPFromCentavos(p.amount_centavos)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Special Campaigns Breakdown */}
        <div className="glass-container p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-foreground text-base flex items-center gap-2">
              <Sparkles size={18} className="text-purple-500" />
              Solicitation Contributions ({activeContributions.length})
            </h4>
            <button
              onClick={() => handleExportCsv('solicitations')}
              className="text-xs text-purple-600 hover:underline font-semibold flex items-center gap-1"
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            {activeContributions.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No solicitation contributions recorded for this scope.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-glass-border text-xs text-muted">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Campaign</th>
                    <th className="pb-2">Donor</th>
                    <th className="pb-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-glass-border/40">
                  {activeContributions.slice(0, 15).map((c) => {
                    const cMember = c.member_id ? memberMap.get(c.member_id) : null;
                    const sol = solicitations.find((s) => s.id === c.solicitation_id);
                    return (
                      <tr key={c.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="py-2.5 text-xs text-muted">{new Date(c.contributed_at).toLocaleDateString()}</td>
                        <td className="py-2.5 text-xs text-foreground truncate max-w-[120px]">
                          {sol?.title || 'Campaign'}
                        </td>
                        <td className="py-2.5 font-medium text-foreground">
                          {c.contributor_name || cMember?.full_name || 'Donor'}
                          {c.contributor_type === 'external' && (
                            <span className="ml-1 text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full">
                              Ext
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-purple-600">
                          {formatPHPFromCentavos(c.amount_centavos)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
