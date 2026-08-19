import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAllTasksAdmin, getPendingRequestsAdmin, getCustomGroupsAdmin } from './actions';
import { TaskManagerClient } from './TaskManagerClient';
import { OFFICER_ROLES } from '@/app/tasks/types';

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

  if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
    redirect('/tasks');
  }

  // Fetch initial tasks, requests, groups, and reference data concurrently
  const [
    initialTasks,
    initialRequests,
    initialCustomGroups,
    { data: membersData },
    { data: songsData },
    { data: sequencesData },
  ] = await Promise.all([
    getAllTasksAdmin(),
    getPendingRequestsAdmin(),
    getCustomGroupsAdmin(),
    supabase
      .from('profiles')
      .select('id, full_name, voice_part, role, avatar_url')
      .not('role', 'in', '("pending","rejected")')
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
    avatar_url: m.avatar_url || null,
    role: m.role || 'member',
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
      initialCustomGroups={initialCustomGroups}
      membersList={membersList}
      songsList={songsList}
      sequencesList={sequencesList}
    />
  );
}
