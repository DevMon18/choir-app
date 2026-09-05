import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getLeaderboardData } from './actions';
import { LeaderboardClient } from './LeaderboardClient';

export const dynamic = 'force-dynamic';

const LeaderboardPage = async () => {
  const currentProfile = await getProfile();
  if (!currentProfile) redirect('/login');
  if (['pending', 'rejected'].includes(currentProfile.role)) redirect('/dashboard');

  const initialData = await getLeaderboardData('all_time', true);

  return (
    <LeaderboardClient
      currentUserProfile={currentProfile}
      initialData={initialData}
    />
  );
};

export default LeaderboardPage;
