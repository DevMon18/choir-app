import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { SequenceManagerClient } from './SequenceManagerClient';

export const dynamic = 'force-dynamic';

const songSelectWithCategories = `
  id, title, composer, category, lyrics,
  song_category_links (
    song_categories ( id, name )
  )
`;

const mapSong = (s: any) => {
  if (!s) return null;
  return {
    ...s,
    categories: (s.song_category_links || [])
      .map((l: any) => l.song_categories)
      .filter(Boolean),
  };
};

const AdminSequencesPage = async () => {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch sequences, songs, and activeSession concurrently via Promise.all
  const [
    { data: sequencesData },
    { data: songsData },
    { data: activeSession },
  ] = await Promise.all([
    supabase
      .from('mass_sequences')
      .select(`
        id, title, description, scheduled_at,
        sequence_items (
          id, order_index, notes, role_in_mass,
          songs ( ${songSelectWithCategories} )
        )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('songs')
      .select(songSelectWithCategories)
      .eq('is_archived', false)
      .order('title'),
    supabase
      .from('live_sessions')
      .select('id, sequence_id, active_song_id, director_semitones, scroll_speed, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const mappedSongs = (songsData || []).map(mapSong);
  const mappedSequences = (sequencesData || []).map((seq: any) => ({
    ...seq,
    sequence_items: (seq.sequence_items || []).map((item: any) => ({
      ...item,
      songs: mapSong(item.songs),
    })),
  }));

  return (
    <SequenceManagerClient
      profile={profile}
      sequences={mappedSequences as unknown as Parameters<typeof SequenceManagerClient>[0]['sequences']}
      songs={mappedSongs}
      activeSession={activeSession}
    />
  );
};

export default AdminSequencesPage;
