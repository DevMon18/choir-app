import dynamicImport from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getAnnouncements } from './actions';

const AnnouncementsManagerClient = dynamicImport(
  () => import('./AnnouncementsManagerClient').then((m) => m.AnnouncementsManagerClient),
  { ssr: true }
);

export default async function AnnouncementsPage() {
  const profile = await getProfile();

  if (!profile || profile.role === 'pending' || profile.role === 'rejected') {
    redirect('/login');
  }

  if (!['super_admin', 'director', 'secretary'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const announcements = await getAnnouncements();

  return (
    <AnnouncementsManagerClient
      currentUserProfile={profile}
      initialAnnouncements={announcements}
    />
  );
}
