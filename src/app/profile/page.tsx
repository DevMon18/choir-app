import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileClient from './ProfileClient';

export const dynamic = 'force-dynamic';

const ProfilePage = async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    redirect('/login');
  }

  const isAuthorized = ['super_admin', 'director', 'secretary', 'treasurer', 'member'].includes(profile.role);
  if (!isAuthorized) {
    redirect('/pending-approval');
  }

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
      isAdmin={['super_admin', 'director', 'secretary'].includes(profile.role)}
    />
  );
};

export default ProfilePage;
