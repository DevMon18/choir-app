'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface DirectoryMember {
  id: string;
  full_name: string;
  role: string;
  voice_part: string | null;
  phone: string | null;
  birthday: string | null;
  avatar_url?: string | null;
  join_date?: string | null;
  address?: string | null;
  interests?: string[];
  bio?: string | null;
  created_at: string;
}

interface UseDirectoryOptions {
  initialMembers?: DirectoryMember[];
  voicePart?: string;
  searchQuery?: string;
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useDirectory
 * Fetches member directory with instant cache and silent background revalidation.
 */
export function useDirectory(options: UseDirectoryOptions = {}) {
  const { initialMembers, voicePart, searchQuery, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<DirectoryMember[]> => {
    let query = supabase
      .from('public_directory')
      .select('id, full_name, role, voice_part, join_date, phone, address, avatar_url')
      .order('full_name');

    if (voicePart && voicePart !== 'ALL') {
      query = query.eq('voice_part', voicePart);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as DirectoryMember[];
  };

  const key = enabled ? ['directory:members', voicePart || 'all'] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<DirectoryMember[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialMembers,
  });

  const filteredMembers = (data || []).filter((m) => {
    if (!searchQuery?.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesName = m.full_name.toLowerCase().includes(q);
    const matchesVoice = (m.voice_part || '').toLowerCase().includes(q);
    const matchesInterests = (m.interests || []).some((i) => i.toLowerCase().includes(q));
    return matchesName || matchesVoice || matchesInterests;
  });

  return {
    members: filteredMembers,
    allMembers: data || [],
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * Custom SWR Hook: useMemberProfile
 * Fetches detailed profile of a specific member by ID with instant cache.
 */
export function useMemberProfile(memberId: string | null, initialProfile?: DirectoryMember) {
  const supabase = createClient();

  const fetcher = async (): Promise<DirectoryMember | null> => {
    if (!memberId) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', memberId)
      .single();

    if (error) throw new Error(error.message);
    return data as DirectoryMember;
  };

  const key = memberId ? ['directory:member', memberId] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<DirectoryMember | null>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialProfile,
  });

  return {
    profile: data,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
