'use server';

import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/user';
import { revalidatePath } from 'next/cache';
import { checkRateLimitMutation } from '@/lib/ratelimit';

export interface MassPartPoint {
  mass_part: string;
  display_name: string;
  points: number;
  sort_order: number;
}

export interface SongSubmissionItem {
  id: string;
  song_id: string;
  submitted_by: string;
  submitter_name?: string;
  mass_part: string;
  lyrics_content: string;
  status: 'pending' | 'approved' | 'rejected';
  points_awarded: number | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export interface MassPartCoverageItem {
  mass_part: string;
  display_name: string;
  points: number;
  sort_order: number;
  status: 'approved' | 'pending' | 'missing';
  approvedSubmission?: SongSubmissionItem | null;
  userPendingSubmission?: SongSubmissionItem | null;
  pendingCount: number;
}

export interface SongLyricsCoverageResponse {
  massParts: MassPartCoverageItem[];
  coveredCount: number;
  totalCount: number;
  error?: string;
}

/**
 * Retrieves the complete Mass Part coverage status for a song.
 */
export async function getSongLyricsCoverage(songId: string): Promise<SongLyricsCoverageResponse> {
  try {
    const profile = await getProfile();
    const supabase = await createClient();

    // 1. Fetch mass part lookup reference
    const { data: massPartsRef, error: mpErr } = await supabase
      .from('mass_part_points')
      .select('*')
      .order('sort_order', { ascending: true });

    if (mpErr || !massPartsRef) {
      console.error('Error fetching mass_part_points:', mpErr);
      return { massParts: [], coveredCount: 0, totalCount: 0, error: mpErr?.message || 'Failed to load mass parts' };
    }

    // 2. Fetch all submissions for this song
    const { data: submissions, error: subErr } = await supabase
      .from('song_submissions')
      .select(`
        id, song_id, submitted_by, mass_part, lyrics_content, status,
        points_awarded, submitted_at, reviewed_by, reviewed_at, rejection_reason,
        submitter:submitted_by ( full_name )
      `)
      .eq('song_id', songId);

    if (subErr) {
      console.error('Error fetching song submissions:', subErr);
      return { massParts: [], coveredCount: 0, totalCount: 0, error: subErr.message };
    }

    const currentUserId = profile?.id;
    let coveredCount = 0;

    const massParts: MassPartCoverageItem[] = massPartsRef.map((mp: MassPartPoint) => {
      const partSubs = (submissions || []).filter((s: any) => s.mass_part === mp.mass_part);
      
      const approvedSub = partSubs.find((s: any) => s.status === 'approved');
      const userPending = currentUserId
        ? partSubs.find((s: any) => s.submitted_by === currentUserId && s.status === 'pending')
        : null;
      const pendingCount = partSubs.filter((s: any) => s.status === 'pending').length;

      let status: 'approved' | 'pending' | 'missing' = 'missing';
      if (approvedSub) {
        status = 'approved';
        coveredCount++;
      } else if (pendingCount > 0) {
        status = 'pending';
      }

      const getSubmitterName = (sub: any, fallback: string) => {
        if (!sub?.submitter) return fallback;
        if (Array.isArray(sub.submitter)) return sub.submitter[0]?.full_name || fallback;
        return (sub.submitter as any)?.full_name || fallback;
      };

      return {
        mass_part: mp.mass_part,
        display_name: mp.display_name,
        points: mp.points,
        sort_order: mp.sort_order,
        status,
        approvedSubmission: approvedSub ? {
          ...approvedSub,
          submitter_name: getSubmitterName(approvedSub, 'Choir Member'),
        } : null,
        userPendingSubmission: userPending ? {
          ...userPending,
          submitter_name: getSubmitterName(userPending, 'You'),
        } : null,
        pendingCount,
      };
    });

    return {
      massParts,
      coveredCount,
      totalCount: massPartsRef.length,
    };
  } catch (err: any) {
    console.error('Unexpected error in getSongLyricsCoverage:', err);
    return { massParts: [], coveredCount: 0, totalCount: 0, error: err.message };
  }
}

/**
 * Submit lyrics for a specific Mass Part of a song.
 */
export async function submitSongLyrics(
  songId: string,
  massPart: string,
  lyricsContent: string,
  existingSubmissionId?: string
) {
  try {
    const profile = await getProfile();
    if (!profile) {
      return { error: 'You must be logged in to contribute lyrics.' };
    }

    if (['pending', 'rejected'].includes(profile.role)) {
      return { error: 'Only approved choir members can submit lyrics.' };
    }

    const rateLimit = await checkRateLimitMutation(profile.id);
    if (!rateLimit.success) {
      return { error: 'Rate limit exceeded. Please wait a moment before submitting again.' };
    }

    const cleanLyrics = lyricsContent?.trim();
    if (!cleanLyrics) {
      return { error: 'Lyrics content cannot be empty.' };
    }

    const supabase = await createClient();

    // 1. Verify song exists and is active
    const { data: song, error: songErr } = await supabase
      .from('songs')
      .select('id, title')
      .eq('id', songId)
      .eq('is_archived', false)
      .single();

    if (songErr || !song) {
      return { error: 'Song not found or is archived.' };
    }

    // 2. Verify mass part is valid
    const { data: mpRef, error: mpErr } = await supabase
      .from('mass_part_points')
      .select('mass_part, display_name, points')
      .eq('mass_part', massPart)
      .single();

    if (mpErr || !mpRef) {
      return { error: 'Invalid Mass Part selected.' };
    }

    // 3. Check duplicate prevention: block if already approved
    const { data: existingApproved } = await supabase
      .from('song_submissions')
      .select('id, submitted_by')
      .eq('song_id', songId)
      .eq('mass_part', massPart)
      .eq('status', 'approved')
      .maybeSingle();

    if (existingApproved) {
      return {
        error: `The ${mpRef.display_name} for "${song.title}" is already covered by an approved contribution.`,
      };
    }

    // 4. If editing an existing pending/rejected submission, update it directly
    if (existingSubmissionId) {
      const { data: updated, error: updateErr } = await supabase
        .from('song_submissions')
        .update({
          lyrics_content: cleanLyrics,
          status: 'pending',
          rejection_reason: null,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', existingSubmissionId)
        .eq('submitted_by', profile.id)
        .select('id')
        .single();

      if (updateErr) {
        return { error: updateErr.message };
      }

      revalidatePath(`/repertoire/${songId}`);
      revalidatePath('/profile/my-contributions');
      revalidatePath('/admin/lyrics-review');
      return { success: true, id: updated?.id || existingSubmissionId };
    }

    // 5. Insert new submission
    const { data: inserted, error: insErr } = await supabase
      .from('song_submissions')
      .insert({
        song_id: songId,
        submitted_by: profile.id,
        mass_part: massPart,
        lyrics_content: cleanLyrics,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        return { error: 'This Mass Part has already been submitted and approved.' };
      }
      return { error: insErr.message };
    }

    revalidatePath(`/repertoire/${songId}`);
    revalidatePath('/profile/my-contributions');
    revalidatePath('/admin/lyrics-review');
    return { success: true, id: inserted?.id };
  } catch (err: any) {
    console.error('Unexpected error in submitSongLyrics:', err);
    return { error: err.message || 'Failed to submit lyrics' };
  }
}

/**
 * Submit a brand new song proposal along with its full lyrics/ChordPro.
 */
export async function submitNewSongWithLyrics({
  title,
  composer,
  key,
  massPart,
  lyricsContent,
  existingSubmissionId,
}: {
  title: string;
  composer?: string;
  key?: string;
  massPart: string;
  lyricsContent: string;
  existingSubmissionId?: string;
}) {
  try {
    const profile = await getProfile();
    if (!profile) {
      return { error: 'You must be logged in to propose a song.' };
    }

    if (['pending', 'rejected'].includes(profile.role)) {
      return { error: 'Only approved choir members can submit new songs.' };
    }

    const rateLimit = await checkRateLimitMutation(profile.id);
    if (!rateLimit.success) {
      return { error: 'Rate limit exceeded. Please wait a moment before submitting again.' };
    }

    const cleanTitle = title?.trim();
    if (!cleanTitle) {
      return { error: 'Song title is required.' };
    }

    const cleanLyrics = lyricsContent?.trim();
    if (!cleanLyrics) {
      return { error: 'Lyrics / chords content cannot be empty.' };
    }

    const supabase = await createClient();

    // Verify mass part is valid
    const { data: mpRef, error: mpErr } = await supabase
      .from('mass_part_points')
      .select('mass_part, display_name, points')
      .eq('mass_part', massPart)
      .maybeSingle();

    if (mpErr || !mpRef) {
      return { error: 'Invalid Mass Part / Liturgical Category selected.' };
    }

    // If updating existing proposal
    if (existingSubmissionId) {
      const { data: updated, error: updateErr } = await supabase
        .from('song_submissions')
        .update({
          proposed_title: cleanTitle,
          proposed_composer: composer?.trim() || null,
          proposed_key: key?.trim() || null,
          mass_part: massPart,
          lyrics_content: cleanLyrics,
          status: 'pending',
          rejection_reason: null,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', existingSubmissionId)
        .eq('submitted_by', profile.id)
        .select('id')
        .single();

      if (updateErr) {
        return { error: updateErr.message };
      }

      revalidatePath('/repertoire');
      revalidatePath('/profile/my-contributions');
      revalidatePath('/admin/lyrics-review');
      return { success: true, id: updated?.id || existingSubmissionId };
    }

    // Insert new song proposal
    const { data: inserted, error: insErr } = await supabase
      .from('song_submissions')
      .insert({
        is_new_song: true,
        proposed_title: cleanTitle,
        proposed_composer: composer?.trim() || null,
        proposed_key: key?.trim() || null,
        mass_part: massPart,
        lyrics_content: cleanLyrics,
        submitted_by: profile.id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Error submitting new song proposal:', insErr);
      return { error: insErr.message };
    }

    revalidatePath('/repertoire');
    revalidatePath('/profile/my-contributions');
    revalidatePath('/admin/lyrics-review');
    return { success: true, id: inserted?.id };
  } catch (err: any) {
    console.error('Unexpected error in submitNewSongWithLyrics:', err);
    return { error: err.message || 'Failed to submit new song proposal' };
  }
}
