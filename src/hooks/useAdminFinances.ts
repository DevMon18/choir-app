'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface FinanceSummary {
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionRate: number;
  recentTransactions: Array<{
    id: string;
    user_id: string;
    amount: number;
    month: string;
    year: number;
    status: string;
    paid_at: string | null;
    profiles?: { full_name: string };
  }>;
}

interface UseAdminFinancesOptions {
  initialSummary?: FinanceSummary;
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useAdminFinances
 * Fetches choir treasury overview and ledger with instant cache.
 */
export function useAdminFinances(options: UseAdminFinancesOptions = {}) {
  const { initialSummary, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<FinanceSummary> => {
    const { data: records, error } = await supabase
      .from('dues_records')
      .select(`
        id, user_id, amount, month, year, status, paid_at,
        profiles ( full_name )
      `)
      .order('paid_at', { ascending: false });

    if (error) throw new Error(error.message);

    const all = (records || []) as any[];
    const paid = all.filter((r) => r.status === 'paid');
    const pending = all.filter((r) => r.status === 'pending');
    const overdue = all.filter((r) => r.status === 'overdue');

    const totalCollected = paid.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalPending = pending.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalOverdue = overdue.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalExpected = totalCollected + totalPending + totalOverdue;
    const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;

    return {
      totalCollected,
      totalPending,
      totalOverdue,
      collectionRate,
      recentTransactions: all.slice(0, 20),
    };
  };

  const key = enabled ? 'admin:finances-summary' : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<FinanceSummary>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialSummary,
  });

  return {
    finances: data,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
