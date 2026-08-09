import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { RepertoireClient } from './RepertoireClient';
import { listCategories } from '@/app/admin/categories/actions';
import { getCache, setCache } from '@/lib/cache';

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

  const cacheKey = 'repertoire:all_songs';
  let mappedSongs = await getCache<any[]>(cacheKey);

  if (!mappedSongs) {
    const supabase = await createClient();
    const rawSongsRes = await supabase
      .from('songs')
      .select(`
        id, title, composer, category, lyrics,
        song_category_links (
          song_categories ( id, name )
        )
      `)
      .eq('is_archived', false)
      .order('title');

    if (rawSongsRes.error) console.error('Error fetching songs:', rawSongsRes.error);

    mappedSongs = (rawSongsRes.data || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      composer: s.composer,
      category: s.category,
      lyrics: s.lyrics,
      categories: (s.song_category_links || [])
        .map((l: any) => l.song_categories)
        .filter(Boolean),
    }));

    await setCache(cacheKey, mappedSongs, 120);
  }

  const { categories: availableCategories } = await listCategories();

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
