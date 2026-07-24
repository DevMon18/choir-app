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

  // Fetch specific non-archived song with categories
  const { data: rawSong, error } = await supabase
    .from('songs')
    .select(`
      *,
      song_category_links (
        song_categories ( id, name )
      )
    `)
    .eq('id', id)
    .eq('is_archived', false)
    .single();

  if (error || !rawSong) {
    notFound();
  }

  const mappedSong = {
    ...rawSong,
    categories: (rawSong.song_category_links || [])
      .map((l: any) => l.song_categories)
      .filter(Boolean),
  };

  return (
    <SongViewerClient
      currentUserProfile={currentProfile}
      song={mappedSong}
    />
  );
};

export default SongDetailPage;
