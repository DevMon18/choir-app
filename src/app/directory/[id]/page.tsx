import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getMemberProfileWithPhotos } from './actions';
import { MemberProfileClient } from './MemberProfileClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberProfilePage({ params }: PageProps) {
  const { id: memberId } = await params;
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const result = await getMemberProfileWithPhotos(memberId);

  if (result.error || !result.profile) {
    notFound();
  }

  return (
    <MemberProfileClient
      currentUserProfile={{
        id: currentProfile.id,
        full_name: currentProfile.full_name,
        role: currentProfile.role,
      }}
      targetProfile={result.profile}
      initialPhotos={result.photos || []}
      isOwner={result.isOwner || false}
      isAdmin={result.isAdmin || false}
    />
  );
}
