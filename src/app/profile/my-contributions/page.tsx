import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getMyLyricsSubmissions } from './actions';
import { MyContributionsClient } from './MyContributionsClient';

export const dynamic = 'force-dynamic';

const MyContributionsPage = async () => {
  const currentProfile = await getProfile();
  if (!currentProfile) redirect('/login');
  if (['pending', 'rejected'].includes(currentProfile.role)) redirect('/dashboard');

  const { submissions, totalPoints, error } = await getMyLyricsSubmissions();

  return (
    <MyContributionsClient
      currentUserProfile={currentProfile}
      initialSubmissions={submissions || []}
      initialTotalPoints={totalPoints || 0}
      initialError={error}
    />
  );
};

export default MyContributionsPage;
