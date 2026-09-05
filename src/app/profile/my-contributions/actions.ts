'use server';

import { createClient } from '@/lib/supabase/server';
import { getProfile } from '@/lib/supabase/user';

export interface MySubmissionItem {
  id: string;
  song_id: string | null;
  song_title: string;
  song_composer: string | null;
  is_new_song?: boolean;
  proposed_title?: string | null;
  proposed_composer?: string | null;
  proposed_key?: string | null;
  mass_part: string;
  mass_part_name: string;
  lyrics_content: string;
  status: 'pending' | 'approved' | 'rejected';
  points_awarded: number | null;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
}

export async function getMyLyricsSubmissions(): Promise<{
  submissions: MySubmissionItem[];
  totalPoints: number;
  error?: string;
}> {
  try {
    const profile = await getProfile();
    if (!profile) {
      return { submissions: [], totalPoints: 0, error: 'Not authenticated' };
    }

    const supabase = await createClient();

    const { data: rows, error: dbErr } = await supabase
      .from('song_submissions')
      .select(`
        id, song_id, mass_part, lyrics_content, status, points_awarded,
        is_new_song, proposed_title, proposed_composer, proposed_key,
        submitted_at, reviewed_at, rejection_reason,
        song:song_id ( id, title, composer ),
        point_ref:mass_part ( display_name )
      `)
      .eq('submitted_by', profile.id)
      .order('submitted_at', { ascending: false });

    if (dbErr) {
      console.error('Error fetching member submissions:', dbErr);
      return { submissions: [], totalPoints: 0, error: dbErr.message };
    }

    let totalPoints = 0;
    const submissions: MySubmissionItem[] = (rows || []).map((r: any) => {
      const pts = r.points_awarded || 0;
      if (r.status === 'approved') totalPoints += pts;

      return {
        id: r.id,
        song_id: r.song_id,
        song_title: r.is_new_song ? (r.proposed_title || 'Proposed Song') : (r.song?.title || 'Unknown Song'),
        song_composer: r.is_new_song ? r.proposed_composer : (r.song?.composer || null),
        is_new_song: r.is_new_song,
        proposed_title: r.proposed_title,
        proposed_composer: r.proposed_composer,
        proposed_key: r.proposed_key,
        mass_part: r.mass_part,
        mass_part_name: r.point_ref?.display_name || r.mass_part,
        lyrics_content: r.lyrics_content,
        status: r.status,
        points_awarded: r.points_awarded,
        submitted_at: r.submitted_at,
        reviewed_at: r.reviewed_at,
        rejection_reason: r.rejection_reason,
      };
    });

    return { submissions, totalPoints };
  } catch (err: any) {
    console.error('Unexpected error in getMyLyricsSubmissions:', err);
    return { submissions: [], totalPoints: 0, error: err.message };
  }
}
