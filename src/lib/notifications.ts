import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser, sendPushToAll, PushPayload } from '@/lib/push';

export type NotificationType =
  | 'thread_reaction'
  | 'thread_comment'
  | 'comment_reply'
  | 'comment_reaction'
  | 'thread_mention'
  | 'thread_acknowledgement_required'
  | 'announcement'
  | 'direct_message'
  | 'task_assigned'
  | 'document_signature_required'
  | 'dues_payment'
  | 'general';

export interface CreateNotificationParams {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string;
  metadata?: Record<string, any>;
  sendPush?: boolean;
}

export interface BatchNotificationParams {
  recipientIds: string[];
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl: string;
  metadata?: Record<string, any>;
  sendPush?: boolean;
}

/**
 * Creates a single in-app notification and optionally dispatches web/native push.
 * Prevents self-notification if recipientId matches actorId.
 */
export async function createNotification({
  recipientId,
  actorId,
  type,
  title,
  body,
  linkUrl,
  metadata = {},
  sendPush = true,
}: CreateNotificationParams) {
  // Prevent sending notification to self
  if (actorId && recipientId === actorId) {
    return { success: true, skipped: true };
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_id: recipientId,
        actor_id: actorId || null,
        type,
        title,
        body,
        link_url: linkUrl,
        metadata,
        is_read: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating in-app notification:', error);
      return { success: false, error: error.message };
    }

    // Optionally dispatch background push notification
    if (sendPush) {
      const pushPayload: PushPayload = {
        title,
        body,
        url: linkUrl,
      };
      sendPushToUser(recipientId, pushPayload).catch((pushErr) => {
        console.warn('Background push error in createNotification:', pushErr);
      });
    }

    return { success: true, notificationId: data?.id };
  } catch (err: any) {
    console.error('General error in createNotification:', err);
    return { success: false, error: err?.message || 'Unknown notification error' };
  }
}

/**
 * Creates multiple in-app notifications in batch (e.g. for announcements, minutes acknowledgements).
 * Filters out actorId if present.
 */
export async function createBatchNotifications({
  recipientIds,
  actorId,
  type,
  title,
  body,
  linkUrl,
  metadata = {},
  sendPush = true,
}: BatchNotificationParams) {
  // Filter out the actor and deduplicate
  const uniqueRecipients = Array.from(
    new Set(recipientIds.filter((id) => id && id !== actorId))
  );

  if (uniqueRecipients.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const supabase = createAdminClient();

    const rows = uniqueRecipients.map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: actorId || null,
      type,
      title,
      body,
      link_url: linkUrl,
      metadata,
      is_read: false,
    }));

    const { error } = await supabase.from('notifications').insert(rows);

    if (error) {
      console.error('Error creating batch in-app notifications:', error);
      return { success: false, error: error.message };
    }

    // Optionally dispatch push to all
    if (sendPush) {
      const pushPayload: PushPayload = {
        title,
        body,
        url: linkUrl,
      };

      sendPushToAll(pushPayload, {
        excludeUserIds: actorId ? [actorId] : [],
      }).catch((pushErr) => {
        console.warn('Background push error in createBatchNotifications:', pushErr);
      });
    }

    return { success: true, count: uniqueRecipients.length };
  } catch (err: any) {
    console.error('General error in createBatchNotifications:', err);
    return { success: false, error: err?.message || 'Unknown batch error' };
  }
}
