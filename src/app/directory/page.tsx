import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DirectoryClient } from './DirectoryClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Member Directory — Choir Collective',
  description: 'Browse the choir member directory',
};

const DirectoryPage = async () => {
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

  // Use the server-masked public_directory view — never raw profiles
  const { data: members } = await supabase
    .from('public_directory')
    .select('id, full_name, role, voice_part, join_date, phone, address, avatar_url')
    .order('full_name');

  return (
    <DirectoryClient
      profile={profile}
      members={members ?? []}
    />
  );
};

export default DirectoryPage;
