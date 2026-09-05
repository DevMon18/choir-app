'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { invalidateCalendarCache } from '@/app/calendar/actions';
import { getProfile } from '@/lib/supabase/user';

const SEQUENCE_MANAGER_ROLES = ['super_admin', 'director', 'secretary'];
const LIVE_DIRECTOR_ROLES = ['super_admin', 'director', 'secretary'];

// ── Sequence CRUD ──────────────────────────────────────

export async function createSequence(formData: FormData) {
  const profile = await getProfile();
  if (!profile || !SEQUENCE_MANAGER_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: You do not have permission to create sequences.' };
  }

  const supabase = await createClient();
  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const scheduled_at = formData.get('scheduled_at') as string | null;

  const { error } = await supabase.from('mass_sequences').insert({
    title: title.trim(),
    description: description?.trim() || null,
    scheduled_at: scheduled_at || null,
    created_by: profile.id,
  });

  if (error) return { error: error.message };
  await invalidateCalendarCache();
  revalidatePath('/admin/sequences');
  revalidatePath('/calendar');
  return { success: true };
}

export async function updateSequence(id: string, formData: FormData) {
  const profile = await getProfile();
  if (!profile || !SEQUENCE_MANAGER_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: You do not have permission to update sequences.' };
  }

  const supabase = await createClient();
  const title = formData.get('title') as string;
  const description = formData.get('description') as string | null;
  const scheduled_at = formData.get('scheduled_at') as string | null;

  const { error } = await supabase
    .from('mass_sequences')
    .update({
      title: title.trim(),
      description: description?.trim() || null,
      scheduled_at: scheduled_at || null,
    })
    .eq('id', id);

  if (error) return { error: error.message };
  await invalidateCalendarCache();
  revalidatePath('/admin/sequences');
  revalidatePath('/calendar');
  return { success: true };
}

export async function deleteSequence(id: string) {
  const profile = await getProfile();
  if (!profile || !SEQUENCE_MANAGER_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: You do not have permission to delete sequences.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('mass_sequences').delete().eq('id', id);
  if (error) return { error: error.message };
  await invalidateCalendarCache();
  revalidatePath('/admin/sequences');
  revalidatePath('/calendar');
  return { success: true };
}

// ── Sequence Items ─────────────────────────────────────

export async function addSongToSequence(sequenceId: string, songId: string, roleInMass?: string) {
  const profile = await getProfile();
  if (!profile || !SEQUENCE_MANAGER_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: You do not have permission to modify sequences.' };
  }

  const supabase = await createClient();

  // Get current max order_index for this sequence
  const { data: items } = await supabase
    .from('sequence_items')
    .select('order_index')
    .eq('sequence_id', sequenceId)
    .order('order_index', { ascending: false })
    .limit(1);

  const nextOrder = items && items.length > 0 ? items[0].order_index + 1 : 0;

  const { error } = await supabase.from('sequence_items').insert({
    sequence_id: sequenceId,
    song_id: songId,
    order_index: nextOrder,
    position: nextOrder,
    role_in_mass: roleInMass || null,
  });

  if (error) return { error: error.message };
  revalidatePath('/admin/sequences');
  return { success: true };
}

export async function removeSongFromSequence(itemId: string) {
  const profile = await getProfile();
  if (!profile || !SEQUENCE_MANAGER_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: You do not have permission to modify sequences.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('sequence_items').delete().eq('id', itemId);
  if (error) return { error: error.message };
  revalidatePath('/admin/sequences');
  return { success: true };
}

export async function reorderSequenceItems(
  items: { id: string; order_index: number }[]
) {
  const profile = await getProfile();
  if (!profile || !SEQUENCE_MANAGER_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: You do not have permission to modify sequences.' };
  }

  const supabase = await createClient();
  // Update each item's order_index
  const updates = items.map(({ id, order_index }) =>
    supabase.from('sequence_items').update({ order_index, position: order_index }).eq('id', id)
  );
  const results = await Promise.all(updates);
  const err = results.find((r) => r.error);
  if (err?.error) return { error: err.error.message };
  revalidatePath('/admin/sequences');
  return { success: true };
}

// ── Live Sessions ──────────────────────────────────────

export async function startLiveSession(sequenceId: string, firstSongId: string | null) {
  const profile = await getProfile();
  if (!profile || !LIVE_DIRECTOR_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: Only director and admin can start a live session.' };
  }

  const supabase = await createClient();

  // Fetch sequence details to populate title and scheduled_at for backwards compatibility
  const { data: seq } = await supabase
    .from('mass_sequences')
    .select('title, scheduled_at')
    .eq('id', sequenceId)
    .single();

  const title = seq?.title || 'Live Mass';
  const scheduled_at = seq?.scheduled_at || new Date().toISOString();

  // End any currently active sessions first
  await supabase
    .from('live_sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('live_sessions')
    .insert({
      sequence_id: sequenceId,
      active_song_id: firstSongId,
      title,
      scheduled_at,
      director_semitones: 0,
      scroll_speed: 2,
      is_active: true,
      started_by: profile.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  revalidatePath('/live');
  return { success: true, session: data };
}

export async function updateLiveSession(
  sessionId: string,
  updates: {
    active_song_id?: string | null;
    director_semitones?: number;
    scroll_speed?: number;
    show_chords?: boolean;
  }
) {
  const profile = await getProfile();
  if (!profile || !LIVE_DIRECTOR_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: Only director and admin can control or change songs in the live session.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('live_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) return { error: error.message };
  revalidatePath('/live');
  return { success: true };
}

export async function endLiveSession(sessionId: string) {
  const profile = await getProfile();
  if (!profile || !LIVE_DIRECTOR_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: Only director and admin can end a live session.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('live_sessions')
    .update({ is_active: false, ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) return { error: error.message };
  revalidatePath('/live');
  revalidatePath('/admin/sequences');
  return { success: true };
}

export async function updateSequenceItemRole(itemId: string, roleInMass: string) {
  const profile = await getProfile();
  if (!profile || !SEQUENCE_MANAGER_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: You do not have permission to modify sequences.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('sequence_items')
    .update({ role_in_mass: roleInMass || null })
    .eq('id', itemId);

  if (error) return { error: error.message };
  revalidatePath('/admin/sequences');
  return { success: true };
}

export async function substituteSequenceSong(
  sequenceId: string,
  newSongId: string,
  currentSequenceItemId?: string | null,
  roleInMass?: string | null
) {
  const profile = await getProfile();
  if (!profile || !LIVE_DIRECTOR_ROLES.includes(profile.role)) {
    return { error: 'Unauthorized: Only director and admin can substitute or change songs during live session.' };
  }

  const supabase = await createClient();

  if (currentSequenceItemId) {
    const { error } = await supabase
      .from('sequence_items')
      .update({ song_id: newSongId })
      .eq('id', currentSequenceItemId);

    if (!error) {
      revalidatePath('/live');
      revalidatePath('/admin/sequences');
      return { success: true };
    }
  }

  if (roleInMass) {
    const { data: matchingItem } = await supabase
      .from('sequence_items')
      .select('id')
      .eq('sequence_id', sequenceId)
      .eq('role_in_mass', roleInMass)
      .limit(1)
      .maybeSingle();

    if (matchingItem) {
      const { error } = await supabase
        .from('sequence_items')
        .update({ song_id: newSongId })
        .eq('id', matchingItem.id);

      if (!error) {
        revalidatePath('/live');
        revalidatePath('/admin/sequences');
        return { success: true };
      }
    }
  }

  return addSongToSequence(sequenceId, newSongId, roleInMass || undefined);
}


