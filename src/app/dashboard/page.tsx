import dynamicImport from 'next/dynamic';
import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getActiveAnnouncements } from '@/app/admin/announcements/actions';
import { checkAndTriggerTodayBirthdayPush } from '@/lib/birthdayPushHelper';

const DashboardClient = dynamicImport(() => import('./DashboardClient'), { ssr: true });

export const dynamic = 'force-dynamic';

const DashboardPage = async () => {
  const profile = await getProfile();

  if (!profile) {
    redirect('/login');
  }

  // Trigger today's birthday push if not yet executed today (fire & forget non-blocking)
  checkAndTriggerTodayBirthdayPush().catch(console.error);

  const isAdmin = ['super_admin', 'director', 'secretary'].includes(profile.role);
  const announcements = await getActiveAnnouncements();

  return (
    <DashboardClient profile={profile} isAdmin={isAdmin} announcements={announcements} />
  );
};

export default DashboardPage;
