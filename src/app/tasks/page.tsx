import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMyTaskAssignments } from './actions';
import { MyTasksClient } from './MyTasksClient';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
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

  if (!profile) {
    redirect('/login');
  }

  // Fetch initial assignments and choir members concurrently
  const [initialAssignments, { data: membersData }] = await Promise.all([
    getMyTaskAssignments(),
    supabase
      .from('profiles')
      .select('id, full_name, voice_part')
      .in('role', ['super_admin', 'director', 'secretary', 'treasurer', 'member'])
      .order('full_name', { ascending: true }),
  ]);

  const membersList = (membersData || []).map((m: any) => ({
    id: m.id,
    full_name: m.full_name,
    voice_part: m.voice_part || null,
  }));

  return (
    <MyTasksClient
      currentUserProfile={{
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
      }}
      initialAssignments={initialAssignments}
      membersList={membersList}
    />
  );
}
