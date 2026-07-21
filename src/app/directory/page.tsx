import dynamicImport from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';

const DirectoryClient = dynamicImport(
  () => import('./DirectoryClient').then((m) => m.DirectoryClient),
  { ssr: true }
);

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Member Directory — Choir Collective',
  description: 'Browse the choir member directory',
};

const DirectoryPage = async () => {
  const profile = await getProfile();
  if (!profile) redirect('/login');

  if (['pending', 'rejected'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

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
