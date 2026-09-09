import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getNotifications } from './actions';
import { NotificationsClient } from './NotificationsClient';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const profile = await getProfile();

  if (!profile) {
    redirect('/login');
  }

  const { data: initialNotifications, unreadCount, totalCount } = await getNotifications({
    limit: 60,
  });

  return (
    <NotificationsClient
      profile={profile}
      initialNotifications={initialNotifications || []}
      initialUnreadCount={unreadCount || 0}
      initialTotalCount={totalCount || 0}
    />
  );
}
