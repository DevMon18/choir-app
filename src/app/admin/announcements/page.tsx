import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getAnnouncements } from './actions';
import { AnnouncementsManagerClient } from './AnnouncementsManagerClient';

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
