'use server';

import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/user';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/lib/push';
import { recordAuditLog } from '@/lib/audit';
import { delCache } from '@/lib/cache';

const REVIEWER_ROLES = ['director', 'super_admin'];

export interface ReviewSubmissionItem {
  id: string;
  song_id: string | null;
  song_title: string;
  song_composer: string | null;
  is_new_song?: boolean;
  proposed_title?: string | null;
  proposed_composer?: string | null;
  proposed_key?: string | null;
  submitted_by: string;
  submitter_name: string;
  submitter_email: string;
  submitter_avatar: string | null;
  mass_part: string;
  mass_part_name: string;
  points_at_stake: number;
  lyrics_content: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

const getReviewerClient = async () => {
  const profile = await getProfile();
  if (!profile) {
    return { reviewer: null, error: 'Not authenticated' };
  }

  if (!REVIEWER_ROLES.includes(profile.role)) {
    return { reviewer: null, error: 'Unauthorized: Only Directors and Super Admins can review lyrics.' };
  }

  let dbClient: any = await createClient();
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    dbClient = createAdminClient();
  } catch {}

  return { reviewer: profile, dbClient, error: null };
};

/**
 * List all pending lyrics submissions sorted oldest first
 */
export async function listPendingLyricsSubmissions(): Promise<{
  submissions: ReviewSubmissionItem[];
  error?: string;
}> {
  try {
    const { reviewer, dbClient, error: authErr } = await getReviewerClient();
    if (authErr || !reviewer) {
      return { submissions: [], error: authErr || 'Unauthorized' };
    }

    const { data: rows, error: dbErr } = await dbClient
      .from('song_submissions')
      .select(`
        id, song_id, submitted_by, mass_part, lyrics_content, status,
        is_new_song, proposed_title, proposed_composer, proposed_key,
        submitted_at, reviewed_by, reviewed_at, rejection_reason,
        song:song_id ( id, title, composer ),
        submitter:submitted_by ( id, full_name, email, avatar_url ),
        point_ref:mass_part ( mass_part, display_name, points )
      `)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true });

    if (dbErr) {
      console.error('Error fetching pending submissions:', dbErr);
      return { submissions: [], error: dbErr.message };
    }

    const submissions: ReviewSubmissionItem[] = (rows || []).map((r: any) => ({
      id: r.id,
      song_id: r.song_id,
      song_title: r.is_new_song ? (r.proposed_title || 'Proposed New Song') : (r.song?.title || 'Unknown Song'),
      song_composer: r.is_new_song ? r.proposed_composer : (r.song?.composer || null),
      is_new_song: r.is_new_song,
      proposed_title: r.proposed_title,
      proposed_composer: r.proposed_composer,
      proposed_key: r.proposed_key,
      submitted_by: r.submitted_by,
      submitter_name: r.submitter?.full_name || 'Choir Member',
      submitter_email: r.submitter?.email || '',
      submitter_avatar: r.submitter?.avatar_url || null,
      mass_part: r.mass_part,
      mass_part_name: r.point_ref?.display_name || r.mass_part,
      points_at_stake: r.point_ref?.points || 1,
      lyrics_content: r.lyrics_content,
      status: r.status,
      submitted_at: r.submitted_at,
      reviewed_by: r.reviewed_by,
      reviewed_at: r.reviewed_at,
      rejection_reason: r.rejection_reason,
    }));

    return { submissions };
  } catch (err: any) {
    console.error('Unexpected error in listPendingLyricsSubmissions:', err);
    return { submissions: [], error: err.message };
  }
}

/**
 * Approve a lyrics or new song submission atomically, snapshot points, create song if new, send push notification, and log audit event.
 */
