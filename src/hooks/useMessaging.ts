'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface ConversationItem {
  id: string;
  otherUser: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    voice_part: string | null;
  };
  lastMessage: {
    body: string;
    created_at: string;
    sender_id: string;
    read_at: string | null;
  } | null;
  unreadCount: number;
}

interface UseMessagingOptions {
  userId: string;
  initialConversations?: ConversationItem[];
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useConversations
 * Fetches user conversations with unread message badges and last message previews.
 */
export function useConversations({ userId, initialConversations, enabled = true }: UseMessagingOptions) {
  const supabase = createClient();

  const fetcher = async (): Promise<ConversationItem[]> => {
    if (!userId) return [];

    const { data: convs, error } = await supabase
      .from('conversations')
      .select(`
        id,
        participant_one,
        participant_two,
        p1:profiles!conversations_participant_one_fkey(id, full_name, avatar_url, voice_part),
        p2:profiles!conversations_participant_two_fkey(id, full_name, avatar_url, voice_part)
      `)
      .or(`participant_one.eq.${userId},participant_two.eq.${userId}`);

    if (error) throw new Error(error.message);

    const formatted: ConversationItem[] = [];

    for (const c of convs || []) {
      const isP1 = c.participant_one === userId;
      const other = isP1 ? (c.p2 as any) : (c.p1 as any);

      // Fetch last message
      const { data: msgs } = await supabase
        .from('messages')
        .select('body, created_at, sender_id, read_at')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1);

      // Fetch unread count
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', userId)
        .is('read_at', null);

      formatted.push({
        id: c.id,
        otherUser: other || { id: '', full_name: 'Unknown Member', avatar_url: null, voice_part: null },
        lastMessage: msgs && msgs.length > 0 ? msgs[0] : null,
        unreadCount: count || 0,
      });
    }

    // Sort by latest message
    return formatted.sort((a, b) => {
      const timeA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
      return timeB - timeA;
    });
  };

  const key = enabled && userId ? ['messaging:conversations', userId] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<ConversationItem[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialConversations,
  });

  return {
    conversations: data || [],
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
