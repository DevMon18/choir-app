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

    const handleAuthSuccess = async () => {
      try {
        await Browser.close();
      } catch (e) {
        // Browser tab might already be closed
      }
      
      const path = window.location.pathname;
      if (path === '/login' || path === '/signup' || path === '/join' || path === '/') {
        window.location.href = '/dashboard';
      }
    };

    // 1. Listen for deep link events (e.g. com.choircollective.app://auth/callback)
    const appUrlListener = App.addListener('appUrlOpen', async (data) => {
      console.log('App opened with URL:', data.url);
      if (data.url.includes('auth/callback') || data.url.includes('com.choircollective.app')) {
        await handleAuthSuccess();
      }
    });

    // 2. Listen for when the browser overlay is finished or closed
    const browserFinishedListener = Browser.addListener('browserFinished', async () => {
      console.log('Browser overlay finished/closed');
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await handleAuthSuccess();
      }
    });

    // 3. Listen for active session state changes (e.g. when OAuth completes inside Custom Tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Native auth state change:', event, session?.user?.email);
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        await handleAuthSuccess();
      }
    });

    // 4. Fast polling fallback while browser overlay is open
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await handleAuthSuccess();
      }
    }, 1500);

    return () => {
      appUrlListener.then((h) => h.remove());
      browserFinishedListener.then((h) => h.remove());
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return null;
};
