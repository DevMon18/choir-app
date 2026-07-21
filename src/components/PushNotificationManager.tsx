'use client';

import React, { useEffect, useState } from 'react';
import { savePushSubscriptionAction, saveFCMTokenAction } from '@/app/actions/push-actions';

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const PushNotificationManager = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. If running natively in the Capacitor APK, request native permissions on startup
    const checkAndRequestNativePermissions = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Check & request local notification permissions (for scheduling)
          const localStatus = await LocalNotifications.checkPermissions();
          if (localStatus.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }

          // Listeners for native push notifications (MUST be registered before register() is called)
          await PushNotifications.removeAllListeners();

          await PushNotifications.addListener('registration', async (token) => {
            console.log('FCM registration token acquired:', token.value);
            const res = await saveFCMTokenAction(token.value);
            console.log('Save FCM token result:', res);
          });

          await PushNotifications.addListener('registrationError', (err) => {
            console.error('FCM registration error:', err.error);
          });

          await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
            console.log('Push notification received in foreground:', notification);
            // Re-schedule locally to show a popup heads-up banner if app is currently in foreground
            try {
              await LocalNotifications.schedule({
                notifications: [
                  {
                    title: notification.title || 'Choir Collective Alert',
                    body: notification.body || '',
                    id: Math.floor(Math.random() * 100000),
                    schedule: { at: new Date(Date.now() + 500) },
                    channelId: 'choir_alerts',
                    actionTypeId: '',
                    extra: notification.data || null,
                  },
                ],
              });
            } catch (e) {
              console.error('Failed to schedule local notification from push:', e);
            }
          });

          // Register for native Push Notifications via FCM AFTER listeners are attached
          const pushStatus = await PushNotifications.requestPermissions();
          if (pushStatus.receive === 'granted') {
            await PushNotifications.register();
          }
        } catch (e) {
          console.error('Error requesting native notifications permission:', e);
        }
      }
    };
    checkAndRequestNativePermissions();

    // 2. Initialize native Android Notification channels if available via Capacitor
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      try {
        LocalNotifications.createChannel({
          id: 'choir_alerts',
          name: 'Choir Collective Alerts',
          description: 'Urgent announcements and rehearsal notifications',
          importance: 5,
          visibility: 1,
          vibration: true,
        }).catch((e) => console.log('LocalNotifications channel init:', e));
      } catch (e) {
        // Ignore if not running in native app
      }
    }

    // 2. Register Web Service Worker if browser supports PushManager
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setIsSubscribed(true);
          }
        });
      }).catch((err) => {
        console.error('Service worker registration failed:', err);
      });
    }

    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('push_banner_dismissed') === 'true';
      setDismissed(isDismissed);
    }
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // 1. Request native Android notification permission if on native device
      try {
        await LocalNotifications.requestPermissions();
      } catch (e) {
        // Fallback gracefully for web browser mode
      }

      // 2. Register Web Push subscription
      const reg = await navigator.serviceWorker.ready;
      const publicVapidKey =
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        'BIW1Er33h_q1XsZcxVpLtPo27iWlgcaplHvN_HaFw7KAlkV9FqWvVwmBihR5ViY9gk7evMAWo69cYadsjCK1eRA';

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
      });

      const subObj = subscription.toJSON();

      if (subObj.endpoint && subObj.keys?.p256dh && subObj.keys?.auth) {
        const res = await savePushSubscriptionAction({
          endpoint: subObj.endpoint,
          keys: {
            p256dh: subObj.keys.p256dh,
            auth: subObj.keys.auth,
          },
        });

        if (res.success) {
          setIsSubscribed(true);
        }
      }
    } catch (err) {
      console.error('Error subscribing to push notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('push_banner_dismissed', 'true');
    }
  };

  if (!isSupported || isSubscribed || dismissed) {
    return null;
  }

  return (
    <div
      className="glass-container"
      style={{
        padding: '16px 20px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderLeft: '4px solid var(--accent)',
        background: 'rgba(197, 160, 89, 0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: 'var(--accent)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          🔔
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>
            Stay Updated with Push Alerts
          </h4>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            Get instant mobile alerts for urgent announcements & schedule updates.
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="btn btn-primary"
          style={{ padding: '8px 16px', fontSize: '0.85rem', minHeight: '36px' }}
        >
          {loading ? 'Enabling...' : 'Enable Alerts'}
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
          aria-label="Dismiss notification prompt"
        >
          &times;
        </button>
      </div>
    </div>
  );
};