export async function approveLyricsSubmission(submissionId: string) {
  try {
    const { reviewer, dbClient, error: authErr } = await getReviewerClient();
    if (authErr || !reviewer) {
      return { error: authErr || 'Unauthorized' };
    }

    // 1. Fetch the target submission and point reference
    const { data: sub, error: fetchErr } = await dbClient
      .from('song_submissions')
      .select(`
        id, song_id, submitted_by, mass_part, lyrics_content, status,
        is_new_song, proposed_title, proposed_composer, proposed_key,
        song:song_id ( id, title ),
        point_ref:mass_part ( mass_part, display_name, points )
      `)
      .eq('id', submissionId)
      .single();

    if (fetchErr || !sub) {
      return { error: 'Submission not found.' };
    }

    if (sub.status !== 'pending') {
      return { error: `This submission is already marked as ${sub.status}.` };
    }

    let targetSongId = sub.song_id;
    let targetSongTitle = sub.song?.title;
    const nowIso = new Date().toISOString();

    // 2. If this is a brand new song proposal, create the song in public.songs first!
    if (sub.is_new_song || !sub.song_id) {
      const newTitle = sub.proposed_title || 'Untitled Song';
      const newComposer = sub.proposed_composer || null;
      const legacyCategory = sub.point_ref?.display_name || sub.mass_part;

      const { data: createdSong, error: createSongErr } = await dbClient
        .from('songs')
        .insert({
          title: newTitle,
          composer: newComposer,
          category: legacyCategory,
          lyrics: sub.lyrics_content,
        })
        .select('id')
        .single();

      if (createSongErr || !createdSong) {
        console.error('Error creating song from approved proposal:', createSongErr);
        return { error: createSongErr?.message || 'Failed to create song in repertoire.' };
      }

      targetSongId = createdSong.id;
      targetSongTitle = newTitle;
    } else {
      // Concurrency check for existing song
      const { data: existingApproved } = await dbClient
        .from('song_submissions')
        .select('id')
        .eq('song_id', sub.song_id)
        .eq('mass_part', sub.mass_part)
        .eq('status', 'approved')
        .neq('id', submissionId)
        .maybeSingle();

      if (existingApproved) {
        return {
          error: `Another contribution for ${sub.point_ref?.display_name || sub.mass_part} was already approved for this song.`,
        };
      }
    }

    // Points: Exact canonical mass part points
    const pointsToAward = sub.point_ref?.points || 1;

    // 3. Atomically update submission state
    const { error: updateErr } = await dbClient
      .from('song_submissions')
      .update({
        song_id: targetSongId,
        status: 'approved',
        points_awarded: pointsToAward,
        reviewed_by: reviewer.id,
        reviewed_at: nowIso,
        rejection_reason: null,
      })
      .eq('id', submissionId)
      .eq('status', 'pending');

    if (updateErr) {
      console.error('Error approving submission:', updateErr);
      return { error: updateErr.message };
    }

    // 4. If existing song, auto-reject competing pending submissions for the same (song_id, mass_part)
    if (targetSongId) {
      await dbClient
        .from('song_submissions')
        .update({
          status: 'rejected',
          rejection_reason: 'This part has already been covered by another approved contribution.',
          reviewed_by: reviewer.id,
          reviewed_at: nowIso,
        })
        .eq('song_id', targetSongId)
        .eq('mass_part', sub.mass_part)
        .eq('status', 'pending');
    }

    // 5. Invalidate caches and revalidate paths
    await delCache('repertoire:all_songs');
    revalidatePath('/admin/lyrics-review');
    revalidatePath('/repertoire');
    if (targetSongId) revalidatePath(`/repertoire/${targetSongId}`);
    revalidatePath('/leaderboard');
    revalidatePath('/profile/my-contributions');

    // 6. Post-commit Push Notification to the submitter (non-blocking)
    try {
      const pushTitle = sub.is_new_song ? '🎉 New Song Approved!' : '🎉 Lyrics Contribution Approved!';
      const pushBody = sub.is_new_song
        ? `Your proposed song "${targetSongTitle}" has been approved and added to the Repertoire! +${pointsToAward} points awarded.`
        : `Your ${sub.point_ref?.display_name || sub.mass_part} lyrics for "${targetSongTitle || 'Song'}" were approved! +${pointsToAward} points awarded.`;

      await sendPushToUser(sub.submitted_by, {
        title: pushTitle,
        body: pushBody,
        url: targetSongId ? `/repertoire/${targetSongId}` : '/repertoire',
      });
    } catch (pushErr) {
      console.warn('Push notification delivery warning:', pushErr);
    }

    // 7. Audit Log Entry
    await recordAuditLog({
      actorId: reviewer.id,
      actorEmail: reviewer.email,
      action: sub.is_new_song ? 'song_proposal.approved' : 'lyrics_submission.approved',
      entityType: 'song_submission',
      entityId: submissionId,
      metadata: {
        songId: targetSongId,
        songTitle: targetSongTitle,
        isNewSong: sub.is_new_song,
        massPart: sub.mass_part,
        submittedBy: sub.submitted_by,
        pointsAwarded: pointsToAward,
        approvedAt: nowIso,
      },
    });

    return { success: true, pointsAwarded: pointsToAward };
  } catch (err: any) {
    console.error('Unexpected error approving submission:', err);
    return { error: err.message || 'Failed to approve submission.' };
  }
}

