import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RepertoireClient } from './RepertoireClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

const RepertoirePage = async ({ searchParams }: PageProps) => {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!currentProfile) redirect('/login');
  if (['pending', 'rejected'].includes(currentProfile.role)) redirect('/dashboard');

  let songsQuery = supabase
    .from('songs')
    .select('id, title, composer, category, lyrics')
    .eq('is_archived', false)
    .order('title');

  // Full-text search using Postgres tsvector
  if (query) {
    songsQuery = songsQuery.textSearch('lyrics_tsv', query, {
      type: 'plain',
      config: 'english',
    });
  }

  const { data: songs, error } = await songsQuery;
  if (error) console.error('Error fetching songs:', error);

  return (
    <Suspense>
      <RepertoireClient
        currentUserProfile={currentProfile}
        songs={songs ?? []}
        query={query}
      />
    </Suspense>
  );
};

export default RepertoirePage;
