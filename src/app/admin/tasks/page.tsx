import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllTasksAdmin, getPendingRequestsAdmin } from './actions';
import { TaskManagerClient } from './TaskManagerClient';

export const dynamic = 'force-dynamic';

export default async function AdminTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url')
    .eq('id', user.id)
    .single();

  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    redirect('/tasks');
  }

  // Fetch initial tasks, requests, and reference data concurrently
  const [
    initialTasks,
    initialRequests,
    { data: membersData },
    { data: songsData },
    { data: sequencesData },
  ] = await Promise.all([
    getAllTasksAdmin(),
    getPendingRequestsAdmin(),
    supabase
      .from('profiles')
      .select('id, full_name, voice_part')
      .in('role', ['super_admin', 'director', 'secretary', 'treasurer', 'member'])
      .order('full_name', { ascending: true }),
    supabase
      .from('songs')
      .select('id, title')
      .eq('is_archived', false)
      .order('title', { ascending: true }),
    supabase
      .from('mass_sequences')
      .select('id, title')
      .order('created_at', { ascending: false }),
  ]);

  const membersList = (membersData || []).map((m: any) => ({
    id: m.id,
    full_name: m.full_name,
    voice_part: m.voice_part || null,
  }));

  const songsList = (songsData || []).map((s: any) => ({
    id: s.id,
    title: s.title,
  }));

  const sequencesList = (sequencesData || []).map((sq: any) => ({
    id: sq.id,
    title: sq.title,
  }));

  return (
    <TaskManagerClient
      currentUserProfile={{
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
      }}
      initialTasks={initialTasks}
      initialRequests={initialRequests}
      membersList={membersList}
      songsList={songsList}
      sequencesList={sequencesList}
    />
  );
}
