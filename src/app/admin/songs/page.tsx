import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { SongsManagerClient } from './SongsManagerClient';

export const dynamic = 'force-dynamic';

const AdminSongsPage = async () => {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!currentProfile) redirect('/login');

  const isAuthorized = ['super_admin', 'director', 'secretary'].includes(currentProfile.role);
  if (!isAuthorized) redirect('/dashboard');

  const { data: songs, error } = await supabase
    .from('songs')
    .select('id, title, composer, arranger, category, lyrics, is_archived, created_at')
    .order('title');

  if (error) console.error('Error fetching songs:', error);

  return (
    <SongsManagerClient
      currentUserProfile={currentProfile}
      initialSongs={songs || []}
    />
  );
};

export default AdminSongsPage;
