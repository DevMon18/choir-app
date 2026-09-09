'use server';

import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/user';
import { NotificationType } from '@/lib/notifications';

export interface InAppNotification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link_url: string;
  metadata: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: string;
  } | null;
}

/**
 * Get notifications for the currently logged-in user.
 */
export async function getNotifications(options: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
} = {}): Promise<{
  data: InAppNotification[];
  unreadCount: number;
  totalCount: number;
  error?: string;
}> {
  const profile = await getProfile();
  if (!profile) return { data: [], unreadCount: 0, totalCount: 0, error: 'Unauthorized' };

  const supabase = await createClient();
  const limit = options.limit || 30;
  const offset = options.offset || 0;

  try {
    // 1. Fetch unread count
    const { count: unreadCount, error: countErr } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', profile.id)
      .eq('is_read', false);

    if (countErr) {
      console.error('Error counting unread notifications:', countErr);
    }

    // 2. Query notifications list
    let query = supabase
      .from('notifications')
      .select(`
        id,
        recipient_id,
        actor_id,
        type,
        title,
        body,
        link_url,
        metadata,
        is_read,
        read_at,
        created_at,
        actor:actor_id(id, full_name, avatar_url, role)
      `, { count: 'exact' })
      .eq('recipient_id', profile.id);

    if (options.unreadOnly) {
      query = query.eq('is_read', false);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count: totalCount, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return { data: [], unreadCount: unreadCount || 0, totalCount: 0, error: error.message };
    }

    return {
      data: (data || []) as unknown as InAppNotification[],
      unreadCount: unreadCount || 0,
      totalCount: totalCount || 0,
    };
  } catch (err: any) {
    console.error('Error in getNotifications action:', err);
    return { data: [], unreadCount: 0, totalCount: 0, error: err?.message || 'Server error' };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('recipient_id', profile.id);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to mark as read' };
  }
}

/**
 * Mark all unread notifications as read for current user.
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('recipient_id', profile.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to mark all as read' };
  }
}

/**
 * Delete a specific notification.
 */
export async function deleteNotification(notificationId: string): Promise<{ success: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', profile.id);

    if (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete notification' };
  }
}

/**
 * Clear all read notifications for current user.
 */
export async function clearReadNotifications(): Promise<{ success: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile) return { success: false, error: 'Unauthorized' };

  const supabase = await createClient();

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('recipient_id', profile.id)
      .eq('is_read', true);

    if (error) {
      console.error('Error clearing read notifications:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to clear read notifications' };
  }
}
