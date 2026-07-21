'use server';
// Note: We use server actions in a separate file with 'use server'

import { createClient } from '@/lib/supabase/server';

export async function savePushSubscriptionAction(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      console.error('Failed to save push subscription:', error);
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to save push subscription' };
  }
}

export async function removePushSubscriptionAction(endpoint: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint)
      .eq('user_id', user.id);

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Failed to remove push subscription' };
  }
}

export async function saveFCMTokenAction(token: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('saveFCMTokenAction: User not authenticated');
      return { error: 'Not authenticated' };
    }

    const { data, error } = await supabase.from('fcm_tokens').upsert(
      {
        user_id: user.id,
        token: token,
      },
      { onConflict: 'token' }
    ).select();

    if (error) {
      console.error('Failed to save FCM token to database:', error);
      return { error: error.message };
    }

    console.log('FCM Token saved successfully in database for user:', user.id);
    return { success: true, data };
  } catch (err: any) {
    console.error('Exception in saveFCMTokenAction:', err);
    return { error: err.message || 'Failed to save FCM token' };
  }
}
