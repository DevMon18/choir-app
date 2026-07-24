import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import ProfileClient from './ProfileClient';

export const dynamic = 'force-dynamic';

const ProfilePage = async () => {
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const isAuthorized = ['super_admin', 'director', 'secretary', 'treasurer', 'member'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/pending-approval');
  }

  const supabase = await createClient();

  // Fetch profile and profile_photos concurrently via Promise.all
  const [
    { data: profile },
    { data: rawPhotos },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', currentProfile.id)
      .single(),
    supabase
      .from('profile_photos')
      .select('*')
      .eq('user_id', currentProfile.id)
      .order('created_at', { ascending: false }),
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

  return (
    <ProfileClient
      profile={{
        id: profile.id,
        full_name: profile.full_name || '',
        email: profile.email || '',
        role: profile.role,
        birthdate: profile.birthdate || null,
        address: profile.address || '',
        phone: profile.phone || '',
        emergency_contact: profile.emergency_contact || '',
        voice_part: profile.voice_part || '',
        is_phone_private: profile.is_phone_private ?? true,
        is_address_private: profile.is_address_private ?? true,
        avatar_url: profile.avatar_url || null,
        created_at: profile.created_at || '',
      }}
      initialPhotos={initialPhotos}
      isAdmin={['super_admin', 'director', 'secretary'].includes(profile.role)}
    />
  );
};

export default ProfilePage;
