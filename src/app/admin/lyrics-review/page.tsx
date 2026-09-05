import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { listPendingLyricsSubmissions } from './actions';
import { LyricsReviewClient } from './LyricsReviewClient';

export const dynamic = 'force-dynamic';

const LyricsReviewPage = async () => {
  const currentProfile = await getProfile();
  if (!currentProfile) redirect('/login');

  const isAuthorized = ['super_admin', 'director'].includes(currentProfile.role);
  if (!isAuthorized) redirect('/dashboard');

  const { submissions, error } = await listPendingLyricsSubmissions();

  return (
    <LyricsReviewClient
      currentUserProfile={currentProfile}
      initialSubmissions={submissions || []}
      initialError={error}
    />
  );
};

export default LyricsReviewPage;
