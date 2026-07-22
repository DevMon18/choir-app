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

        // 2. Navigate native WebView directly to /dashboard
        window.location.href = '/dashboard';
      }
    });

    return () => {
      listener.then((h) => h.remove());
    };
  }, []);

  return null;
};
