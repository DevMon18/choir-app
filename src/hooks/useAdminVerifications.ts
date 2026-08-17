'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';
import { VerificationCardData } from '@/app/admin/verifications/actions';

interface UseVerificationsOptions {
  initialVerifications?: VerificationCardData[];
  status?: string;
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useAdminVerifications
 * Fetches digital waiver submissions and verification queue with instant SWR cache.
 */
export function useAdminVerifications(options: UseVerificationsOptions = {}) {
  const { initialVerifications, status, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<VerificationCardData[]> => {
    let query = supabase
      .from('document_signatures')
      .select(`
        id, document_id, primary_member_id, signer_type, status,
        signed_at, verified_at, rejection_reason, signer_printed_name,
        signer_relationship, is_archived, selfie_storage_path,
        documents ( id, title, type, expires_at ),
        profiles:document_signatures_primary_member_id_fkey ( id, full_name, role, voice_part, phone, avatar_url )
      `)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((row: any) => ({
      ...row,
      documents: Array.isArray(row.documents) ? row.documents[0] : row.documents,
      profiles: Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
      dependents: [],
    })) as VerificationCardData[];
  };

  const key = enabled ? ['admin:verifications', status || 'all'] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<VerificationCardData[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialVerifications,
  });

  const pendingCount = (data || []).filter((v) => v.status === 'submitted').length;
  const verifiedCount = (data || []).filter((v) => v.status === 'verified' || v.status === 'verified_manual').length;

  return {
    verifications: data || [],
    pendingCount,
    verifiedCount,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
