'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface DuesRecord {
  id: string;
  user_id: string;
  month: string;
  year: number;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'waived';
  paid_at: string | null;
  payment_method?: string | null;
  receipt_url?: string | null;
}

interface UseDuesOptions {
  userId: string;
  initialRecords?: DuesRecord[];
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useDues
 * Fetches user dues records, payment history, and standing with instant cache.
 */
export function useDues({ userId, initialRecords, enabled = true }: UseDuesOptions) {
  const supabase = createClient();

  const fetcher = async (): Promise<DuesRecord[]> => {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('dues_records')
      .select('*')
      .eq('user_id', userId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []) as DuesRecord[];
  };

  const key = enabled && userId ? ['dues:records', userId] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<DuesRecord[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialRecords,
  });

  const isUpToDate = (data || []).every((r) => r.status === 'paid' || r.status === 'waived');

  return {
    records: data || [],
    isUpToDate,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
