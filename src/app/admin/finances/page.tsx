import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import FinancesClient from './FinancesClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Finances & Sinking Fund — Choir Collective',
  description: 'Manage Sinking Fund dues, collections, solicitations, and financial reports.',
};

const AdminFinancesPage = async () => {
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  // Super Admin, Director, Treasurer, and Secretary (view-only) are authorized
  const isAuthorized = ['super_admin', 'director', 'treasurer', 'secretary'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch periods, payments, solicitations, contributions, members, attendance sessions & records concurrently
  const [
    { data: periods, error: periodsErr },
    { data: payments, error: paymentsErr },
    { data: solicitations, error: solicitationsErr },
    { data: contributions, error: contributionsErr },
    { data: members, error: membersErr },
    { data: attendanceSessions, error: sessionsErr },
    { data: attendanceRecords, error: recordsErr },
  ] = await Promise.all([
    supabase
      .from('dues_periods')
      .select('*, member:profiles!member_id(id, full_name, email, voice_part, avatar_url)')
      .order('created_at', { ascending: false }),
    supabase
      .from('dues_payments')
      .select('*, recorder:profiles!recorded_by(full_name, email)')
      .order('paid_at', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitations')
      .select('*, creator:profiles!created_by(full_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('solicitations_contributions')
      .select('*, member:profiles!member_id(full_name, avatar_url), recorder:profiles!recorded_by(full_name), solicitation:solicitations!solicitation_id(title, target_amount_centavos)')
      .order('contributed_at', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, voice_part, avatar_url, created_at')
      .neq('role', 'pending')
      .neq('role', 'rejected')
      .order('full_name', { ascending: true }),
    supabase
      .from('attendance_sessions')
      .select('*')
      .order('date', { ascending: false }),
    supabase
      .from('attendance_records')
      .select('*'),
  ]);

  if (periodsErr) console.error('Error fetching dues periods:', periodsErr.message || periodsErr);
  if (paymentsErr) console.error('Error fetching dues payments:', paymentsErr.message || paymentsErr);
  if (solicitationsErr) console.error('Error fetching solicitations:', solicitationsErr.message || solicitationsErr);
  if (contributionsErr) console.error('Error fetching contributions:', contributionsErr.message || contributionsErr);
  if (membersErr) console.error('Error fetching members for finances:', membersErr.message || membersErr);
  if (sessionsErr) console.error('Error fetching attendance sessions:', sessionsErr.message || sessionsErr);
  if (recordsErr) console.error('Error fetching attendance records:', recordsErr.message || recordsErr);

  const rawPeriods = periods || [];
  const rawPayments = payments || [];

  // Embed payments into periods for high rendering efficiency
  const periodsWithPayments = rawPeriods.map((p: any) => ({
    ...p,
    payments: rawPayments.filter((pmt: any) => pmt.dues_period_id === p.id),
  }));

  return (
    <FinancesClient
      currentUserProfile={currentProfile as any}
      periods={periodsWithPayments as any || []}
      payments={rawPayments as any || []}
      solicitations={(solicitations as any) || []}
      contributions={(contributions as any) || []}
      members={(members as any) || []}
      attendanceSessions={(attendanceSessions as any) || []}
      attendanceRecords={(attendanceRecords as any) || []}
    />
  );
};

export default AdminFinancesPage;
