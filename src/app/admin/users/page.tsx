import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { UsersManagerClient } from './UsersManagerClient';

export const dynamic = 'force-dynamic';

const AdminUsersPage = async () => {
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const isAuthorized = ['super_admin', 'director', 'secretary'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch pendingUsers, joinRequests, and allUsers (if super_admin) concurrently via Promise.all
  const [
    { data: pendingUsers, error: pendingErr },
    { data: joinRequests, error: requestsErr },
    allUsersRes,
  ] = await Promise.all([
    supabase.rpc('admin_list_pending_users'),
    supabase
      .from('join_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    currentProfile.role === 'super_admin'
      ? supabase.from('profiles').select('*').order('full_name')
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (pendingErr) console.error('Error fetching pending users:', pendingErr);
  if (requestsErr) console.error('Error fetching join requests:', requestsErr);
  if (allUsersRes.error) console.error('Error fetching all users:', allUsersRes.error);

  const allUsers = allUsersRes.data || [];

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
