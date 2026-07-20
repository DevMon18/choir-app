import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import FinancesClient from './FinancesClient';

export const dynamic = 'force-dynamic';

const AdminFinancesPage = async () => {
  const supabase = await createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Fetch current user profile to verify auth
  const { data: currentProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileErr || !currentProfile) {
    redirect('/login');
  }

  const isAuthorized = ['super_admin', 'director', 'treasurer'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  // 3. Fetch dues invoices from member_dues table joining on profiles
  const { data: invoices, error: invoicesErr } = await supabase
    .from('member_dues')
    .select('*, profiles!user_id(full_name, email)')
    .order('due_date', { ascending: false });

  if (invoicesErr) {
    console.error('Error fetching member dues:', invoicesErr);
  }

  // 4. Fetch active member profiles for the Sinking Fund Tally view
  const { data: members, error: membersErr } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, voice_part, avatar_url')
    .neq('role', 'pending')
    .neq('role', 'rejected')
    .order('full_name', { ascending: true });

  if (membersErr) {
    console.error('Error fetching members for finances:', membersErr);
  }

  return (
    <FinancesClient
      currentUserProfile={currentProfile}
      invoices={invoices as any || []}
      members={members as any || []}
    />
  );
};

export default AdminFinancesPage;
