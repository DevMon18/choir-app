'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const getAdminClient = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, error: 'Not authenticated' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const canEdit = ['super_admin', 'director', 'secretary'].includes(profile?.role ?? '');
  if (!canEdit) return { supabase, user, profile, error: 'Insufficient permissions' };

  return { supabase, user, profile, error: null };
};

export const setSongCategories = async (songId: string, categoryIds: string[]) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  // Delete existing category links for this song
  const { error: delErr } = await supabase
    .from('song_category_links')
    .delete()
    .eq('song_id', songId);

  if (delErr) return { error: delErr.message };

  if (categoryIds && categoryIds.length > 0) {
    // Unique IDs only
    const uniqueIds = Array.from(new Set(categoryIds));
    const inserts = uniqueIds.map((catId) => ({
      song_id: songId,
      category_id: catId,
    }));

    const { error: insErr } = await supabase
      .from('song_category_links')
      .insert(inserts);

    if (insErr) return { error: insErr.message };
  }

  return { success: true };
};

export const createSong = async (formData: FormData, categoryIds?: string[]) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const title = (formData.get('title') as string)?.trim();
  const composer = (formData.get('composer') as string)?.trim() || null;
  const arranger = (formData.get('arranger') as string)?.trim() || null;
  const lyrics = (formData.get('lyrics') as string)?.trim() || null;

  if (!title) return { error: 'Song title is required.' };

  // Parse categoryIds from argument or formData if provided
  let catIds: string[] = categoryIds || [];
  if (!categoryIds) {
    const rawCatIds = formData.getAll('categoryIds') as string[];
    if (rawCatIds && rawCatIds.length > 0) {
      catIds = rawCatIds;
    }
  }

  // Get primary category name for legacy fallback if available
  let legacyCategory: string | null = null;
  if (catIds.length > 0) {
    const { data: firstCat } = await supabase
      .from('song_categories')
      .select('name')
      .eq('id', catIds[0])
      .maybeSingle();
    if (firstCat) legacyCategory = firstCat.name;
  }

  const { data, error: dbErr } = await supabase
    .from('songs')
    .insert({ title, composer, arranger, category: legacyCategory, lyrics })
    .select('id')
    .single();

  if (dbErr) return { error: dbErr.message };
  if (!data) return { error: 'Failed to create song (write unconfirmed).' };

  // Link categories
  const linkRes = await setSongCategories(data.id, catIds);
  if (linkRes.error) return { error: linkRes.error };

  revalidatePath('/admin/songs');
  revalidatePath('/repertoire');
  return { success: true, id: data.id };
};

export const updateSong = async (id: string, formData: FormData, categoryIds?: string[]) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const title = (formData.get('title') as string)?.trim();
  const composer = (formData.get('composer') as string)?.trim() || null;
  const arranger = (formData.get('arranger') as string)?.trim() || null;
  const lyrics = (formData.get('lyrics') as string)?.trim() || null;

  if (!title) return { error: 'Song title is required.' };

  // Parse categoryIds from argument or formData if provided
  let catIds: string[] = categoryIds || [];
  if (!categoryIds) {
    const rawCatIds = formData.getAll('categoryIds') as string[];
    if (rawCatIds && rawCatIds.length > 0) {
      catIds = rawCatIds;
    }
  }

  // Get primary category name for legacy fallback if available
  let legacyCategory: string | null = null;
  if (catIds.length > 0) {
    const { data: firstCat } = await supabase
      .from('song_categories')
      .select('name')
      .eq('id', catIds[0])
      .maybeSingle();
    if (firstCat) legacyCategory = firstCat.name;
  }

  const { data, error: dbErr } = await supabase
    .from('songs')
    .update({ title, composer, arranger, category: legacyCategory, lyrics })
    .eq('id', id)
    .select('id')
    .single();

  if (dbErr) return { error: dbErr.message };
  if (!data) return { error: 'Failed to update song (write unconfirmed).' };

  // Link categories
  const linkRes = await setSongCategories(id, catIds);
  if (linkRes.error) return { error: linkRes.error };

  revalidatePath('/admin/songs');
  revalidatePath('/repertoire');
  revalidatePath(`/repertoire/${id}`);
  return { success: true };
};

export const archiveSong = async (id: string) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const { data, error: dbErr } = await supabase
    .from('songs')
    .update({ is_archived: true })
    .eq('id', id)
    .select('id');

  if (dbErr) return { error: dbErr.message };
  if (!data || data.length === 0) return { error: 'Failed to archive song (write unconfirmed).' };

  revalidatePath('/admin/songs');
  revalidatePath('/repertoire');
  return { success: true };
};

export const restoreSong = async (id: string) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const { data, error: dbErr } = await supabase
    .from('songs')
    .update({ is_archived: false })
    .eq('id', id)
    .select('id');

  if (dbErr) return { error: dbErr.message };
  if (!data || data.length === 0) return { error: 'Failed to restore song (write unconfirmed).' };

  revalidatePath('/admin/songs');
  return { success: true };
};
