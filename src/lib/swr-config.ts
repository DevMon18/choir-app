import { SWRConfiguration } from 'swr';

/**
 * Standard SWR configuration optimized for Supabase queries and Mobile PWA usage.
 * - revalidateOnFocus: Automatically checks for updates when returning to the app from background (throttled).
 * - dedupingInterval: 4000ms deduplication window to prevent multiple identical requests during rapid navigation.
 * - revalidateOnReconnect: Re-synchronizes state after network recovery.
 */
export const defaultSWRConfig: SWRConfiguration = {
  revalidateOnFocus: true,
  focusThrottleInterval: 5000,
  dedupingInterval: 4000,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  keepPreviousData: true,
};
