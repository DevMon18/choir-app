import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import SongViewerClient from './SongViewerClient';
import { listPracticeRecordings } from './recordings-actions';
import { getSongLyricsCoverage } from './actions';

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

  // Concurrently fetch song data, practice recordings, and lyrics coverage
  const [songRes, recordingsRes, coverageRes] = await Promise.all([
    supabase
      .from('songs')
      .select(`
        *,
        song_category_links (
          song_categories ( id, name )
        )
      `)
      .eq('id', id)
      .eq('is_archived', false)
      .single(),
    listPracticeRecordings(id),
    getSongLyricsCoverage(id),
  ]);

  const rawSong = songRes.data;
  if (songRes.error || !rawSong) {
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
      initialRecordings={recordingsRes.recordings || []}
      initialCoverage={coverageRes}
    />
  );
};

export default SongDetailPage;

