import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import SongViewerClient from './SongViewerClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

const SongDetailPage = async ({ params }: PageProps) => {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 2. Load profiles role
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!currentProfile) redirect('/login');
  if (['pending', 'rejected'].includes(currentProfile.role)) redirect('/dashboard');

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
