import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getProfile } from '@/lib/supabase/user';
import { Navbar } from '@/components/Navbar';
import {
  DollarSign,
  PiggyBank,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  History,
  Info,
  ArrowRight,
} from 'lucide-react';
import {
  formatPHPFromCentavos,
  formatPeriodLabel,
  calculatePeriodSummary,
  getCurrentPeriodLabel,
} from '@/lib/financeUtils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Sinking Fund & Dues — Choir Collective',
  description: 'View your Sinking Fund monthly dues, payment history, and special campaign contributions.',
};

const DuesPage = async () => {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  if (['pending', 'rejected'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch current period, member's periods, payments, and campaign contributions
  const [
    { data: memberPeriods },
    { data: activeSolicitations },
    { data: contributions },
  ] = await Promise.all([
    supabase
      .from('dues_periods')
      .select('*, payments:dues_payments(*)')
      .eq('member_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitations')
      .select('id, title, target_amount_centavos, end_date, status')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('solicitations_contributions')
      .select('*, solicitation:solicitations(title)')
      .eq('member_id', profile.id)
      .order('contributed_at', { ascending: false }),
  ]);

  const allPeriods = memberPeriods || [];
  const currentPeriodLabel = getCurrentPeriodLabel();

  // Find active period for this month or create a virtual summary
  const currentPeriod = allPeriods.find((p) => p.period_label === currentPeriodLabel) || allPeriods[0];
  const currentPayments = currentPeriod?.payments || [];

  const isMemberExempt = !!(currentPeriod?.is_exempt || (profile as any)?.is_dues_exempt);

  const periodSummary = currentPeriod
    ? calculatePeriodSummary(currentPeriod, currentPayments)
    : {
        period_label: currentPeriodLabel,
        base_amount_centavos: isMemberExempt ? 0 : 4000,
        carried_balance_centavos: 0,
        effective_due_centavos: isMemberExempt ? 0 : 4000,
        excess_credit_centavos: 0,
        total_paid_centavos: 0,
        remaining_balance_centavos: isMemberExempt ? 0 : 4000,
        is_fully_paid: isMemberExempt,
        percentage_paid: isMemberExempt ? 100 : 0,
      };

  // Flatten all payments across all periods for this member
  const allPayments: any[] = [];
  allPeriods.forEach((p) => {
    (p.payments || []).forEach((pmt: any) => {
      allPayments.push({
        ...pmt,
        period_label: p.period_label,
      });
    });
  });
  allPayments.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

  const allContributions = contributions || [];

  // Lifetime metrics
  const lifetimeDuesCentavos = allPayments
    .filter((p) => !p.voided_at)
    .reduce((acc, p) => acc + p.amount_centavos, 0);

  const lifetimeSolicitationsCentavos = allContributions
    .filter((c) => !c.voided_at)
    .reduce((acc, c) => acc + c.amount_centavos, 0);

  return (
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={profile} />

      <main className="flex-1 py-4 sm:py-8 px-3 sm:px-6 max-w-[1000px] mx-auto w-full pb-28 sm:pb-16">
        {/* Page Header */}
        <div className="mb-5 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-black text-primary flex items-center gap-2">
              <PiggyBank size={28} className="text-primary shrink-0" />
              My Sinking Fund & Dues
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Track your monthly sinking fund fulfillment and choir fundraising contributions, {profile.full_name}.
            </p>
          </div>

          {['super_admin', 'director', 'treasurer'].includes(profile.role) && (
            <Link
              href="/admin/finances"
              className="btn btn-secondary !py-2 !px-3.5 text-xs font-bold inline-flex items-center gap-1.5 self-start sm:self-auto shadow-2xs"
            >
              Treasurer Portal <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {/* Current Month Banner Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-7 mb-6 sm:mb-8 border border-primary/20 shadow-lg shadow-primary/5 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5 sm:gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[0.68rem] sm:text-xs font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  {formatPeriodLabel(periodSummary.period_label)}
                </span>
                {isMemberExempt ? (
                  <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full">
                    Dues Exempt
                  </span>
                ) : periodSummary.is_fully_paid ? (
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={13} /> Target Fulfilled
                  </span>
                ) : (
                  <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle size={13} /> In Progress
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Monthly Sinking Fund Progress
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Standard monthly contribution is ₱40.00 (collected weekly during Sunday Mass).
              </p>

              {/* Breakdown detail */}
              <div className="mt-3 flex flex-wrap gap-2.5 sm:gap-4 text-xs text-slate-600">
                <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  Base: <strong>{formatPHPFromCentavos(periodSummary.base_amount_centavos)}</strong>
                </span>
                {periodSummary.carried_balance_centavos !== 0 && (
                  <span className={`px-2.5 py-1 rounded-lg border ${periodSummary.carried_balance_centavos > 0 ? 'bg-amber-50 border-amber-200 text-amber-800 font-semibold' : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'}`}>
                    {periodSummary.carried_balance_centavos > 0 ? '+ Carryover: ' : '- Credit: '}
                    <strong>{formatPHPFromCentavos(Math.abs(periodSummary.carried_balance_centavos))}</strong>
                  </span>
                )}
                <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                  Goal: <strong>{formatPHPFromCentavos(periodSummary.effective_due_centavos)}</strong>
                </span>
              </div>
            </div>

            {/* Numbers & Progress Box */}
            <div className="bg-slate-50 border border-slate-200/80 p-4 sm:p-5 rounded-2xl w-full md:w-auto md:min-w-[220px] text-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Total Paid This Month</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                {formatPHPFromCentavos(periodSummary.total_paid_centavos)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Target: {formatPHPFromCentavos(periodSummary.effective_due_centavos)}
              </div>
              
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mt-2.5">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${periodSummary.percentage_paid}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-slate-500 mt-1.5 block">
                {periodSummary.percentage_paid}% completed
              </span>
            </div>
          </div>
        </div>

        {/* 3 Overview KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-5 mb-6 sm:mb-8">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[0.68rem] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Lifetime Sinking Fund</span>
              <PiggyBank size={18} className="text-primary" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-bold text-slate-900">
                {formatPHPFromCentavos(lifetimeDuesCentavos)}
              </div>
              <span className="text-[0.68rem] text-slate-400">Personal total sinking fund deposits</span>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[0.68rem] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Campaign Contributions</span>
              <Sparkles size={18} className="text-purple-600" />
            </div>
            <div className="mt-2.5">
              <div className="text-xl sm:text-2xl font-bold text-purple-600">
                {formatPHPFromCentavos(lifetimeSolicitationsCentavos)}
              </div>
              <span className="text-[0.68rem] text-slate-400">Special solicitations & fundraising</span>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[0.68rem] sm:text-xs font-bold uppercase tracking-wider text-slate-500">Current Balance Status</span>
              <DollarSign size={18} className="text-emerald-600" />
            </div>
            <div className="mt-2.5">
              <div className={`text-xl sm:text-2xl font-bold ${periodSummary.remaining_balance_centavos > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {periodSummary.remaining_balance_centavos > 0
                  ? `${formatPHPFromCentavos(periodSummary.remaining_balance_centavos)} Due`
                  : 'Fully Settled ✓'}
              </div>
              <span className="text-[0.68rem] text-slate-400">
                {periodSummary.remaining_balance_centavos > 0
                  ? 'Remaining target to deposit'
                  : 'Thank you for your active support!'}
              </span>
            </div>
          </div>
        </div>

        {/* Active Campaigns Teaser */}
        {(activeSolicitations || []).length > 0 && (
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl mb-6 sm:mb-8 border border-purple-200 shadow-2xs border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-600" />
                  Active Fundraising Campaigns
                </h3>
                <p className="text-xs text-slate-500">Support special choir projects, uniforms, and equipment.</p>
              </div>
              <Link href="/solicitations" className="text-xs text-primary font-bold hover:underline">
                View All →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(activeSolicitations || []).map((camp) => (
                <Link
                  key={camp.id}
                  href={`/solicitations/${camp.id}`}
                  className="p-3.5 rounded-xl bg-purple-50/40 hover:bg-purple-50/80 border border-purple-100 transition-all block group"
                >
                  <strong className="block text-xs sm:text-sm font-bold text-slate-900 group-hover:text-primary transition-colors truncate">
                    {camp.title}
                  </strong>
                  <span className="text-xs text-slate-500 block mt-1">
                    Goal: {formatPHPFromCentavos(camp.target_amount_centavos)}
                  </span>
                  {camp.end_date && (
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Deadline: {new Date(camp.end_date).toLocaleDateString()}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Payment Ledgers Tabs / Sections */}
        <div className="flex flex-col gap-4 sm:gap-6">
          {/* Section 1: Sinking Fund Payments */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
              <History size={18} className="text-primary" />
              Sinking Fund Payment History ({allPayments.length})
            </h3>

            {allPayments.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <PiggyBank size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs sm:text-sm">No Sinking Fund payments recorded yet.</p>
                <p className="text-[11px] mt-1">Payments recorded during Sunday Mass will appear here automatically.</p>
              </div>
            ) : (
              <>
                {/* Mobile View (<768px) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {allPayments.map((p) => (
                    <div
                      key={p.id}
                      className={`py-3 flex items-center justify-between gap-2 ${
                        p.voided_at ? 'opacity-60 bg-slate-50/70 p-2.5 rounded-xl border border-dashed border-slate-200' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`font-bold text-xs ${p.voided_at ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                            {formatPeriodLabel(p.period_label) || 'Dues'}
                          </span>
                          <span className="text-[0.62rem] text-slate-400 uppercase font-semibold">
                            • {p.method}
                          </span>
                        </div>
                        <div className="text-[0.68rem] text-slate-400 mt-0.5">
                          {new Date(p.paid_at).toLocaleDateString()}
                          {p.reference && ` • Ref: ${p.reference}`}
                        </div>
                        {p.voided_at && p.voided_reason && (
                          <div className="text-[0.65rem] text-red-600 font-medium mt-0.5">
                            Void Reason: &quot;{p.voided_reason}&quot;
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`font-mono font-bold text-xs sm:text-sm ${p.voided_at ? 'line-through text-slate-400' : 'text-emerald-600'}`}>
                          {formatPHPFromCentavos(p.amount_centavos)}
                        </div>
                        <span
                          className={`text-[0.62rem] font-bold px-1.5 py-0.2 rounded ${
                            p.voided_at
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {p.voided_at ? 'Voided' : 'Confirmed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>=768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[0.68rem] text-slate-400 uppercase font-bold">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Period</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Method</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Ref # / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {allPayments.map((p) => (
                        <tr key={p.id} className={p.voided_at ? 'opacity-60 bg-slate-50/50' : 'hover:bg-slate-50'}>
                          <td className="py-2.5 text-slate-500">{new Date(p.paid_at).toLocaleDateString()}</td>
                          <td className={`py-2.5 font-bold ${p.voided_at ? 'line-through text-slate-400' : 'text-slate-900'}`}>{formatPeriodLabel(p.period_label) || '—'}</td>
                          <td className={`py-2.5 font-mono font-bold ${p.voided_at ? 'line-through text-slate-400' : 'text-emerald-600'}`}>{formatPHPFromCentavos(p.amount_centavos)}</td>
                          <td className="py-2.5 uppercase text-slate-500">{p.method}</td>
                          <td className="py-2.5">
                            {p.voided_at ? (
                              <span className="badge badge-rejected !bg-red-50 !text-red-700 !border-red-200" title={`Voided: ${p.voided_reason || 'Reversed'}`}>
                                Voided
                              </span>
                            ) : (
                              <span className="badge badge-approved">Confirmed</span>
                            )}
                          </td>
                          <td className="py-2.5 text-slate-400 font-mono max-w-[200px] truncate">
                            {p.voided_at && p.voided_reason ? (
                              <span className="text-red-600 font-sans font-medium text-[0.7rem]">
                                Reason: {p.voided_reason}
                              </span>
                            ) : p.reference ? (
                              `Ref: ${p.reference}`
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Section 2: Special Campaign Contributions */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              Special Campaign Contributions ({allContributions.length})
            </h3>

            {allContributions.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <p className="text-xs sm:text-sm">No campaign contributions recorded yet.</p>
              </div>
            ) : (
              <>
                {/* Mobile View (<768px) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {allContributions.map((c) => (
                    <div
                      key={c.id}
                      className={`py-3 flex items-center justify-between gap-2 ${
                        c.voided_at ? 'opacity-50 line-through' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-xs truncate block">
                          {c.solicitation?.title || 'Special Solicitation'}
                        </span>
                        <div className="text-[0.68rem] text-slate-400 mt-0.5">
                          {new Date(c.contributed_at).toLocaleDateString()} • {c.method}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-purple-600 text-xs sm:text-sm">
                          {formatPHPFromCentavos(c.amount_centavos)}
                        </div>
                        <span
                          className={`text-[0.62rem] font-bold px-1.5 py-0.2 rounded ${
                            c.voided_at
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {c.voided_at ? 'Voided' : 'Confirmed'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View (>=768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[0.68rem] text-slate-400 uppercase font-bold">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Campaign</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Method</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {allContributions.map((c) => (
                        <tr key={c.id} className={c.voided_at ? 'opacity-50 line-through' : 'hover:bg-slate-50'}>
                          <td className="py-2.5 text-slate-500">{new Date(c.contributed_at).toLocaleDateString()}</td>
                          <td className="py-2.5 font-bold text-slate-900">{c.solicitation?.title || 'Special Solicitation'}</td>
                          <td className="py-2.5 font-mono font-bold text-purple-600">{formatPHPFromCentavos(c.amount_centavos)}</td>
                          <td className="py-2.5 uppercase text-slate-500">{c.method}</td>
                          <td className="py-2.5">
                            {c.voided_at ? (
                              <span className="badge badge-rejected !bg-slate-200 !text-slate-600">Voided</span>
                            ) : (
                              <span className="badge badge-approved">Confirmed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Treasurer Payment Assistance Note */}
          <div className="alert alert-info flex items-start gap-3">
            <Info size={20} className="shrink-0 mt-0.5" />
            <div className="text-sm">
              <strong>Need to make or verify a payment?</strong> Sinking Fund dues are collected in cash every Sunday rehearsal and Mass by the Choir Treasurer. If paying via GCash or Bank Transfer, kindly send the proof of transaction to the Treasurer for prompt verification and ledger posting.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DuesPage;
