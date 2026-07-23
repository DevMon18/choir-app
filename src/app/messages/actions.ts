'use server';

import { createClient } from '@/lib/supabase/server';

export interface ConversationItem {
  id: string;
  otherUser: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    voice_part: string | null;
    role: string;
  };
  lastMessage: {
    body: string;
    created_at: string;
    sender_id: string;
  } | null;
  unreadCount: number;
  last_message_at: string;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export async function getOrCreateConversation(targetUserId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };
    if (user.id === targetUserId) return { error: 'Cannot message yourself' };

    // Canonical ordering to avoid duplicate conversation pairs
    const [p1, p2] = [user.id, targetUserId].sort();

    // Check existing
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_one', p1)
      .eq('participant_two', p2)
      .maybeSingle();

    if (existing) {
      return { conversationId: existing.id };
    }

    // Insert new conversation verifying with .select()
    const { data: created, error: insertErr } = await supabase
      .from('conversations')
      .insert({
        participant_one: p1,
        participant_two: p2,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr || !created) {
      return { error: insertErr?.message || 'Failed to create conversation' };
    }

    return { conversationId: created.id };
  } catch (err: any) {
    return { error: err.message || 'Server error' };
  }
}

export async function getConversations(): Promise<{ conversations?: ConversationItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    // Fetch conversations where user is participant
    const { data: convs, error: convErr } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    if (convErr) return { error: convErr.message };
    if (!convs || convs.length === 0) return { conversations: [] };

    // Gather all target user IDs
    const otherUserIds = convs.map((c) =>
      c.participant_one === user.id ? c.participant_two : c.participant_one
    );

    // Fetch profiles of participants
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, voice_part, role')
      .in('id', otherUserIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const result: ConversationItem[] = await Promise.all(
      convs.map(async (c) => {
        const otherId = c.participant_one === user.id ? c.participant_two : c.participant_one;
        const otherUser = profileMap.get(otherId) || {
          id: otherId,
          full_name: 'Choir Member',
          avatar_url: null,
          voice_part: null,
          role: 'member',
        };

        // Fetch last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('body, created_at, sender_id')
          .eq('conversation_id', c.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Count unread
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', c.id)
          .neq('sender_id', user.id)
          .is('read_at', null);

        return {
          id: c.id,
          otherUser,
          lastMessage: lastMsg || null,
          unreadCount: unreadCount || 0,
          last_message_at: c.last_message_at,
        };
      })
    );

    return { conversations: result };
  } catch (err: any) {
    return { error: err.message || 'Failed to load inbox' };
  }
}

export async function getMessages(conversationId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    // Check membership
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, participant_one, participant_two')
      .eq('id', conversationId)
      .single();

    if (!conv || (conv.participant_one !== user.id && conv.participant_two !== user.id)) {
      return { error: 'Unauthorized' };
    }

    const otherId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;

    const { data: otherUser } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, voice_part, role')
      .eq('id', otherId)
      .single();

    const { data: msgs, error: msgErr } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (msgErr) return { error: msgErr.message };

    return {
      messages: (msgs || []) as MessageItem[],
      otherUser: otherUser || { id: otherId, full_name: 'Choir Member', avatar_url: null, voice_part: null, role: 'member' },
      currentUserId: user.id,
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to load messages' };
  }
}

export async function sendMessage(conversationId: string, body: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };
    if (!body.trim()) return { error: 'Message cannot be empty' };

    // Insert message verifying with .select()
    const { data: inserted, error: insertErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: body.trim(),
      })
      .select()
      .single();

    if (insertErr || !inserted) {
      return { error: insertErr?.message || 'Failed to send message' };
    }

    // Update last_message_at timestamp on conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return { message: inserted as MessageItem };
  } catch (err: any) {
    return { error: err.message || 'Send message failed' };
  }
}

export async function markMessagesAsRead(conversationId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .is('read_at', null);
  } catch (err) {
    console.error('markMessagesAsRead error:', err);
  }
}
