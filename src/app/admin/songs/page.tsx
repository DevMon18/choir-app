import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { SongsManagerClient } from './SongsManagerClient';
import { listCategories } from '@/app/admin/categories/actions';

export const dynamic = 'force-dynamic';

const AdminSongsPage = async () => {
  const currentProfile = await getProfile();
  if (!currentProfile) redirect('/login');

  const isAuthorized = ['super_admin', 'director', 'secretary'].includes(currentProfile.role);
  if (!isAuthorized) redirect('/dashboard');

  const supabase = await createClient();

  const [
    { data: rawSongs, error },
    { categories: availableCategories },
  ] = await Promise.all([
    supabase
      .from('songs')
      .select(`
        id, title, composer, arranger, category, lyrics, is_archived, created_at,
        song_category_links (
          song_categories ( id, name )
        )
      `)
      .order('title'),
    listCategories(),
  ]);

  if (error) console.error('Error fetching songs:', error);

  const mappedSongs = (rawSongs || []).map((s: any) => ({
    id: s.id,
    title: s.title,
    composer: s.composer,
    arranger: s.arranger,
    category: s.category,
    lyrics: s.lyrics,
    is_archived: s.is_archived,
    created_at: s.created_at,
    categories: (s.song_category_links || [])
      .map((l: any) => l.song_categories)
      .filter(Boolean),
  }));

  return (
    <SongsManagerClient
      currentUserProfile={currentProfile}
      initialSongs={mappedSongs}
      availableCategories={availableCategories}
    />
  );
};

export default AdminSongsPage;
