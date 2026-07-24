'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { recordInvoicePayment, toggleSinkingFund } from './actions';
import { Navbar } from '@/components/Navbar';
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

      tl.fromTo('.content-anim-item',
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1 }
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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '500px', height: '500px' }}></div>
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }}></div>

      <Navbar profile={currentUserProfile} />

      <main className="admin-content-full">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            <div className="content-anim-item" style={{ opacity: 0 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px', color: 'var(--primary)' }}>Finances Management</h2>
              <p style={{ color: 'var(--muted)' }}>Manage choir dues invoicing and weekly Sunday Sinking Fund tally collection</p>
            </div>

            {/* Segmented Tab Buttons */}
            <div className="content-anim-item" style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', flexWrap: 'wrap', opacity: 0 }}>
              <button
                className={`btn ${activeTab === 'dues' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('dues')}
                style={{ padding: '8px 20px', minHeight: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                📁 Annual Membership Dues
              </button>
              <button
                className={`btn ${activeTab === 'sinking' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('sinking')}
                style={{ padding: '8px 20px', minHeight: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                📊 Sunday Sinking Fund Tally
              </button>
            </div>


            {/* TAB 1: Annual Membership Dues */}
            {activeTab === 'dues' && (
              <div className="glass-container content-anim-item" style={{ padding: '30px', opacity: 0 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '16px', color: 'var(--primary)' }}>Annual Membership Dues Invoices</h3>
                
                {invoices.filter(inv => !inv.period_label?.startsWith('Sinking Fund')).length === 0 ? (
                  <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
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
                                  <span className="badge badge-rejected" style={{ backgroundColor: 'var(--warning)', color: '#ffffff' }}>Overdue</span>
                                ) : (
                                  <span className="badge badge-rejected">Unpaid</span>
                                )}
                              </td>
                              <td data-label="Actions">
                                {inv.status !== 'paid' ? (
                                  <button
                                    onClick={() => handleRecordPayment(inv.id)}
                                    className="btn btn-primary"
                                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                    disabled={loadingId === inv.id}
                                  >
                                    {loadingId === inv.id ? 'Recording...' : 'Record Payment'}
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>N/A</span>
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
              <div className="glass-container content-anim-item" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', opacity: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>Sunday Sinking Fund Collection</h3>
                    <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Choose a Sunday date to tally Sinking Fund payments received from members.</p>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Collection Sunday</label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="input-field"
                        style={{ padding: '8px 12px', minHeight: '38px', borderRadius: '10px', fontSize: '0.9rem', width: '160px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>Default Amount</label>
                      <input
                        type="number"
                        value={defaultAmount}
                        onChange={(e) => setDefaultAmount(Number(e.target.value))}
                        className="input-field"
                        style={{ padding: '8px 12px', minHeight: '38px', borderRadius: '10px', fontSize: '0.9rem', width: '110px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Sinking Fund Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  <div style={{ padding: '20px', borderRadius: '18px', background: '#f8fafc', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Total Sinking Fund Collected</span>
                    <strong style={{ fontSize: '1.75rem', color: '#059669' }}>₱{totalCollected.toFixed(2)}</strong>
                  </div>
                  <div style={{ padding: '20px', borderRadius: '18px', background: '#f8fafc', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Members Who Paid</span>
                    <strong style={{ fontSize: '1.75rem', color: 'var(--primary)' }}>{paidCount} / {activeMembers.length}</strong>
                  </div>
                  <div style={{ padding: '20px', borderRadius: '18px', background: '#f8fafc', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Lacks Payment (Weekly)</span>
                    <strong style={{ fontSize: '1.75rem', color: '#d97706' }}>{lackingCount} members</strong>
                  </div>
                </div>

                {/* Filter / Search */}
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search member name to record Sinking Fund..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', paddingLeft: '44px' }}
                  />
                  <svg style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Tally Sheet Check List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {filteredActiveMembers.map((member: any) => {
                      const record = getSinkingFundRecord(member.id);
                      const hasPaid = record?.status === 'paid';
                      const amt = customAmounts[member.id] !== undefined ? customAmounts[member.id] : (record?.amount ?? defaultAmount);

                      return (
                        <div
                          key={member.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            background: hasPaid ? '#f0fdf4' : '#ffffff',
                            border: hasPaid ? '1px solid #bbf7d0' : '1px solid var(--glass-border)',
                            borderRadius: '18px',
                            transition: 'all 0.25s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {member.avatar_url ? (
                              <img
                                src={member.avatar_url}
                                alt={member.full_name}
                                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--glass-border)' }}
                              />
                            ) : (
                              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#f1f5f9', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.95rem' }}>
                                {member.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                            )}
                            <div>
                              <strong style={{ display: 'block', fontSize: '1rem', color: 'var(--foreground)' }}>{member.full_name}</strong>
                              <span style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'capitalize' }}>
                                {member.voice_part || 'no voice part'} · {member.role}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {/* Individual amount override input */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>₱</span>
                              <input
                                type="number"
                                value={amt}
                                disabled={hasPaid}
                                onChange={(e) => setCustomAmounts({ ...customAmounts, [member.id]: Number(e.target.value) })}
                                style={{
                                  width: '80px',
                                  padding: '8px 10px',
                                  borderRadius: '10px',
                                  border: '1px solid var(--glass-border)',
                                  fontSize: '0.9rem',
                                  textAlign: 'right',
                                  background: hasPaid ? '#e2e8f0' : '#ffffff',
                                  color: hasPaid ? 'var(--muted)' : 'var(--foreground)',
                                  minHeight: '38px',
                                }}
                              />
                            </div>

                            {/* Payment toggle buttons */}
                            {hasPaid ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#d1fae5',
                                  color: '#065f46',
                                  padding: '8px 16px',
                                  borderRadius: '12px',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  minHeight: '38px',
                                }}>
                                  ✓ Paid
                                </span>
                                <button
                                  disabled={tallyLoadingId === member.id}
                                  onClick={() => handleToggleSinkingFund(member.id, 'paid')}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--error)',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    fontWeight: 600,
                                  }}
                                >
                                  Undo
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={tallyLoadingId === member.id}
                                onClick={() => handleToggleSinkingFund(member.id, 'unpaid')}
                                className="btn btn-primary"
                                style={{ padding: '8px 16px', fontSize: '0.85rem', minHeight: '38px', borderRadius: '12px' }}
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
