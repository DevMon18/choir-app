'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface AttendanceRecord {
  id: string;
  event_id: string;
  user_id: string;
  status: 'present' | 'absent' | 'excused' | 'late';
  check_in_time: string | null;
  notes: string | null;
  profiles?: { id: string; full_name: string; voice_part: string | null };
}

interface UseAttendanceOptions {
  eventId?: string;
  initialRecords?: AttendanceRecord[];
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useAttendance
 * Fetches attendance records for rehearsals and mass performances with instant cache.
 */
export function useAttendance(options: UseAttendanceOptions = {}) {
  const { eventId, initialRecords, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<AttendanceRecord[]> => {
    let query = supabase
      .from('attendance')
      .select(`
        id, event_id, user_id, status, check_in_time, notes,
        profiles ( id, full_name, voice_part )
      `);

    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data || []) as any;
  };

  const key = enabled ? ['admin:attendance', eventId || 'all'] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<AttendanceRecord[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialRecords,
  });

  return {
    records: data || [],
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
