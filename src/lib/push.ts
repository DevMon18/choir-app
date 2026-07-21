import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BIW1Er33h_q1XsZcxVpLtPo27iWlgcaplHvN_HaFw7KAlkV9FqWvVwmBihR5ViY9gk7evMAWo69cYadsjCK1eRA';

const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY || 'mDVQIf0FgRrFMPaVkVukqakqu85JvPltekiYfy3lXyI';

webpush.setVapidDetails(
  'mailto:support@choircollective.app',
  vapidPublicKey,
  vapidPrivateKey
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export const sendPushToAll = async (payload: PushPayload) => {
  try {
    const adminSupabase = createAdminClient();
    const { data: subs, error } = await adminSupabase
      .from('push_subscriptions')
      .select('*');

    if (error || !subs || subs.length === 0) {
      console.log('No push subscriptions found to notify.');
      return;
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/dashboard',
      icon: payload.icon || '/collective-logo.png',
    });

    const expiredOrInvalidIds: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, notificationPayload, {
            headers: {
              Urgency: 'high',
              TTL: '86400',
            },
          });
        } catch (err: any) {
          // If subscription has expired or is invalid (404/410), mark for deletion
          if (err.statusCode === 404 || err.statusCode === 410) {
            expiredOrInvalidIds.push(sub.id);
          } else {
            console.error(`Failed to send push to endpoint ${sub.endpoint}:`, err);
          }
        }
      })
    );

    if (expiredOrInvalidIds.length > 0) {
      await adminSupabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredOrInvalidIds);
    }

    // 2. Fetch Native FCM Tokens for Android Devices
    const { data: fcmData, error: fcmError } = await adminSupabase
      .from('fcm_tokens')
      .select('*');

    if (!fcmError && fcmData && fcmData.length > 0) {
      const fcmTokens = fcmData.map((f) => f.token);
      const fcmApiKey = process.env.FCM_SERVER_KEY || 'AIzaSyCsXyY5ZKADZko2gT3fMsiFbJ1DiU39Rh4';

      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${fcmApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            registration_ids: fcmTokens,
            notification: {
              title: payload.title,
              body: payload.body,
              sound: 'default',
              click_action: 'https://choir-app-ecru.vercel.app/dashboard',
            },
            data: {
              url: payload.url || '/dashboard',
            },
            priority: 'high',
          }),
        });
        const status = res.status;
        const responseText = await res.text();
        console.log('FCM native broadcast response status:', status);
        if (status !== 200) {
          console.warn('FCM broadcast details:', responseText);
        }
      } catch (err) {
        console.error('Error broadcasting native FCM alerts:', err);
      }
    }
  } catch (err) {
    console.error('Error in sendPushToAll:', err);
  }
};
