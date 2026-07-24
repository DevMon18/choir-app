import dynamicImport from 'next/dynamic';
import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { createClient } from '@/lib/supabase/server';
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

  const supabase = await createClient();

  // Fetch fullProfile, rawPhotos, and announcements concurrently via Promise.all
  const [
    { data: fullProfile },
    { data: rawPhotos },
    announcements,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single(),
    supabase
      .from('profile_photos')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }),
    getActiveAnnouncements(),
  ]);

  const initialPhotos = (rawPhotos || []).map((p) => {
    const { data: { publicUrl } } = supabase.storage
      .from('profile_photos')
      .getPublicUrl(p.storage_path);
    return {
      ...p,
      publicUrl,
    };
  });

  const isAdmin = ['super_admin', 'director', 'secretary'].includes(profile.role);

  return (
    <DashboardClient
      profile={{
        id: profile.id,
        full_name: fullProfile?.full_name || profile.full_name || '',
        email: fullProfile?.email || profile.email || '',
        role: profile.role,
        voice_part: fullProfile?.voice_part || '',
        avatar_url: fullProfile?.avatar_url || null,
        cover_url: fullProfile?.cover_url || null,
        cover_position: fullProfile?.cover_position || '50%',
        interests: Array.isArray(fullProfile?.interests) ? fullProfile.interests : [],
        created_at: profile.created_at || '',
      }}
      initialPhotos={initialPhotos}
      isAdmin={isAdmin}
      announcements={announcements}
    />
  );
};

export default DashboardPage;
