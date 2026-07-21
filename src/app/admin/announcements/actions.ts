'use server';

import { createClient } from '@/lib/supabase/server';
import { sendPushToAll } from '@/lib/push';
import { revalidatePath } from 'next/cache';

export interface AnnouncementInput {
  title: string;
  body: string;
  priority: 'normal' | 'urgent';
  is_pinned: boolean;
  starts_at?: string;
  ends_at?: string | null;
}

export async function getAnnouncements() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('announcements')
      .select('*, profiles:created_by(full_name)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('getAnnouncements failed:', err);
    return [];
  }
}

export async function getActiveAnnouncements() {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('announcements')
      .select('*, profiles:created_by(full_name)')
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active announcements:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('getActiveAnnouncements failed:', err);
    return [];
  }
}

export async function createAnnouncement(input: AnnouncementInput) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
      return { error: 'Unauthorized: Privileged admin role required' };
    }

    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: input.title,
        body: input.body,
        priority: input.priority,
        is_pinned: input.is_pinned,
        starts_at: input.starts_at || new Date().toISOString(),
        ends_at: input.ends_at || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    // Trigger Push Notification for all announcements
    sendPushToAll({
      title: input.priority === 'urgent' ? `🚨 Urgent: ${input.title}` : `📢 Announcement: ${input.title}`,
      body: input.body.substring(0, 120),
      url: '/dashboard',
    }).catch((err) => console.error('Failed sending push alert:', err));

    revalidatePath('/dashboard');
    revalidatePath('/admin/announcements');
    return { success: true, announcement: data };
  } catch (err: any) {
    return { error: err.message || 'Failed to create announcement' };
  }
}

export async function updateAnnouncement(id: string, input: Partial<AnnouncementInput>) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
      return { error: 'Unauthorized' };
    }

    const { error } = await supabase
      .from('announcements')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin/announcements');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to update announcement' };
  }
}

export async function deleteAnnouncement(id: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
      return { error: 'Unauthorized' };
    }

    const { error } = await supabase.from('announcements').delete().eq('id', id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin/announcements');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to delete announcement' };
  }
}
