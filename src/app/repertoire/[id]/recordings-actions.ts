'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PracticeRecordingItem {
  id: string;
  song_id: string;
  voice_part: string | null;
  file_url: string;
  created_at: string;
  uploaded_by: string | null;
  label: string | null;
  uploader_name?: string;
}

export interface PracticeTrackHistoryItem {
  id: string;
  song_id: string;
  action_type: string;
  voicing_label: string | null;
  uploaded_by: string | null;
  uploader_name: string | null;
  created_at: string;
}

const MAX_AUDIO_SIZE_BYTES = 15 * 1024 * 1024; // 15MB cap

/**
 * Helper to log history events (fails gracefully if history table isn't present yet).
 */
async function logTrackHistory(
  adminSupabase: any,
  songId: string,
  actionType: string,
  label: string | null,
  userId: string,
  uploaderName: string
) {
  try {
    await adminSupabase.from('practice_track_history').insert({
      song_id: songId,
      action_type: actionType,
      voicing_label: label || null,
      uploaded_by: userId,
      uploader_name: uploaderName,
    });
  } catch (err) {
    console.warn('History logging notice:', err);
  }
}

/**
 * List practice recordings for a given song with resilient profile resolution.
 */
export async function listPracticeRecordings(songId: string): Promise<{ recordings: PracticeRecordingItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { recordings: [], error: 'Unauthorized' };

    const adminSupabase = createAdminClient();

    const { data: userProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userProfile || ['pending', 'rejected'].includes(userProfile.role)) {
      return { recordings: [], error: 'Access denied: your account is not approved.' };
    }

    const { data: rawTracks, error: tracksErr } = await adminSupabase
      .from('practice_tracks')
      .select('*')
      .eq('song_id', songId)
      .order('created_at', { ascending: false });

    if (tracksErr) {
      console.warn('listPracticeRecordings query notice:', tracksErr.message || tracksErr);
      return { recordings: [] };
    }

    if (!rawTracks || rawTracks.length === 0) {
      return { recordings: [] };
    }

    const uploaderIds = Array.from(
      new Set(rawTracks.map((t: any) => t.uploaded_by).filter(Boolean))
    ) as string[];

    const profilesMap: Record<string, { full_name: string; voice_part?: string | null }> = {};

    if (uploaderIds.length > 0) {
      const { data: uploaderProfiles } = await adminSupabase
        .from('profiles')
        .select('id, full_name, voice_part')
        .in('id', uploaderIds);

      if (uploaderProfiles) {
        uploaderProfiles.forEach((p: any) => {
          profilesMap[p.id] = {
            full_name: p.full_name,
            voice_part: p.voice_part,
          };
        });
      }
    }

    const recordings: PracticeRecordingItem[] = rawTracks.map((t: any) => {
      const uploader = t.uploaded_by ? profilesMap[t.uploaded_by] : null;
      const uploaderName = uploader?.full_name || 'Choir Member';
      const voicePart = t.voice_part || uploader?.voice_part || null;

      return {
        id: t.id,
        song_id: t.song_id,
        voice_part: voicePart,
        file_url: t.file_url,
        created_at: t.created_at,
        uploaded_by: t.uploaded_by || null,
        label: t.label || null,
        uploader_name: uploaderName,
      };
    });

    return { recordings };
  } catch (err: any) {
    console.error('listPracticeRecordings failed:', err);
    return { recordings: [], error: err.message || 'Server error loading recordings' };
  }
}

/**
 * Upload a practice recording (recorded audio blob or selected audio file).
 * If a recording for the specific voicing/label already exists, overwrites it and logs the history event.
 */
