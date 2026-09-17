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
  recording_id?: string | null;
  recording_file_url?: string | null;
  recording_label?: string | null;
  is_verified_master?: boolean;
  is_audio?: boolean;
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
        recording_id, submitted_at, reviewed_at, rejection_reason,
        song:song_id ( id, title, composer ),
        point_ref:mass_part ( display_name ),
        recording:recording_id ( id, voice_part, file_url, label, is_verified_master )
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

      const isAudio =
        r.mass_part === 'audio_recording' ||
        r.mass_part === 'audio_recording_master' ||
        Boolean(r.recording_id) ||
        (r.lyrics_content && r.lyrics_content.startsWith('Audio Guide Track:'));

      let partName = r.point_ref?.display_name;
      if (!partName) {
        if (r.mass_part === 'audio_recording') {
          partName = '🎵 Audio Recording';
        } else if (r.mass_part === 'audio_recording_master') {
          partName = '⭐ Master Track Bonus';
        } else {
          partName = r.mass_part;
        }
      }

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
        mass_part_name: partName,
        lyrics_content: r.lyrics_content,
        status: r.status,
        points_awarded: r.points_awarded,
        submitted_at: r.submitted_at,
        reviewed_at: r.reviewed_at,
        rejection_reason: r.rejection_reason,
        recording_id: r.recording_id,
        recording_file_url: r.recording?.file_url || null,
        recording_label: r.recording?.label || null,
        is_verified_master: Boolean(r.recording?.is_verified_master || r.mass_part === 'audio_recording_master'),
        is_audio: isAudio,
      };
    });

    return { submissions, totalPoints };
  } catch (err: any) {
    console.error('Unexpected error in getMyLyricsSubmissions:', err);
    return { submissions: [], totalPoints: 0, error: err.message };
  }
}
