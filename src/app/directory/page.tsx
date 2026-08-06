import dynamicImport from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getCache, setCache } from '@/lib/cache';

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

  const cacheKey = 'directory:all_members';
  let members = await getCache<any[]>(cacheKey);

  if (!members) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('public_directory')
      .select('id, full_name, role, voice_part, join_date, phone, address, avatar_url')
      .order('full_name');

    members = data ?? [];
    await setCache(cacheKey, members, 120);
  }

  return (
    <DirectoryClient
      profile={profile}
      members={members}
    />
  );
};

export default DirectoryPage;
