import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getMessages } from '../actions';
import { ChatClient } from './ChatClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConversationPage({ params }: PageProps) {
  const { id: conversationId } = await params;
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const result = await getMessages(conversationId);

  if (result.error || !result.messages) {
    notFound();
  }

  return (
    <ChatClient
      currentUserProfile={{
        id: currentProfile.id,
        full_name: currentProfile.full_name,
        role: currentProfile.role,
      }}
      conversationId={conversationId}
      initialMessages={result.messages}
      otherUser={result.otherUser}
      currentUserId={result.currentUserId}
    />
  );
}
