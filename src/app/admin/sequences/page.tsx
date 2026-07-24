import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { SequenceManagerClient } from './SequenceManagerClient';

export const dynamic = 'force-dynamic';

const AdminSequencesPage = async () => {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch sequences, songs, and activeSession concurrently via Promise.all
  const [
    { data: sequences },
    { data: songs },
    { data: activeSession },
  ] = await Promise.all([
    supabase
      .from('mass_sequences')
      .select(`
        id, title, description, scheduled_at,
        sequence_items (
          id, order_index, notes, role_in_mass,
          songs ( id, title, composer, category, lyrics )
        )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('songs')
      .select('id, title, composer, category, lyrics')
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

  return (
    <SequenceManagerClient
      profile={profile}
      sequences={(sequences ?? []) as unknown as Parameters<typeof SequenceManagerClient>[0]['sequences']}
      songs={songs ?? []}
      activeSession={activeSession}
    />
  );
};

export default AdminSequencesPage;
