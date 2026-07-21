import webpush from 'web-push';
import crypto from 'crypto';
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

export interface PushReport {
  webPush: {
    total: number;
    success: number;
    failed: number;
    errors: string[];
  };
  fcm: {
    total: number;
    success: number;
    failed: number;
    errors: string[];
  };
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
}): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp,
    iat,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
  const jwtInput = `${encodedHeader}.${encodedClaimSet}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(jwtInput);
  signer.end();

  const privateKey = serviceAccount.private_key.replace(/\\n/g, '\n');
  const signature = signer.sign(privateKey).toString('base64url');

  const jwt = `${jwtInput}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to obtain Google access token: ${errorText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

export const sendPushToAll = async (payload: PushPayload): Promise<PushReport> => {
  const report: PushReport = {
    webPush: { total: 0, success: 0, failed: 0, errors: [] },
    fcm: { total: 0, success: 0, failed: 0, errors: [] },
  };

  try {
    const adminSupabase = createAdminClient();

    // 1. Web Push Path
    const { data: subs, error: subError } = await adminSupabase
      .from('push_subscriptions')
      .select('*');

    if (subError) {
      report.webPush.errors.push(`Database error: ${subError.message}`);
    } else if (subs && subs.length > 0) {
      report.webPush.total = subs.length;
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
            report.webPush.success++;
          } catch (err: any) {
            report.webPush.failed++;
            report.webPush.errors.push(`Endpoint ${sub.endpoint}: ${err.message || err}`);
            if (err.statusCode === 404 || err.statusCode === 410) {
              expiredOrInvalidIds.push(sub.id);
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
    }

    // 2. Native FCM Path
    const { data: fcmData, error: fcmError } = await adminSupabase
      .from('fcm_tokens')
      .select('*');

    if (fcmError) {
      report.fcm.errors.push(`Database error: ${fcmError.message}`);
    } else if (fcmData && fcmData.length > 0) {
      report.fcm.total = fcmData.length;

      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!serviceAccountStr) {
        const errMsg = 'FIREBASE_SERVICE_ACCOUNT environment variable is not defined.';
        report.fcm.failed = fcmData.length;
        report.fcm.errors.push(errMsg);
        console.warn(errMsg);
      } else {
        try {
          const serviceAccount = JSON.parse(serviceAccountStr);
          const projectId = serviceAccount.project_id;
          const accessToken = await getAccessToken(serviceAccount);

          const expiredOrInvalidTokens: string[] = [];

          await Promise.all(
            fcmData.map(async (fcmEntry) => {
              const token = fcmEntry.token;
              try {
                const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    message: {
                      token: token,
                      notification: {
                        title: payload.title,
                        body: payload.body,
                      },
                      data: {
                        url: payload.url || '/dashboard',
                      },
                      android: {
                        priority: 'high',
                        notification: {
                          sound: 'default',
                          channel_id: 'choir_alerts',
                        },
                      },
                    },
                  }),
                });

                if (res.ok) {
                  report.fcm.success++;
                } else {
                  const errBody = await res.text();
                  report.fcm.failed++;
                  report.fcm.errors.push(`Token ${token.substring(0, 10)}...: Status ${res.status} - ${errBody}`);
                  if (res.status === 400 || res.status === 404) {
                    expiredOrInvalidTokens.push(token);
                  }
                }
              } catch (err: any) {
                report.fcm.failed++;
                report.fcm.errors.push(`Token ${token.substring(0, 10)}...: ${err.message || err}`);
              }
            })
          );

          if (expiredOrInvalidTokens.length > 0) {
            await adminSupabase
              .from('fcm_tokens')
              .delete()
              .in('token', expiredOrInvalidTokens);
          }
        } catch (err: any) {
          report.fcm.failed = fcmData.length;
          report.fcm.errors.push(`FCM Authorization / General failure: ${err.message || err}`);
        }
      }
    }
  } catch (err: any) {
    console.error('General failure in sendPushToAll:', err);
    report.webPush.errors.push(`General error: ${err.message || err}`);
    report.fcm.errors.push(`General error: ${err.message || err}`);
  }

  return report;
};
