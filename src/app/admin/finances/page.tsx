import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import FinancesClient from './FinancesClient';

export const dynamic = 'force-dynamic';

const AdminFinancesPage = async () => {
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const isAuthorized = ['super_admin', 'director', 'treasurer'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch invoices and members concurrently via Promise.all
  const [
    { data: invoices, error: invoicesErr },
    { data: members, error: membersErr },
  ] = await Promise.all([
    supabase
      .from('member_dues')
      .select('*, profiles!user_id(full_name, email)')
      .order('due_date', { ascending: false }),
    supabase
      .from('profiles')
      .select('id, full_name, email, role, voice_part, avatar_url')
      .neq('role', 'pending')
      .neq('role', 'rejected')
      .order('full_name', { ascending: true }),
  ]);

  if (invoicesErr) console.error('Error fetching member dues:', invoicesErr);
  if (membersErr) console.error('Error fetching members for finances:', membersErr);

  return (
    <FinancesClient
      currentUserProfile={currentProfile}
      invoices={invoices as any || []}
      members={members as any || []}
    />
  );
};

export default AdminFinancesPage;
