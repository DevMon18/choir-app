'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface RosterMember {
  id: string;
  full_name: string;
  role: string;
  voice_part: string | null;
  phone: string | null;
  birthday: string | null;
  avatar_url: string | null;
  attendance_rate?: number;
  dues_paid?: boolean;
  created_at: string;
}

export interface AdminUserItem {
  id: string;
  full_name: string;
  role: 'super_admin' | 'director' | 'secretary' | 'member' | 'pending' | 'rejected';
  voice_part: string | null;
  created_at: string;
}

interface UseChoirRosterOptions {
  initialMembers?: RosterMember[];
  enabled?: boolean;
}

interface UseAdminUsersOptions {
  initialUsers?: AdminUserItem[];
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useChoirRoster
 * Fetches the choir roster grouped by voice sections with attendance and dues standing.
 */
export function useChoirRoster(options: UseChoirRosterOptions = {}) {
  const { initialMembers, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<RosterMember[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .not('role', 'in', '("pending","rejected")')
      .order('full_name');

    if (error) throw new Error(error.message);
    return (data || []) as RosterMember[];
  };

  const key = enabled ? 'admin:roster' : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<RosterMember[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialMembers,
  });

  const voiceBreakdown = {
    Soprano: (data || []).filter((m) => m.voice_part === 'Soprano'),
    Alto: (data || []).filter((m) => m.voice_part === 'Alto'),
    Tenor: (data || []).filter((m) => m.voice_part === 'Tenor'),
    Bass: (data || []).filter((m) => m.voice_part === 'Bass'),
    Unassigned: (data || []).filter((m) => !m.voice_part),
  };

  return {
    members: data || [],
    voiceBreakdown,
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * Custom SWR Hook: useAdminUsers
 * Fetches all registered users for role assignments and pending member approvals.
 */
export function useAdminUsers(options: UseAdminUsersOptions = {}) {
  const { initialUsers, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<AdminUserItem[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, voice_part, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []) as AdminUserItem[];
  };

  const key = enabled ? 'admin:users' : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<AdminUserItem[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialUsers,
  });

  return {
    users: data || [],
    pendingUsers: (data || []).filter((u) => u.role === 'pending'),
    activeMembers: (data || []).filter((u) => !['pending', 'rejected'].includes(u.role)),
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
