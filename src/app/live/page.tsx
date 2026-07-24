import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import LiveSessionClient from './LiveSessionClient';

export const dynamic = 'force-dynamic';

// Metadata for PWA / mobile
export const metadata = {
  title: 'Live Session — Choir Collective',
  description: 'Follow along with the choir in real time',
};

const songCategorySelect = `
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

const LivePage = async () => {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  if (['pending', 'rejected'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch activeSession and allSongs concurrently via Promise.all
  const [
    { data: activeSession },
    { data: rawAllSongs },
  ] = await Promise.all([
    supabase
      .from('live_sessions')
      .select('id, sequence_id, active_song_id, director_semitones, scroll_speed, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('songs')
      .select(songCategorySelect)
      .eq('is_archived', false),
  ]);

  // If activeSession exists, fetch activeSong and activeSequenceItems concurrently via Promise.all
  let activeSong = null;
  let activeSequenceItems: any[] = [];

  if (activeSession) {
    const [songRes, itemsRes] = await Promise.all([
      activeSession.active_song_id
        ? supabase
            .from('songs')
            .select(songCategorySelect)
            .eq('id', activeSession.active_song_id)
            .single()
        : Promise.resolve({ data: null }),
      activeSession.sequence_id
        ? supabase
            .from('sequence_items')
            .select(`
              id,
              order_index,
              role_in_mass,
              song_id,
              songs ( ${songCategorySelect} )
            `)
            .eq('sequence_id', activeSession.sequence_id)
            .order('order_index', { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    activeSong = mapSong(songRes.data);
    activeSequenceItems = (itemsRes.data || []).map((item: any) => ({
      ...item,
      songs: mapSong(item.songs),
    }));
  }

  const allSongs = (rawAllSongs || []).map(mapSong);

  return (
    <LiveSessionClient
      profile={profile}
      initialSession={activeSession}
      initialSong={activeSong}
      songs={allSongs ?? []}
      activeSequenceItems={activeSequenceItems}
    />
  );
};

export default LivePage;
