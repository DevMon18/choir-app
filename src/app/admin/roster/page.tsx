import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RosterClient from './RosterClient';

export const dynamic = 'force-dynamic';

const AdminRosterPage = async () => {
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

  const isAuthorized = ['super_admin', 'director', 'secretary'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  // 3. Fetch active roster from database (roles other than pending/rejected)
  const { data: roster, error: rosterErr } = await supabase
    .from('profiles')
    .select('*')
    .neq('role', 'pending')
    .neq('role', 'rejected')
    .order('full_name');

  if (rosterErr) {
    console.error('Error fetching roster:', rosterErr);
  }

  return (
    <RosterClient
      currentUserProfile={currentProfile}
      roster={roster || []}
    />
  );
};

export default AdminRosterPage;