export async function uploadPracticeRecording(
  songId: string,
  formData: FormData
): Promise<{ success?: boolean; recording?: PracticeRecordingItem; overwritten?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const adminSupabase = createAdminClient();

    const { data: userProfile, error: profileErr } = await adminSupabase
      .from('profiles')
      .select('id, role, full_name, voice_part')
      .eq('id', user.id)
      .single();

    if (profileErr || !userProfile) {
      return { error: 'User profile not found.' };
    }

    if (['pending', 'rejected'].includes(userProfile.role)) {
      return { error: 'Access denied: your account is pending approval.' };
    }

    const file = formData.get('file') as File | null;
    const labelInput = formData.get('label') as string | null;
    const label = labelInput ? labelInput.trim() : null;

    if (!file || typeof file === 'string') {
      return { error: 'No audio file provided.' };
    }

    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      return { error: 'Audio file exceeds maximum size limit of 15MB.' };
    }

    const fileType = file.type || '';
    if (!fileType.startsWith('audio/') && fileType !== 'video/webm' && fileType !== 'video/mp4') {
      return { error: 'Invalid file type. Please record or upload an audio file.' };
    }

    let fileExt = 'webm';
    if (file.name && file.name.includes('.')) {
      fileExt = file.name.split('.').pop() || 'webm';
    } else if (fileType.includes('mp3') || fileType.includes('mpeg')) {
      fileExt = 'mp3';
    } else if (fileType.includes('wav')) {
      fileExt = 'wav';
    } else if (fileType.includes('m4a') || fileType.includes('mp4') || fileType.includes('aac')) {
      fileExt = 'm4a';
    } else if (fileType.includes('ogg')) {
      fileExt = 'ogg';
    }

    // Check if an existing track for this specific song and label already exists
    let existingTrack: any = null;
    if (label) {
      const { data: foundTracks } = await adminSupabase
        .from('practice_tracks')
        .select('*')
        .eq('song_id', songId)
        .eq('label', label);

      if (foundTracks && foundTracks.length > 0) {
        existingTrack = foundTracks[0];
      }
    }

    const filePath = `${songId}/${user.id}_${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to practice_tracks storage bucket
    let { error: uploadErr } = await adminSupabase.storage
      .from('practice_tracks')
      .upload(filePath, buffer, {
        contentType: fileType || 'audio/webm',
        upsert: true,
      });

    if (uploadErr && (uploadErr.message?.toLowerCase().includes('bucket not found') || (uploadErr as any).statusCode === '404' || (uploadErr as any).error === 'Bucket not found')) {
      console.log('Bucket practice_tracks not found, auto-creating bucket...');
      const { error: createBucketErr } = await adminSupabase.storage.createBucket('practice_tracks', {
        public: true,
      });

      if (!createBucketErr) {
        const retryRes = await adminSupabase.storage
          .from('practice_tracks')
          .upload(filePath, buffer, {
            contentType: fileType || 'audio/webm',
            upsert: true,
          });
        uploadErr = retryRes.error;
      }
    }

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return { error: uploadErr.message || 'Failed to upload audio file.' };
    }

    const { data: { publicUrl } } = adminSupabase.storage
      .from('practice_tracks')
      .getPublicUrl(filePath);

    // If overwriting an existing track for this voicing/label, delete old storage object & old DB record
    let isOverwritten = false;
    if (existingTrack) {
      isOverwritten = true;
      if (existingTrack.file_url && existingTrack.file_url.includes('/practice_tracks/')) {
        const oldStoragePath = existingTrack.file_url.split('/practice_tracks/').pop();
        if (oldStoragePath) {
          await adminSupabase.storage.from('practice_tracks').remove([oldStoragePath]);
        }
      }
      await adminSupabase.from('practice_tracks').delete().eq('id', existingTrack.id);
    }

    const userVoicePart = userProfile.voice_part || 'Member';

    const insertData: any = {
      song_id: songId,
      voice_part: userVoicePart,
      file_url: publicUrl,
      uploaded_by: user.id,
      label: label || null,
    };

    let inserted: any = null;
    const { data: insertedRow, error: dbErr } = await adminSupabase
      .from('practice_tracks')
      .insert(insertData)
      .select()
      .single();

    if (dbErr || !insertedRow) {
      console.error('DB insert practice track error:', dbErr);
      const fallbackInsert: any = {
        song_id: songId,
        voice_part: userVoicePart,
        file_url: publicUrl,
      };

      const { data: fallbackRow, error: fallbackErr } = await adminSupabase
        .from('practice_tracks')
        .insert(fallbackInsert)
        .select()
        .single();

      if (fallbackErr || !fallbackRow) {
        await adminSupabase.storage.from('practice_tracks').remove([filePath]);
        return { error: dbErr?.message || fallbackErr?.message || 'Failed to save recording details to database.' };
      }
      inserted = fallbackRow;
    } else {
      inserted = insertedRow;
    }

    // Log history audit record
    const actionType = isOverwritten ? 'OVERWROTE' : 'CREATED';
    await logTrackHistory(adminSupabase, songId, actionType, label, user.id, userProfile.full_name);

    revalidatePath(`/repertoire/${songId}`);

    const recordingItem: PracticeRecordingItem = {
      id: inserted.id,
      song_id: inserted.song_id,
      voice_part: inserted.voice_part,
      file_url: inserted.file_url,
      created_at: inserted.created_at,
      uploaded_by: inserted.uploaded_by || user.id,
      label: inserted.label || label || null,
      uploader_name: userProfile.full_name,
    };

    return { success: true, recording: recordingItem, overwritten: isOverwritten };
  } catch (err: any) {
    console.error('uploadPracticeRecording failed:', err);
    return { error: err.message || 'Server error while uploading recording.' };
  }
}

/**
 * Delete a practice recording and log deletion event to history.
 */
export async function deletePracticeRecording(
  recordingId: string,
  songId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const adminSupabase = createAdminClient();

    const { data: callerProfile } = await adminSupabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single();

    if (!callerProfile) return { error: 'Profile not found.' };

    const isAdmin = ['super_admin', 'director', 'secretary'].includes(callerProfile.role);

    const { data: recording, error: fetchErr } = await adminSupabase
      .from('practice_tracks')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (fetchErr || !recording) {
      return { error: 'Practice recording not found.' };
    }

    const isOwner = recording.uploaded_by ? recording.uploaded_by === user.id : false;

    if (!isOwner && !isAdmin) {
      return { error: 'Permission denied: You can only delete your own recordings.' };
    }

    if (recording.file_url && recording.file_url.includes('/practice_tracks/')) {
      const storagePath = recording.file_url.split('/practice_tracks/').pop();
      if (storagePath) {
        await adminSupabase.storage.from('practice_tracks').remove([storagePath]);
      }
    }

    const { data: deletedRows, error: deleteDbErr } = await adminSupabase
      .from('practice_tracks')
      .delete()
      .eq('id', recordingId)
      .select();

    if (deleteDbErr || !deletedRows || deletedRows.length === 0) {
      return { error: deleteDbErr?.message || 'Failed to delete recording record.' };
    }

    // Log deletion event
    await logTrackHistory(
      adminSupabase,
      songId,
      'DELETED',
      recording.label || null,
      user.id,
      callerProfile.full_name
    );

    revalidatePath(`/repertoire/${songId}`);

    return { success: true };
  } catch (err: any) {
    console.error('deletePracticeRecording error:', err);
    return { error: err.message || 'Server error while deleting recording.' };
  }
}

/**
 * Fetch edit history for a song's practice tracks.
 */
export async function getPracticeTrackHistory(
  songId: string
): Promise<{ history: PracticeTrackHistoryItem[]; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { history: [], error: 'Unauthorized' };

    const adminSupabase = createAdminClient();

    const { data: historyRows, error } = await adminSupabase
      .from('practice_track_history')
      .select('*')
      .eq('song_id', songId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getPracticeTrackHistory notice:', error.message || error);
      return { history: [] };
    }

    return { history: historyRows || [] };
  } catch (err: any) {
    console.error('getPracticeTrackHistory error:', err);
    return { history: [] };
  }
}

/**
 * Clear history logs for a song. Only super_admin and director roles are allowed.
 */
export async function clearPracticeTrackHistory(
  songId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'Unauthorized' };

    const adminSupabase = createAdminClient();

    const { data: callerProfile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile) return { error: 'Profile not found.' };

    // Only super_admin and director can clear history
    const canClear = ['super_admin', 'director'].includes(callerProfile.role);

    if (!canClear) {
      return { error: 'Forbidden: Only Directors and Super Admins can clear edit history.' };
    }

    const { error: deleteErr } = await adminSupabase
      .from('practice_track_history')
      .delete()
      .eq('song_id', songId);

    if (deleteErr) {
      console.error('Clear history error:', deleteErr);
      return { error: deleteErr.message || 'Failed to clear history.' };
    }

    revalidatePath(`/repertoire/${songId}`);

    return { success: true };
  } catch (err: any) {
    console.error('clearPracticeTrackHistory error:', err);
    return { error: err.message || 'Server error clearing history.' };
  }
}
