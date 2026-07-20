import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UsersManagerClient } from './UsersManagerClient';

export const dynamic = 'force-dynamic';

const AdminUsersPage = async () => {
  const supabase = await createClient();
  
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

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

  // 1. Fetch pending direct signups
  const { data: pendingUsers, error: pendingErr } = await supabase.rpc('admin_list_pending_users');

  if (pendingErr) {
    console.error('Error fetching pending users:', pendingErr);
  }

  // 2. Fetch pending recruitment applications
  const { data: joinRequests, error: requestsErr } = await supabase
    .from('join_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (requestsErr) {
    console.error('Error fetching join requests:', requestsErr);
  }

  // 3. Fetch all system users if the user is a super_admin
  let allUsers: any[] = [];
  if (currentProfile.role === 'super_admin') {
    const { data: allUsersData, error: allUsersErr } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (allUsersErr) {
      console.error('Error fetching all users:', allUsersErr);
    } else {
      allUsers = allUsersData || [];
    }
  }

  return (
    <UsersManagerClient
      currentUserProfile={currentProfile}
      initialPendingUsers={pendingUsers || []}
      initialJoinRequests={joinRequests || []}
      initialAllUsers={allUsers}
    />
  );
};

export default AdminUsersPage;
