'use client';

import React, { useState, useMemo } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  User,
  Building,
  FileDown,
  ShieldAlert,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  formatPHPFromCentavos,
  pesosToCentavos,
  formatPaymentMethod,
  Solicitation,
  SolicitationContribution,
  PaymentMethod,
  ContributorType,
} from '@/lib/financeUtils';
import {
  createSolicitation,
  updateSolicitationStatus,
  recordSolicitationContribution,
  voidSolicitationContribution,
} from './actions';

interface MemberProfile {
  id: string;
  full_name: string;
  email: string;
  voice_part?: string | null;
}

interface SolicitationsManagerTabProps {
  members?: MemberProfile[];
  solicitations?: Solicitation[];
  contributions?: SolicitationContribution[];
  currentUserProfile?: any;
  onRefresh?: () => void;
}

export const SolicitationsManagerTab = ({
  members = [],
  solicitations = [],
  contributions = [],
  currentUserProfile,
  onRefresh,
}: SolicitationsManagerTabProps) => {
  const { addToast } = useToast();

  // Create Campaign Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [campaignTarget, setCampaignTarget] = useState('');
  const [campaignStartDate, setCampaignStartDate] = useState(
    new Date().toISOString().substring(0, 10)
  );
  const [campaignEndDate, setCampaignEndDate] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  // Record Contribution Modal State
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [selectedSolicitationId, setSelectedSolicitationId] = useState<string>(
    solicitations[0]?.id || ''
  );
  const [contributorType, setContributorType] = useState<ContributorType>('member');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [externalDonorName, setExternalDonorName] = useState('');
  const [contribAmount, setContribAmount] = useState('');
  const [contribMethod, setContribMethod] = useState<PaymentMethod>('cash');
  const [contribRef, setContribRef] = useState('');
  const [contribLoading, setContribLoading] = useState(false);

  // Void Contribution Modal State
  const [voidContribId, setVoidContribId] = useState<string | null>(null);
  const [voidContribReason, setVoidContribReason] = useState('');
  const [voidingLoading, setVoidingLoading] = useState(false);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'closed'>('ALL');
  const [selectedCampaignDetail, setSelectedCampaignDetail] = useState<string | null>(null);

  // Filtered Solicitations
  const filteredSolicitations = useMemo(() => {
    return solicitations.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      return true;
    });
  }, [solicitations, statusFilter]);

  // Handle Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignTitle.trim()) {
      addToast({ type: 'error', title: 'Title Required', message: 'Campaign title is required.' });
      return;
    }

    setCreatingLoading(true);
    const targetCentavos = campaignTarget ? pesosToCentavos(parseFloat(campaignTarget) || 0) : null;
    const res = await createSolicitation({
      title: campaignTitle.trim(),
      description: campaignDesc.trim() || null,
      targetAmountCentavos: targetCentavos,
      startDate: campaignStartDate,
      endDate: campaignEndDate || null,
    });
    setCreatingLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Creation Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Campaign Created!', message: `"${campaignTitle}" is now active.` });
      setShowCreateModal(false);
      setCampaignTitle('');
      setCampaignDesc('');
      setCampaignTarget('');
      setCampaignEndDate('');
      if (onRefresh) onRefresh();
    }
  };

  // Handle Close / Reopen Campaign
  const handleToggleStatus = async (solicitation: Solicitation) => {
    const nextStatus = solicitation.status === 'active' ? 'closed' : 'active';
    const confirmMsg = `Are you sure you want to mark "${solicitation.title}" as ${nextStatus}?`;
    if (!window.confirm(confirmMsg)) return;

    const res = await updateSolicitationStatus(solicitation.id, nextStatus);
    if (res?.error) {
      addToast({ type: 'error', title: 'Update Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: `Campaign is now ${nextStatus}.`,
      });
      if (onRefresh) onRefresh();
    }
  };

  // Handle Record Contribution
  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    const pesos = parseFloat(contribAmount);
    if (isNaN(pesos) || pesos <= 0) {
      addToast({ type: 'error', title: 'Invalid Amount', message: 'Please enter a valid amount.' });
      return;
    }

    if (!selectedSolicitationId) {
      addToast({ type: 'error', title: 'Campaign Required', message: 'Select an active campaign.' });
      return;
    }

    setContribLoading(true);
    const res = await recordSolicitationContribution({
      solicitationId: selectedSolicitationId,
      contributorType,
      memberId: contributorType === 'member' ? selectedMemberId : null,
      contributorName: contributorType === 'external' ? externalDonorName.trim() : null,
      amountCentavos: pesosToCentavos(pesos),
      method: contribMethod,
      reference: contribRef.trim() || null,
    });
    setContribLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Contribution Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: '✓ Contribution Recorded',
        message: `₱${pesos} logged successfully.`,
      });
      setShowContributionModal(false);
      setContribAmount('');
      setExternalDonorName('');
      setContribRef('');
      if (onRefresh) onRefresh();
    }
  };

  // Handle Void Contribution
  const handleConfirmVoidContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidContribId || !voidContribReason.trim()) return;

    setVoidingLoading(true);
    const res = await voidSolicitationContribution({
      contributionId: voidContribId,
      reason: voidContribReason.trim(),
    });
    setVoidingLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Void Failed', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Contribution Voided', message: 'The contribution was successfully voided.' });
      setVoidContribId(null);
      setVoidContribReason('');
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 m-0 flex items-center gap-2">
            <HeartHandshake size={18} className="text-primary shrink-0" />
            Special Solicitations &amp; Fundraising Campaigns
          </h3>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Manage designated choir projects, anniversary uniform funds, and external donor pledges.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => {
              if (solicitations.filter((s) => s.status === 'active').length === 0) {
                addToast({ type: 'warning', title: 'No Active Campaign', message: 'Create a campaign first.' });
                return;
              }
              setShowContributionModal(true);
            }}
            className="btn btn-primary !py-2 !px-3.5 text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs flex-1 sm:flex-none"
          >
            <DollarSign size={14} />
            <span>+ Log Contribution</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn btn-secondary !py-2 !px-3.5 text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-2xs flex-1 sm:flex-none"
          >
            <Plus size={14} />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {filteredSolicitations.length === 0 ? (
          <div className="col-span-full p-10 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs sm:text-sm">
            No solicitation campaigns created yet. Click &quot;New Campaign&quot; to begin.
          </div>
        ) : (
          filteredSolicitations.map((sol) => {
            const solContribs = contributions.filter(
              (c) => c.solicitation_id === sol.id && !c.voided_at
            );
            const totalRaised = solContribs.reduce((sum, c) => sum + c.amount_centavos, 0);
            const target = sol.target_amount_centavos;
            const progress = target ? Math.min(100, Math.round((totalRaised / target) * 100)) : null;

            return (
              <div
                key={sol.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[0.68rem] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        sol.status === 'active'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {sol.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(sol)}
                      className="text-[0.7rem] font-bold text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer"
                    >
                      {sol.status === 'active' ? 'Close Campaign' : 'Reopen'}
                    </button>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 m-0">{sol.title}</h4>
                  {sol.description && (
                    <p className="text-xs text-slate-500 m-0 mt-1 line-clamp-2 leading-relaxed">
                      {sol.description}
                    </p>
                  )}
                </div>

                {/* Progress Bar & Target */}
                <div>
                  <div className="flex items-baseline justify-between mb-1 text-xs">
                    <span className="font-extrabold text-primary text-sm sm:text-base">
                      {formatPHPFromCentavos(totalRaised)}
                    </span>
                    {target ? (
                      <span className="text-slate-500 font-semibold">
                        goal: {formatPHPFromCentavos(target)} ({progress}%)
                      </span>
                    ) : (
                      <span className="text-slate-400">No fixed target</span>
                    )}
                  </div>

                  {target && (
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[0.7rem] text-slate-400 mt-2">
                    <span>{solContribs.length} contribution(s)</span>
                    <span>Started {new Date(sol.start_date).toLocaleDateString('en-PH')}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Contributions Ledger Table & Mobile Feed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 sm:p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 m-0">
            Recent Solicitation Contributions
          </h3>
          <span className="text-[0.68rem] text-slate-400 font-semibold">
            {contributions.length} recorded
          </span>
        </div>

        {contributions.length === 0 ? (
          <p className="text-xs text-slate-400 m-0 py-6 text-center">
            No solicitation contributions recorded yet.
          </p>
        ) : (
          <>
            {/* Mobile View (<768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {contributions.map((c) => {
                const campaign = solicitations.find((s) => s.id === c.solicitation_id);
                const member = members.find((m) => m.id === c.member_id);
                const contributorDisplay =
                  c.contributor_type === 'member'
                    ? member?.full_name || 'Choir Member'
                    : c.contributor_name || 'External Donor';
                const isVoid = !!c.voided_at;

                return (
                  <div
                    key={c.id}
                    className={`py-3 flex items-center justify-between gap-2 ${
                      isVoid ? 'opacity-50 line-through' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs truncate">
                          {contributorDisplay}
                        </span>
                        <span
                          className={`text-[0.62rem] font-bold px-1.5 py-0.2 rounded border ${
                            c.contributor_type === 'member'
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}
                        >
                          {c.contributor_type}
                        </span>
                      </div>
                      <div className="text-[0.68rem] text-slate-500 mt-0.5 truncate">
                        {campaign?.title || 'Campaign'} • {formatPaymentMethod(c.method)}
                      </div>
                      <div className="text-[0.65rem] text-slate-400 mt-0.5">
                        {new Date(c.contributed_at).toLocaleDateString('en-PH')}
                        {c.reference && ` • Ref: ${c.reference}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-primary text-xs sm:text-sm">
                        {formatPHPFromCentavos(c.amount_centavos)}
                      </span>
                      {isVoid ? (
                        <span className="text-[0.65rem] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                          Voided
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setVoidContribId(c.id);
                            setVoidContribReason('');
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
                    <th className="pb-2">Campaign</th>
                    <th className="pb-2">Contributor</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Method</th>
                    <th className="pb-2">Reference</th>
                    <th className="pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {contributions.map((c) => {
                    const campaign = solicitations.find((s) => s.id === c.solicitation_id);
                    const member = members.find((m) => m.id === c.member_id);
                    const contributorDisplay =
                      c.contributor_type === 'member'
                        ? member?.full_name || 'Choir Member'
                        : c.contributor_name || 'External Donor';
                    const isVoid = !!c.voided_at;

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          isVoid ? 'opacity-50 line-through bg-slate-50/50' : ''
                        }`}
                      >
                        <td className="py-2 text-slate-500">
                          {new Date(c.contributed_at).toLocaleDateString('en-PH')}
                        </td>
                        <td className="py-2 font-bold text-slate-800 truncate max-w-[140px]">
                          {campaign?.title || 'Campaign'}
                        </td>
                        <td className="py-2 font-bold text-slate-900">
                          {contributorDisplay}
                        </td>
                        <td className="py-2">
                          <span
                            className={`text-[0.65rem] font-bold px-1.5 py-0.2 rounded border ${
                              c.contributor_type === 'member'
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-amber-50 text-amber-900 border-amber-200'
                            }`}
                          >
                            {c.contributor_type}
                          </span>
                        </td>
                        <td className="py-2 font-mono font-bold text-primary">
                          {formatPHPFromCentavos(c.amount_centavos)}
                        </td>
                        <td className="py-2 text-slate-600">
                          {formatPaymentMethod(c.method)}
                        </td>
                        <td className="py-2 text-slate-400 font-mono">
                          {c.reference || '—'}
                        </td>
                        <td className="py-2 text-right">
                          {isVoid ? (
                            <span
                              className="text-[0.65rem] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200"
                              title={`Reason: ${c.voided_reason}`}
                            >
                              Voided
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidContribId(c.id);
                                setVoidContribReason('');
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

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 m-0">Create Solicitation Campaign</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-transparent border-0 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="flex flex-col gap-3 text-xs sm:text-sm">
              <div>
                <label className="input-label" htmlFor="solTitle">
                  Campaign Title *
                </label>
                <input
                  id="solTitle"
                  type="text"
                  required
                  placeholder="e.g. Choir Anniversary Uniform Fund"
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label className="input-label" htmlFor="solDesc">
                  Description / Purpose (Optional)
                </label>
                <textarea
                  id="solDesc"
                  rows={2}
                  placeholder="Brief summary of what this fundraising campaign supports…"
                  value={campaignDesc}
                  onChange={(e) => setCampaignDesc(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="solTarget">
                  Fundraising Target Amount (₱) (Optional)
                </label>
                <input
                  id="solTarget"
                  type="number"
                  placeholder="e.g. 20000.00"
                  value={campaignTarget}
                  onChange={(e) => setCampaignTarget(e.target.value)}
                  className="input-field font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="input-label" htmlFor="solStart">
                    Start Date *
                  </label>
                  <input
                    id="solStart"
                    type="date"
                    required
                    value={campaignStartDate}
                    onChange={(e) => setCampaignStartDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="input-label" htmlFor="solEnd">
                    End Date (Optional)
                  </label>
                  <input
                    id="solEnd"
                    type="date"
                    value={campaignEndDate}
                    onChange={(e) => setCampaignEndDate(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creatingLoading}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingLoading || !campaignTitle.trim()}
                  className="btn btn-primary !py-2 !px-5 text-xs font-bold"
                >
                  {creatingLoading ? 'Creating…' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Contribution Modal */}
      {showContributionModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
          onClick={() => setShowContributionModal(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 m-0">Log Campaign Contribution</h3>
              <button
                type="button"
                onClick={() => setShowContributionModal(false)}
                className="text-slate-400 hover:text-slate-700 bg-transparent border-0 cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitContribution} className="flex flex-col gap-3 text-xs sm:text-sm">
              <div>
                <label className="input-label" htmlFor="contribCamp">
                  Campaign *
                </label>
                <select
                  id="contribCamp"
                  value={selectedSolicitationId}
                  onChange={(e) => setSelectedSolicitationId(e.target.value)}
                  className="input-field cursor-pointer"
                >
                  {solicitations
                    .filter((s) => s.status === 'active')
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </div>

              {/* Contributor Type Switcher */}
              <div>
                <label className="input-label">Contributor Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setContributorType('member')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      contributorType === 'member'
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <User size={14} />
                    <span>Choir Member</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContributorType('external')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      contributorType === 'external'
                        ? 'bg-primary text-white border-primary shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    <Building size={14} />
                    <span>External Donor</span>
                  </button>
                </div>
              </div>

              {contributorType === 'member' ? (
                <div>
                  <label className="input-label" htmlFor="contribMem">
                    Select Member *
                  </label>
                  <select
                    id="contribMem"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="input-field cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.voice_part || 'Member'})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="input-label" htmlFor="contribExt">
                    Donor / Sponsor Name *
                  </label>
                  <input
                    id="contribExt"
                    type="text"
                    required
                    placeholder="e.g. Dr. Juan Dela Cruz / Parish Council"
                    value={externalDonorName}
                    onChange={(e) => setExternalDonorName(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label className="input-label" htmlFor="contribAmt">
                  Contribution Amount (₱) *
                </label>
                <input
                  id="contribAmt"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="e.g. 500.00"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="input-field text-base font-bold font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="input-label" htmlFor="contribMeth">
                    Method *
                  </label>
                  <select
                    id="contribMeth"
                    value={contribMethod}
                    onChange={(e) => setContribMethod(e.target.value as PaymentMethod)}
                    className="input-field cursor-pointer"
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="input-label" htmlFor="contribRefInput">
                    Reference # (Optional)
                  </label>
                  <input
                    id="contribRefInput"
                    type="text"
                    placeholder="Receipt / Ref"
                    value={contribRef}
                    onChange={(e) => setContribRef(e.target.value)}
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowContributionModal(false)}
                  disabled={contribLoading}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contribLoading}
                  className="btn btn-primary !py-2 !px-5 text-xs font-bold"
                >
                  {contribLoading ? 'Recording…' : 'Save Contribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Contribution Modal */}
      {voidContribId && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-4"
          onClick={() => setVoidContribId(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-red-700 border-b border-slate-100 pb-3">
              <ShieldAlert size={20} />
              <h3 className="text-base font-bold m-0">Void Solicitation Contribution</h3>
            </div>

            <form onSubmit={handleConfirmVoidContribution} className="flex flex-col gap-3 text-xs sm:text-sm">
              <p className="text-slate-600 m-0 leading-relaxed text-xs">
                Voiding marks this contribution as invalid and adjusts campaign progress totals. This action is permanently logged in the audit trail.
              </p>

              <div>
                <label className="input-label" htmlFor="voidContribReasonInput">
                  Reason for Voiding *
                </label>
                <textarea
                  id="voidContribReasonInput"
                  required
                  rows={3}
                  placeholder="e.g. Cheque bounced, entered under wrong campaign"
                  value={voidContribReason}
                  onChange={(e) => setVoidContribReason(e.target.value)}
                  className="input-field text-xs sm:text-sm"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVoidContribId(null)}
                  disabled={voidingLoading}
                  className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidingLoading || !voidContribReason.trim()}
                  className="btn !bg-red-600 hover:!bg-red-700 !text-white !py-2 !px-4 text-xs font-bold"
                >
                  {voidingLoading ? 'Voiding…' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
