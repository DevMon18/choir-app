import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LiveSessionClient from './LiveSessionClient';

export const dynamic = 'force-dynamic';

// Metadata for PWA / mobile
export const metadata = {
  title: 'Live Session — Choir Collective',
  description: 'Follow along with the choir in real time',
};

const LivePage = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single();

  if (!profile || ['pending', 'rejected'].includes(profile.role)) {
    redirect('/dashboard');
  }

  // Fetch current active live session
  const { data: activeSession } = await supabase
    .from('live_sessions')
    .select('id, sequence_id, active_song_id, director_semitones, scroll_speed, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch the active song if session exists
  let activeSong = null;
  if (activeSession?.active_song_id) {
    const { data: song } = await supabase
      .from('songs')
      .select('id, title, composer, category, lyrics')
      .eq('id', activeSession.active_song_id)
      .single();
    activeSong = song;
  }

  // Fetch all songs for client-side lookup during realtime updates
  const { data: allSongs } = await supabase
    .from('songs')
    .select('id, title, composer, category, lyrics')
    .eq('is_archived', false);

  // Fetch sequence items for the active session to display parts of Mass (roles) and navigation
  let activeSequenceItems: any[] = [];
  if (activeSession?.sequence_id) {
    const { data: items } = await supabase
      .from('sequence_items')
      .select(`
        id,
        order_index,
        role_in_mass,
        song_id,
        songs ( id, title, composer, category, lyrics )
      `)
      .eq('sequence_id', activeSession.sequence_id)
      .order('order_index', { ascending: true });
    activeSequenceItems = items || [];
  }

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
