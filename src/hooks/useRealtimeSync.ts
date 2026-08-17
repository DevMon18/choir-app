'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UseRealtimeSyncOptions {
  /** Channel identifier prefix (e.g. 'member-docs', 'admin-verifications') */
  channelName: string;
  /** Tables to listen for changes on */
  tables?: Array<{
    table: string;
    schema?: string;
    filter?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  }>;
  /** Callback fired whenever any listened table receives an event */
  onEvent?: (payload: { table: string; eventType: string; new: any; old: any }) => void;
  /** Whether to automatically trigger debounced router.refresh() (default: true) */
  autoRefresh?: boolean;
  /** Debounce delay in ms for router.refresh() (default: 350ms) */
  debounceMs?: number;
  /** Whether to auto-revalidate when mobile app / browser tab becomes visible (default: true) */
  revalidateOnFocus?: boolean;
  /** Enable or disable listener */
  enabled?: boolean;
}

/**
 * Universal Real-Time Sync Hook for Web and Mobile PWAs.
 * Features:
 * 1. Multiplexed Supabase WebSocket subscriptions with strict channel cleanup.
 * 2. Mobile App Lifecycle resilience: Automatically revalidates state when switching back from background.
 * 3. Debounced non-blocking server revalidation (prevents UI thrashing).
 */
export function useRealtimeSync({
  channelName,
  tables = [],
  onEvent,
  autoRefresh = true,
  debounceMs = 350,
  revalidateOnFocus = true,
  enabled = true,
}: UseRealtimeSyncOptions) {
  const router = useRouter();
  const supabase = createClient();
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  // Debounced router refresh to bundle rapid database events
  const triggerRefresh = useCallback(() => {
    if (!autoRefresh) return;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      router.refresh();
    }, debounceMs);
  }, [autoRefresh, debounceMs, router]);

  // Main Realtime Channel Subscription
  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    try {
      const uniqueChannelId = `${channelName}-${Math.random().toString(36).substring(2, 7)}`;
      channel = supabase.channel(uniqueChannelId);

      tables.forEach(({ table, schema = 'public', filter, event = '*' }) => {
        const config: any = {
          event,
          schema,
          table,
        };
        if (filter) {
          config.filter = filter;
        }

        channel = channel!.on('postgres_changes', config, (payload: any) => {
          if (!isMounted) return;

          if (onEventRef.current) {
            onEventRef.current({
              table,
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            });
          }

          triggerRefresh();
        });
      });

      channel.subscribe((status, err) => {
        if (err) {
          console.warn(`[useRealtimeSync:${channelName}] Subscription status:`, status, err);
        }
      });
    } catch (err) {
      console.error(`[useRealtimeSync:${channelName}] Setup error:`, err);
    }

    return () => {
      isMounted = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [channelName, enabled, JSON.stringify(tables), supabase, triggerRefresh]);

  // Mobile App Background / Foreground Resume Resilience
  useEffect(() => {
    if (!enabled || !revalidateOnFocus) return;

    let lastHiddenTime = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        // If app was hidden in background for > 3 seconds, revalidate fresh state
        const elapsed = Date.now() - lastHiddenTime;
        if (elapsed > 3000) {
          triggerRefresh();
        }
      }
    };

    const handleWindowFocus = () => {
      triggerRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [enabled, revalidateOnFocus, triggerRefresh]);

  return { triggerRefresh };
}