/**
 * Reject a lyrics submission with mandatory reason, send push notification, and log audit event.
 */
export async function rejectLyricsSubmission(submissionId: string, reason: string) {
  try {
    const { reviewer, dbClient, error: authErr } = await getReviewerClient();
    if (authErr || !reviewer) {
      return { error: authErr || 'Unauthorized' };
    }

    const cleanReason = reason?.trim();
    if (!cleanReason) {
      return { error: 'A rejection reason is required so the contributor can improve and resubmit.' };
    }

    if (cleanReason.length > 1000) {
      return { error: 'Rejection reason cannot exceed 1000 characters.' };
    }

    // 1. Fetch submission details
    const { data: sub, error: fetchErr } = await dbClient
      .from('song_submissions')
      .select(`
        id, song_id, submitted_by, mass_part, status,
        song:song_id ( id, title ),
        point_ref:mass_part ( mass_part, display_name )
      `)
      .eq('id', submissionId)
      .single();

    if (fetchErr || !sub) {
      return { error: 'Submission not found.' };
    }

    if (sub.status !== 'pending') {
      return { error: `This submission is already marked as ${sub.status}.` };
    }

    const nowIso = new Date().toISOString();

    // 2. Atomically update submission to rejected
    const { error: updateErr } = await dbClient
      .from('song_submissions')
      .update({
        status: 'rejected',
        rejection_reason: cleanReason,
        reviewed_by: reviewer.id,
        reviewed_at: nowIso,
      })
      .eq('id', submissionId)
      .eq('status', 'pending');

    if (updateErr) {
      console.error('Error rejecting submission:', updateErr);
      return { error: updateErr.message };
    }

    // 3. Revalidate paths
    revalidatePath('/admin/lyrics-review');
    revalidatePath(`/repertoire/${sub.song_id}`);
    revalidatePath('/profile/my-contributions');

    // 4. Post-commit Push Notification with rejection feedback
    try {
      await sendPushToUser(sub.submitted_by, {
        title: 'Lyrics Submission Feedback',
        body: `Your ${sub.point_ref?.display_name || sub.mass_part} lyrics for "${sub.song?.title || 'Song'}" need revision: "${cleanReason.substring(0, 100)}${cleanReason.length > 100 ? '…' : ''}"`,
        url: '/profile/my-contributions',
      });
    } catch (pushErr) {
      console.warn('Push notification delivery warning:', pushErr);
    }

    // 5. Audit Log Entry
    await recordAuditLog({
      actorId: reviewer.id,
      actorEmail: reviewer.email,
      action: 'lyrics_submission.rejected',
      entityType: 'song_submission',
      entityId: submissionId,
      metadata: {
        songId: sub.song_id,
        songTitle: sub.song?.title,
        massPart: sub.mass_part,
        submittedBy: sub.submitted_by,
        rejectionReason: cleanReason,
        rejectedAt: nowIso,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error('Unexpected error rejecting submission:', err);
    return { error: err.message || 'Failed to reject submission.' };
  }
}
