'use client';

import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';
import { defaultSWRConfig } from '@/lib/swr-config';

export interface SongCategory {
  id: string;
  name: string;
}

export interface Song {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  categories?: SongCategory[];
  lyrics: string | null;
  key_signature?: string | null;
  sheet_music_url?: string | null;
  created_at?: string;
  is_archived?: boolean;
}

export interface PracticeTrack {
  id: string;
  song_id: string;
  voice_part: string | null;
  title: string;
  storage_path: string;
  audio_url: string;
  created_at: string;
}

interface UseRepertoireOptions {
  initialSongs?: Song[];
  category?: string;
  searchQuery?: string;
  enabled?: boolean;
}

interface UseSongOptions {
  initialSong?: Song;
  enabled?: boolean;
}

interface UsePracticeTracksOptions {
  initialTracks?: PracticeTrack[];
  enabled?: boolean;
}

/**
 * Custom SWR Hook: useRepertoire
 * Features:
 * 1. Instant Cache: Returns songs from local memory cache immediately on mount (0ms delay).
 * 2. Silent Background Revalidation: Re-verifies with Supabase and seamlessly updates UI without full page reload.
 * 3. Mobile Focus/Resume Sync: Automatically syncs when returning to the mobile browser or PWA.
 */
export function useRepertoire(options: UseRepertoireOptions = {}) {
  const { initialSongs, category, searchQuery, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<Song[]> => {
    let query = supabase
      .from('songs')
      .select(`
        id, title, composer, category, lyrics, key_signature, sheet_music_url, is_archived, created_at,
        song_category_links (
          song_categories ( id, name )
        )
      `)
      .eq('is_archived', false)
      .order('title');

    if (category) {
      // Filter by category name or link
      query = query.or(`category.ilike.%${category}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map((s: any) => ({
      id: s.id,
      title: s.title,
      composer: s.composer,
      category: s.category,
      lyrics: s.lyrics,
      key_signature: s.key_signature,
      sheet_music_url: s.sheet_music_url,
      created_at: s.created_at,
      is_archived: s.is_archived,
      categories: (s.song_category_links || [])
        .map((l: any) => l.song_categories)
        .filter(Boolean),
    }));
  };

  const key = enabled ? ['repertoire:songs', category || 'all'] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<Song[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialSongs,
  });

  // Client-side search filtering on fast cached data
  const filteredSongs = (data || []).filter((song) => {
    if (!searchQuery?.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesTitle = song.title.toLowerCase().includes(q);
    const matchesComposer = (song.composer || '').toLowerCase().includes(q);
    const matchesLyrics = (song.lyrics || '').toLowerCase().includes(q);
    const matchesCat = (song.categories || []).some((c) => c.name.toLowerCase().includes(q));
    return matchesTitle || matchesComposer || matchesLyrics || matchesCat;
  });

  return {
    songs: filteredSongs,
    allSongs: data || [],
    isLoading,
    isValidating,
    error,
    mutate,
    refresh: () => mutate(),
  };
}

/**
 * Custom SWR Hook: useSong
 * Fetches a single song with its details, sheet music, and lyrics with instant SWR cache.
 */
export function useSong(songId: string | null, options: UseSongOptions = {}) {
  const { initialSong, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<Song | null> => {
    if (!songId) return null;

    const { data, error } = await supabase
      .from('songs')
      .select(`
        *,
        song_category_links (
          song_categories ( id, name )
        )
      `)
      .eq('id', songId)
      .eq('is_archived', false)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      ...data,
      categories: (data.song_category_links || [])
        .map((l: any) => l.song_categories)
        .filter(Boolean),
    };
  };

  const key = enabled && songId ? ['repertoire:song', songId] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<Song | null>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialSong,
  });

  return {
    song: data,
    isLoading,
    isValidating,
    error,
    mutate,
  };
}

/**
 * Custom SWR Hook: usePracticeTracks
 * Fetches practice recordings and audio stems for a song with instant SWR cache.
 */
export function usePracticeTracks(songId: string | null, options: UsePracticeTracksOptions = {}) {
  const { initialTracks, enabled = true } = options;
  const supabase = createClient();

  const fetcher = async (): Promise<PracticeTrack[]> => {
    if (!songId) return [];

    const { data, error } = await supabase
      .from('practice_recordings')
      .select('id, song_id, voice_part, title, storage_path, created_at')
      .eq('song_id', songId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    // Resolve public/signed URLs for playback
    const tracksWithUrls: PracticeTrack[] = (data || []).map((track: any) => {
      const { data: urlData } = supabase.storage
        .from('practice_recordings')
        .getPublicUrl(track.storage_path);

      return {
        ...track,
        audio_url: urlData?.publicUrl || '',
      };
    });

    return tracksWithUrls;
  };

  const key = enabled && songId ? ['repertoire:practice-tracks', songId] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<PracticeTrack[]>(key, fetcher, {
    ...defaultSWRConfig,
    fallbackData: initialTracks,
  });

  return {
    tracks: data || [],
    isLoading,
    isValidating,
    error,
    mutate,
  };
}
