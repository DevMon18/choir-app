'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface LiveSessionState {
  id?: string;
  sequence_id: string | null;
  active_song_id: string | null;
  director_semitones: number;
  scroll_speed: number;
  is_active: boolean;
  show_chords?: boolean;
  updated_at?: string;
}

export interface SequenceItem {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  sequence_songs?: Array<{
    id: string;
    song_id: string;
    order_index: number;
    songs?: { id: string; title: string; composer: string | null; category: string | null };
  }>;
}

interface UseLiveSessionOptions {
  initialSession?: LiveSessionState | null;
  enabled?: boolean;
}

interface UseSequencesOptions {
  initialSequences?: SequenceItem[];
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useLiveSession
 * Fetches the active liturgy live sync state and current song index with instant cache.
 */
export function useLiveSession(options: UseLiveSessionOptions = {}) {
  const { initialSession, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<LiveSessionState | null> => {
    const { data, error } = await supabase
      .from('live_sessions')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    return data || null;
  };

  const key = enabled ? 'live:session-state' : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<LiveSessionState | null>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialSession,
  });

  return {
    session: data,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Custom SWR Hook: useSequences
 * Fetches mass setlists and song lineups with instant cache.
 */
export function useSequences(options: UseSequencesOptions = {}) {
  const { initialSequences, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<SequenceItem[]> => {
    const { data, error } = await supabase
      .from('mass_sequences')
      .select(`
        id, title, description, scheduled_at, created_at
      `)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return ((data || []) as any[]).map((seq: any) => ({
      ...seq,
      is_active: false,
      sequence_songs: [],
    })) as SequenceItem[];
  };

  const key = enabled ? 'sequences:all' : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<SequenceItem[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialSequences,
  });

  return {
    sequences: data || [],
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}
