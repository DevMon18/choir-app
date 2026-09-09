import dynamicImport from 'next/dynamic';
import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { createClient } from '@/lib/supabase/server';
import { getThreadPosts } from './actions';
import { getActiveAnnouncements } from '@/app/admin/announcements/actions';
import { checkAndTriggerTodayBirthdayPush } from '@/lib/birthdayPushHelper';

const FeedClient = dynamicImport(() => import('./FeedClient'), { ssr: true });

export const dynamic = 'force-dynamic';

const DashboardFeedPage = async () => {
  const profile = await getProfile();

  if (!profile) {
    redirect('/login');
  }

  // Trigger today's birthday push if not yet executed today (fire & forget non-blocking)
  checkAndTriggerTodayBirthdayPush().catch(console.error);

  const supabase = await createClient();

  // Fetch initial posts, members roster for @mentions, and announcements in parallel
  const [
    postsRes,
    { data: membersData },
    announcements,
    { data: fullProfile },
  ] = await Promise.all([
    getThreadPosts({ limit: 30 }),
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, voice_part')
      .not('role', 'in', '("pending","rejected")')
      .order('full_name', { ascending: true }),
    getActiveAnnouncements(),
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single(),
  ]);

  const initialPosts = postsRes.data || [];
  const members = membersData || [];

  return (
    <React.Suspense fallback={null}>
      <FeedClient
        initialPosts={initialPosts}
        currentUserProfile={{
          id: profile.id,
          full_name: fullProfile?.full_name || profile.full_name || '',
          email: fullProfile?.email || profile.email || '',
          role: profile.role,
          voice_part: fullProfile?.voice_part || '',
          avatar_url: fullProfile?.avatar_url || null,
          created_at: profile.created_at || '',
        }}
        members={members}
        announcements={announcements || []}
      />
    </React.Suspense>
  );
};

export default DashboardFeedPage;
