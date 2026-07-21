'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

export const CapacitorManager = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener('appUrlOpen', async (data) => {
      console.log('App opened with URL:', data.url);

      if (data.url.includes('auth/callback') || data.url.startsWith('com.choircollective.app')) {
        // 1. Dismiss Chrome Custom Tab in-app browser
        try {
          await Browser.close();
        } catch (e) {
          // Browser tab might already be closed
        }

        // 2. Parse auth code or query parameters
        try {
          const rawUrl = data.url.replace('com.choircollective.app://', 'https://choir-app-ecru.vercel.app/');
          const parsed = new URL(rawUrl);
          const code = parsed.searchParams.get('code');
          const error = parsed.searchParams.get('error');

          if (code) {
            window.location.href = `/auth/callback?code=${encodeURIComponent(code)}`;
          } else if (error) {
            window.location.href = `/login?error=${encodeURIComponent(error)}`;
          }
        } catch (err) {
          console.error('Error parsing appUrlOpen URL:', err);
        }
      }
    });

    return () => {
      listener.then((h) => h.remove());
    };
  }, []);

  return null;
};
