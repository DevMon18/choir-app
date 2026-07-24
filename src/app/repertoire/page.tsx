import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { RepertoireClient } from './RepertoireClient';
import { listCategories } from '@/app/admin/categories/actions';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; categories?: string }>;
}

const RepertoirePage = async ({ searchParams }: PageProps) => {
  const { q, categories: categoriesParam } = await searchParams;
  const query = q?.trim() ?? '';
  const selectedCatParam = categoriesParam?.trim() ?? '';

  const currentProfile = await getProfile();
  if (!currentProfile) redirect('/login');
  if (['pending', 'rejected'].includes(currentProfile.role)) redirect('/dashboard');

  const supabase = await createClient();

  const [
    { categories: availableCategories },
    rawSongsRes,
  ] = await Promise.all([
    listCategories(),
    (() => {
      let songsQuery = supabase
        .from('songs')
        .select(`
          id, title, composer, category, lyrics,
          song_category_links (
            song_categories ( id, name )
          )
        `)
        .eq('is_archived', false)
        .order('title');

      if (query) {
        songsQuery = songsQuery.textSearch('lyrics_tsv', query, {
          type: 'plain',
          config: 'english',
        });
      }
      return songsQuery;
    })(),
  ]);

  if (rawSongsRes.error) console.error('Error fetching songs:', rawSongsRes.error);

  const mappedSongs = (rawSongsRes.data || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    composer: s.composer,
    category: s.category,
    lyrics: s.lyrics,
    categories: (s.song_category_links || [])
      .map((l: any) => l.song_categories)
      .filter(Boolean),
  }));

  return (
    <Suspense>
      <RepertoireClient
        currentUserProfile={currentProfile}
        songs={mappedSongs}
        availableCategories={availableCategories}
        query={query}
        categoriesParam={selectedCatParam}
      />
    </Suspense>
  );
};

export default RepertoirePage;
