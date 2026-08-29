'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FileText, BarChart3, DollarSign, Calendar, Search, Check, X } from 'lucide-react';
import { recordInvoicePayment, toggleSinkingFund } from './actions';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import { useToast } from '@/components/Toast';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  created_at: string;
  voice_part?: string | null;
  avatar_url?: string | null;
}

interface DuesInvoice {
  id: string;
  user_id: string;
  member_id?: string;
  amount: number;
  due_date: string;
  status: 'paid' | 'unpaid' | 'overdue';
  created_at: string;
  period_label?: string | null;
  notes?: string | null;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

interface FinancesClientProps {
  currentUserProfile: Profile;
  invoices: DuesInvoice[];
  members: Profile[];
}

export const FinancesClient = ({ currentUserProfile, invoices: initialInvoices, members }: FinancesClientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const [invoices, setInvoices] = useState<DuesInvoice[]>(initialInvoices);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<'dues' | 'sinking'>('dues');

  // Sinking Fund Tally States
  const getLatestSunday = () => {
    const d = new Date();
    const day = d.getDay();
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - day);
    const yyyy = sunday.getFullYear();
    const mm = String(sunday.getMonth() + 1).padStart(2, '0');
    const dd = String(sunday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedDate, setSelectedDate] = useState(getLatestSunday());
  const [defaultAmount, setDefaultAmount] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [tallyLoadingId, setTallyLoadingId] = useState<string | null>(null);

  useEffect(() => {
    // Stagger entry animations
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.content-anim-item',
        { opacity: 0, y: 14, duration: 0.35, stagger: 0.035 }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [activeTab]);

  const handleRecordPayment = async (invoiceId: string) => {
    setLoadingId(invoiceId);
    const result = await recordInvoicePayment(invoiceId);
    setLoadingId(null);
    if (result?.error) {
      addToast({ type: 'error', title: 'Payment Failed', message: result.error });
    } else {
      addToast({ type: 'success', title: 'Payment Recorded!', message: 'Dues payment successfully marked as paid.' });
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, status: 'paid' } : inv))
      );
    }
  };

  const handleToggleSinkingFund = async (memberId: string, currentStatus: 'paid' | 'unpaid') => {
    setTallyLoadingId(memberId);
    const targetStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    const amount = customAmounts[memberId] !== undefined ? customAmounts[memberId] : defaultAmount;
    const periodLabel = `Sinking Fund - ${selectedDate}`;
    const result = await toggleSinkingFund(memberId, selectedDate, targetStatus, amount, periodLabel);
    setTallyLoadingId(null);
    if (result?.error) {
      addToast({ type: 'error', title: 'Tally Error', message: result.error });
    } else {
      addToast({
        type: targetStatus === 'paid' ? 'success' : 'warning',
        title: targetStatus === 'paid' ? '✓ Payment Recorded' : 'Marked as Lacking',
        message: targetStatus === 'paid' ? `₱${amount} sinking fund collected for ${selectedDate}` : 'Payment status updated.',
      });
      setInvoices((prev) => {
        const existingIdx = prev.findIndex(
          (inv) =>
            inv.member_id === memberId &&
            inv.due_date === selectedDate &&
            inv.period_label === periodLabel
        );
        if (existingIdx > -1) {
          return prev.map((inv, idx) =>
            idx === existingIdx
              ? { ...inv, status: targetStatus, amount: Number(amount) }
              : inv
          );
        } else {
          const newInvoice: DuesInvoice = {
            id: Math.random().toString(),
            user_id: memberId,
            member_id: memberId,
            amount: Number(amount),
            due_date: selectedDate,
            status: targetStatus,
            created_at: new Date().toISOString(),
            profiles: null,
            period_label: periodLabel,
          };
          return [newInvoice, ...prev];
        }
      });
    }
  };

  const getSinkingFundRecord = (memberId: string) => {
    return invoices.find(
      (inv) =>
        inv.member_id === memberId &&
        inv.due_date === selectedDate &&
        inv.period_label === `Sinking Fund - ${selectedDate}`
    );
  };

  // Sinking Fund Math (Memoized for high rendering performance)
  const activeMembers = useMemo(() => {
    return members.filter((m: any) => m.role !== 'super_admin');
  }, [members]);

  const sinkingFundRecords = useMemo(() => {
    return invoices.filter(
      (inv) => inv.due_date === selectedDate && inv.period_label === `Sinking Fund - ${selectedDate}`
    );
  }, [invoices, selectedDate]);

  const totalCollected = useMemo(() => {
    return sinkingFundRecords
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
  }, [sinkingFundRecords]);

  const paidCount = useMemo(() => {
    return sinkingFundRecords.filter((inv) => inv.status === 'paid').length;
  }, [sinkingFundRecords]);

  const lackingCount = useMemo(() => {
    return activeMembers.length - paidCount;
  }, [activeMembers.length, paidCount]);

  const filteredActiveMembers = useMemo(() => {
    return activeMembers.filter((m: any) =>
      m.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [activeMembers, searchQuery]);

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[500px] h-[500px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
        <div className="flex flex-col gap-7.5">
          <div className="content-anim-item">
            <h2 className="text-2xl sm:text-[1.75rem] font-bold mb-2 text-primary">Finances Management</h2>
            <p className="text-muted text-sm sm:text-base">Manage choir dues invoicing and weekly Sunday Sinking Fund tally collection</p>
          </div>

          {/* Segmented Tab Buttons */}
          <div className="content-anim-item flex gap-3 border-b border-glass-border pb-4 flex-wrap">
            <button
              className={`btn finances-tab-btn !py-2 !px-5 !rounded-xl inline-flex items-center gap-2 ${activeTab === 'dues' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('dues')}
            >
              <FileText size={16} /> Annual Membership Dues
            </button>
            <button
              className={`btn finances-tab-btn !py-2 !px-5 !rounded-xl inline-flex items-center gap-2 ${activeTab === 'sinking' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveTab('sinking')}
            >
              <BarChart3 size={16} /> Sunday Sinking Fund Tally
            </button>
          </div>

          {/* TAB 1: Annual Membership Dues */}
          {activeTab === 'dues' && (
            <div className="glass-container content-anim-item p-7.5">
              <h3 className="text-xl sm:text-[1.25rem] font-semibold mb-4 text-primary">Annual Membership Dues Invoices</h3>
              
              {invoices.filter(inv => !inv.period_label?.startsWith('Sinking Fund')).length === 0 ? (
                <div className="text-muted text-center py-10">
                  No dues invoices recorded.
                </div>
              ) : (
                <div className="table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Choir Member</th>
                        <th>Email Address</th>
                        <th>Amount</th>
                        <th>Due Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices
                        .filter(inv => !inv.period_label?.startsWith('Sinking Fund'))
                        .map((inv) => (
                          <tr key={inv.id}>
                            <td data-label="Choir Member"><strong>{inv.profiles?.full_name || 'System User'}</strong></td>
                            <td data-label="Email Address">{inv.profiles?.email || 'N/A'}</td>
                            <td data-label="Amount">₱{Number(inv.amount).toFixed(2)}</td>
                            <td data-label="Due Date">{new Date(inv.due_date).toLocaleDateString()}</td>
                            <td data-label="Status">
                              {inv.status === 'paid' ? (
                                <span className="badge badge-approved">Paid</span>
                              ) : inv.status === 'overdue' ? (
                                <span className="badge badge-rejected !bg-warning !text-white">Overdue</span>
                              ) : (
                                <span className="badge badge-rejected">Unpaid</span>
                              )}
                            </td>
                            <td data-label="Actions">
                              {inv.status !== 'paid' ? (
                                <button
                                  onClick={() => handleRecordPayment(inv.id)}
                                  className="btn btn-primary !py-1.5 !px-3 text-xs"
                                  disabled={loadingId === inv.id}
                                >
                                  {loadingId === inv.id ? 'Recording...' : 'Record Payment'}
                                </button>
                              ) : (
                                <span className="text-xs sm:text-sm text-muted">N/A</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Sunday Sinking Fund Tally */}
          {activeTab === 'sinking' && (
            <div className="glass-container content-anim-item p-7.5 flex flex-col gap-6">
              <div className="flex flex-wrap gap-5 justify-between items-center">
                <div>
                  <h3 className="text-xl sm:text-[1.25rem] font-semibold text-primary mb-1">Sunday Sinking Fund Collection</h3>
                  <p className="text-muted text-sm sm:text-[0.9rem]">Choose a Sunday date to tally Sinking Fund payments received from members.</p>
                </div>
                
                <div className="flex gap-4 items-center flex-wrap">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted">Collection Sunday</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="input-field !py-2 !px-3 !rounded-xl text-sm w-[160px]"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-muted">Default Amount</label>
                    <input
                      type="number"
                      value={defaultAmount}
                      onChange={(e) => setDefaultAmount(Number(e.target.value))}
                      className="input-field !py-2 !px-3 !rounded-xl text-sm w-[110px]"
                    />
                  </div>
                </div>
              </div>

              {/* Sinking Fund Summary Cards */}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                <div className="p-5 rounded-2xl bg-slate-50 border border-glass-border flex flex-col gap-1">
                  <span className="text-sm sm:text-[0.85rem] font-semibold text-muted">Total Sinking Fund Collected</span>
                  <strong className="text-2xl sm:text-[1.75rem] text-emerald-600">₱{totalCollected.toFixed(2)}</strong>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 border border-glass-border flex flex-col gap-1">
                  <span className="text-sm sm:text-[0.85rem] font-semibold text-muted">Members Who Paid</span>
                  <strong className="text-2xl sm:text-[1.75rem] text-primary">{paidCount} / {activeMembers.length}</strong>
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 border border-glass-border flex flex-col gap-1">
                  <span className="text-sm sm:text-[0.85rem] font-semibold text-muted">Lacks Payment (Weekly)</span>
                  <strong className="text-2xl sm:text-[1.75rem] text-amber-600">{lackingCount} members</strong>
                </div>
              </div>

              {/* Filter / Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search member name to record Sinking Fund..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field w-full pl-11"
                />
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Tally Sheet Check List */}
              <div className="flex flex-col gap-3">
                {filteredActiveMembers.map((member: any) => {
                  const record = getSinkingFundRecord(member.id);
                  const hasPaid = record?.status === 'paid';
                  const amt = customAmounts[member.id] !== undefined ? customAmounts[member.id] : (record?.amount ?? defaultAmount);

                  return (
                    <div
                      key={member.id}
                      className={`finances-sinking-row flex items-center justify-between p-4 sm:py-4 sm:px-5 rounded-2xl transition-all flex-wrap gap-3 border ${
                        hasPaid ? 'bg-emerald-50/70 border-emerald-200' : 'bg-white border-glass-border'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <Avatar
                          src={member.avatar_url}
                          name={member.full_name}
                          size={42}
                          border
                        />
                        <div>
                          <strong className="block text-base font-bold text-foreground">{member.full_name}</strong>
                          <span className="text-xs text-muted capitalize">
                            {member.voice_part || 'no voice part'} · {member.role}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Individual amount override input */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-muted">₱</span>
                          <input
                            type="number"
                            value={amt}
                            disabled={hasPaid}
                            onChange={(e) => setCustomAmounts({ ...customAmounts, [member.id]: Number(e.target.value) })}
                            className={`w-20 py-2 px-2.5 rounded-xl border border-glass-border text-sm text-right ${
                              hasPaid ? 'bg-slate-200 text-muted' : 'bg-white text-foreground'
                            }`}
                          />
                        </div>

                        {/* Payment toggle buttons */}
                        {hasPaid ? (
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 py-2 px-4 rounded-xl text-sm sm:text-[0.85rem] font-semibold min-h-[38px]">
                              ✓ Paid
                            </span>
                            <button
                              disabled={tallyLoadingId === member.id}
                              onClick={() => handleToggleSinkingFund(member.id, 'paid')}
                              className="bg-transparent border-0 text-error text-sm cursor-pointer py-2 px-3 min-h-[44px] font-semibold"
                            >
                              Undo
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={tallyLoadingId === member.id}
                            onClick={() => handleToggleSinkingFund(member.id, 'unpaid')}
                            className="btn btn-primary !py-2 !px-4 text-sm sm:text-[0.85rem] !rounded-xl"
                          >
                            {tallyLoadingId === member.id ? 'Recording...' : 'Mark Paid'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FinancesClient;
