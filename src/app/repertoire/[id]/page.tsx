import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import SongViewerClient from './SongViewerClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const SongDetailPage = async ({ params }: PageProps) => {
  const { id } = await params;
  
  const currentProfile = await getProfile();
  if (!currentProfile) redirect('/login');
  if (['pending', 'rejected'].includes(currentProfile.role)) redirect('/dashboard');

  const supabase = await createClient();

  // 3. Fetch specific non-archived song
  const { data: song, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .eq('is_archived', false)
    .single();

  if (error || !song) {
    notFound();
  }

  return (
    <SongViewerClient
      currentUserProfile={currentProfile}
      song={song}
    />
  );
};

export default SongDetailPage;
