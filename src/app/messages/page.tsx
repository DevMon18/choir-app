import React from 'react';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getConversations } from './actions';
import { MessagesInboxClient } from './MessagesInboxClient';

export const dynamic = 'force-dynamic';

export default async function MessagesPage() {
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const { conversations, error } = await getConversations();

  return (
    <MessagesInboxClient
      currentUserProfile={{
        id: currentProfile.id,
        full_name: currentProfile.full_name,
        role: currentProfile.role,
      }}
      conversations={conversations || []}
    />
  );
}
