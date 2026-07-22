'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { createClient } from '@/lib/supabase/client';

export const CapacitorManager = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const supabase = createClient();

    const appUrlListener = App.addListener('appUrlOpen', async (data) => {
      console.log('Mobile app opened with URL:', data.url);

      if (data.url && (data.url.includes('auth/callback') || data.url.startsWith('com.choircollective.app'))) {
        // 1. Immediately close the in-app browser overlay tab
        try {
          await Browser.close();
        } catch (e) {
          // Tab might already be dismissed
        }

        try {
          // Parse hash or query parameters from URL
          const urlStr = data.url.replace('com.choircollective.app://', 'https://choir-app-ecru.vercel.app/');
          const parsed = new URL(urlStr);

          // Check hash fragment parameters (#access_token=...&refresh_token=...)
          const hashParams = new URLSearchParams(parsed.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          // Check search query parameters (?code=...)
          const code = parsed.searchParams.get('code');

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          } else if (code) {
            await supabase.auth.exchangeCodeForSession(code);
          }
        } catch (err) {
          console.error('Error handling mobile auth deep link:', err);
        }

        // 2. Navigate native WebView to dashboard
        window.location.href = '/dashboard';
      }
    });

    return () => {
      appUrlListener.then((h) => h.remove());
    };
  }, []);

  return null;
};
