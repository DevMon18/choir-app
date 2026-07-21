import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getActiveAnnouncements } from '@/app/admin/announcements/actions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

const DashboardPage = async () => {
  const profile = await getProfile();

  if (!profile) {
    redirect('/login');
  }

  const isAdmin = ['super_admin', 'director', 'secretary'].includes(profile.role);
  const announcements = await getActiveAnnouncements();

  return (
    <DashboardClient profile={profile} isAdmin={isAdmin} announcements={announcements} />
  );
};

export default DashboardPage;
