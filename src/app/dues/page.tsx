import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../actions';
import { getProfile } from '@/lib/supabase/user';

import { Navbar } from '@/components/Navbar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Dues — Choir Collective',
  description: 'View your membership dues history',
};

interface DuesRecord {
  id: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  notes: string | null;
  period_label: string | null;
}

const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
  paid:    { bg: '#d1fae5', color: '#059669', label: 'Paid ✓' },
  unpaid:  { bg: '#fef3c7', color: '#d97706', label: 'Unpaid' },
  overdue: { bg: '#fee2e2', color: '#dc2626', label: 'Overdue !' },
  waived:  { bg: '#f3f4f6', color: '#6b7280', label: 'Waived' },
};

const DuesPage = async () => {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  if (['pending', 'rejected'].includes(profile.role)) {
    redirect('/dashboard');
  }

  // Admin/Treasurer: link to full admin view instead
  if (['super_admin', 'director', 'treasurer'].includes(profile.role)) {
    redirect('/admin/finances');
  }

  const supabase = await createClient();

  // Members: see only their own dues
  const { data: dues, error } = await supabase
    .from('member_dues')
    .select('id, amount, due_date, paid_date, status, notes, period_label')
    .or(`user_id.eq.${profile.id},member_id.eq.${profile.id}`)
    .order('due_date', { ascending: false });

  const totalOwed = (dues ?? [])
    .filter(d => ['unpaid', 'overdue'].includes(d.status))
    .reduce((sum, d) => sum + (d.amount ?? 0), 0);

  const totalPaid = (dues ?? [])
    .filter(d => d.status === 'paid')
    .reduce((sum, d) => sum + (d.amount ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={profile} />

      <main style={{ flex: 1, padding: '40px 16px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
            My Dues
          </h1>
          <p style={{ color: 'var(--muted)' }}>Your membership dues and payment history, {profile.full_name}.</p>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div className="glass-container" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--success)', marginBottom: '4px' }}>
              ₱{totalPaid.toLocaleString()}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>Total Paid</div>
          </div>
          <div className="glass-container" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: totalOwed > 0 ? 'var(--error)' : 'var(--muted)', marginBottom: '4px' }}>
              ₱{totalOwed.toLocaleString()}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>Outstanding Balance</div>
          </div>
          <div className="glass-container" style={{ padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '4px' }}>
              {(dues ?? []).length}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: 600 }}>Total Records</div>
          </div>
        </div>

        {/* Contact note */}
        {totalOwed > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: '24px' }}>
            <span>💬</span>
            <span>You have an outstanding balance of <strong>₱{totalOwed.toLocaleString()}</strong>. Please contact the Treasurer or Secretary to make a payment.</span>
          </div>
        )}

        {/* Dues history table */}
        {error ? (
          <div className="alert alert-error">Failed to load dues: {error.message}</div>
        ) : !dues || dues.length === 0 ? (
          <div className="glass-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💰</div>
            <p style={{ color: 'var(--muted)' }}>No dues records found for your account.</p>
          </div>
        ) : (
          <div className="glass-container" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="table-container" style={{ margin: 0, border: 'none' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Amount</th>
                    <th>Due Date</th>
                    <th>Paid Date</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {dues.map((d: DuesRecord) => {
                    const s = statusStyle[d.status] ?? statusStyle.unpaid;
                    return (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{d.period_label ?? '—'}</td>
                        <td>₱{(d.amount ?? 0).toLocaleString()}</td>
                        <td>{d.due_date ? new Date(d.due_date).toLocaleDateString() : '—'}</td>
                        <td>{d.paid_date ? new Date(d.paid_date).toLocaleDateString() : '—'}</td>
                        <td>
                          <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{d.notes ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DuesPage;
