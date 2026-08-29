import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logout } from '../actions';
import { getProfile } from '@/lib/supabase/user';

// Client Component Navbar
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
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={profile} />

      <main className="flex-1 py-10 px-4 max-w-[800px] mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
            My Dues
          </h1>
          <p className="text-muted">Your membership dues and payment history, {profile.full_name}.</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-8">
          <div className="glass-container !p-6 text-center">
            <div className="text-3xl font-bold text-success mb-1">
              ₱{totalPaid.toLocaleString()}
            </div>
            <div className="text-muted text-xs font-semibold">Total Paid</div>
          </div>
          <div className="glass-container !p-6 text-center">
            <div className={`text-3xl font-bold mb-1 ${totalOwed > 0 ? 'text-error' : 'text-muted'}`}>
              ₱{totalOwed.toLocaleString()}
            </div>
            <div className="text-muted text-xs font-semibold">Outstanding Balance</div>
          </div>
          <div className="glass-container !p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-1">
              {(dues ?? []).length}
            </div>
            <div className="text-muted text-xs font-semibold">Total Records</div>
          </div>
        </div>

        {/* Contact note */}
        {totalOwed > 0 && (
          <div className="alert alert-warning mb-6">
            <span>💬</span>
            <span>You have an outstanding balance of <strong>₱{totalOwed.toLocaleString()}</strong>. Please contact the Treasurer or Secretary to make a payment.</span>
          </div>
        )}

        {/* Dues history table */}
        {error ? (
          <div className="alert alert-error">Failed to load dues: {error.message}</div>
        ) : !dues || dues.length === 0 ? (
          <div className="glass-container text-center py-15 px-5">
            <div className="text-4xl mb-3">💰</div>
            <p className="text-muted">No dues records found for your account.</p>
          </div>
        ) : (
          <div className="glass-container !p-0 overflow-hidden">
            <div className="table-container !m-0 !border-none">
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
                        <td data-label="Period" className="font-semibold">{d.period_label ?? '—'}</td>
                        <td data-label="Amount">₱{(d.amount ?? 0).toLocaleString()}</td>
                        <td data-label="Due Date">{d.due_date ? new Date(d.due_date).toLocaleDateString() : '—'}</td>
                        <td data-label="Paid Date">{d.paid_date ? new Date(d.paid_date).toLocaleDateString() : '—'}</td>
                        <td data-label="Status">
                          <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                        </td>
                        <td data-label="Notes" className="text-muted text-xs">{d.notes ?? '—'}</td>
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
