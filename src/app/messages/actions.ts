'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimitMessage } from '@/lib/ratelimit';
import { sendPushToUser } from '@/lib/push';

export interface ConversationItem {
  id: string;
  otherUser: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    voice_part: string | null;
    role: string;
    isDeletedUser?: boolean;
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

    // Gather all target user IDs and conversation IDs
    const otherUserIds = convs.map((c) =>
      c.participant_one === user.id ? c.participant_two : c.participant_one
    );
    const convIds = convs.map((c) => c.id);

    const adminSupabase = createAdminClient();

    // ✅ FIX: 3 bulk queries instead of N×2 per-conversation queries
    const [{ data: profiles }, { data: allLastMessages }, { data: allUnreadMessages }] = await Promise.all([
      // Bulk fetch all participant profiles
      adminSupabase
        .from('profiles')
        .select('id, full_name, avatar_url, voice_part, role')
        .in('id', otherUserIds),
      // Bulk fetch all messages (ordered desc) — pick first per conversation in JS
      supabase
        .from('messages')
        .select('body, created_at, sender_id, conversation_id')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
      // Bulk fetch all unread messages across all conversations
      supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)
        .is('read_at', null),
    ]);

    // Build O(1) lookup maps
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    // Last message per conversation (messages ordered desc — first match wins)
    const lastMsgMap = new Map<string, { body: string; created_at: string; sender_id: string }>();
    for (const msg of (allLastMessages || [])) {
      if (!lastMsgMap.has(msg.conversation_id)) {
        lastMsgMap.set(msg.conversation_id, {
          body: msg.body,
          created_at: msg.created_at,
          sender_id: msg.sender_id,
        });
      }
    }

    // Unread count per conversation
    const unreadMap = new Map<string, number>();
    for (const msg of (allUnreadMessages || [])) {
      unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) ?? 0) + 1);
    }

    const result: ConversationItem[] = convs.map((c) => {
      const otherId = c.participant_one === user.id ? c.participant_two : c.participant_one;
      const fetchedProfile = profileMap.get(otherId);

      const otherUser = fetchedProfile
        ? { ...fetchedProfile, isDeletedUser: false }
        : {
            id: otherId,
            full_name: 'Removed Account',
            avatar_url: null,
            voice_part: null,
            role: 'member',
            isDeletedUser: true,
          };

      return {
        id: c.id,
        otherUser,
        lastMessage: lastMsgMap.get(c.id) ?? null,
        unreadCount: unreadMap.get(c.id) ?? 0,
        last_message_at: c.last_message_at,
      };
    });

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

    const adminSupabase = createAdminClient();

    // Fetch otherUser profile and messages concurrently via Promise.all
    const [
      { data: otherUser },
      { data: msgs, error: msgErr },
    ] = await Promise.all([
      adminSupabase
        .from('profiles')
        .select('id, full_name, avatar_url, voice_part, role')
        .eq('id', otherId)
        .maybeSingle(),
      supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
    ]);

    if (msgErr) return { error: msgErr.message };

    return {
      messages: (msgs || []) as MessageItem[],
      otherUser: otherUser
        ? { ...otherUser, isDeletedUser: false }
        : { id: otherId, full_name: 'Removed Account', avatar_url: null, voice_part: null, role: 'member', isDeletedUser: true },
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

    const rateLimit = await checkRateLimitMessage(user.id);
    if (!rateLimit.success) {
      return { error: 'Messaging rate limit exceeded. Please wait a moment before sending another message.' };
    }

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

    // Asynchronously dispatch targeted Push Notification to recipient
    (async () => {
      try {
        const adminSupabase = createAdminClient();
        const [{ data: conv }, { data: senderProfile }] = await Promise.all([
          adminSupabase
            .from('conversations')
            .select('participant_one, participant_two')
            .eq('id', conversationId)
            .single(),
          adminSupabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single(),
        ]);

        if (conv) {
          const recipientId = conv.participant_one === user.id ? conv.participant_two : conv.participant_one;
          const senderName = senderProfile?.full_name || 'Choir Member';
          await sendPushToUser(recipientId, {
            title: `💬 New message from ${senderName}`,
            body: body.trim().substring(0, 120),
            url: `/messages/${conversationId}`,
            icon: '/collective-logo.png',
          });
        }
      } catch (pushErr) {
        console.error('Error dispatching message push notification:', pushErr);
      }
    })();

    revalidatePath('/messages');
    revalidatePath(`/messages/${conversationId}`);

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

    revalidatePath('/messages');
  } catch (err) {
    console.error('markMessagesAsRead error:', err);
  }
}

export async function deleteConversation(conversationId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    // Verify membership
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, participant_one, participant_two')
      .eq('id', conversationId)
      .single();

    if (!conv || (conv.participant_one !== user.id && conv.participant_two !== user.id)) {
      return { error: 'Conversation not found or unauthorized' };
    }

    const adminSupabase = createAdminClient();

    // 1. Delete all messages inside this conversation
    await adminSupabase
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    // 2. Delete the conversation record
    const { error: delErr } = await adminSupabase
      .from('conversations')
      .delete()
      .eq('id', conversationId);

    if (delErr) {
      return { error: delErr.message };
    }

    revalidatePath('/messages');
    revalidatePath(`/messages/${conversationId}`);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete conversation' };
  }
}

export async function deleteMessage(messageId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const { data: msg } = await supabase
      .from('messages')
      .select('id, sender_id, conversation_id')
      .eq('id', messageId)
      .single();

    if (!msg || msg.sender_id !== user.id) {
      return { error: 'Unauthorized to delete this message' };
    }

    const adminSupabase = createAdminClient();
    await adminSupabase.from('messages').delete().eq('id', messageId);

    revalidatePath(`/messages/${msg.conversation_id}`);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete message' };
  }
}
