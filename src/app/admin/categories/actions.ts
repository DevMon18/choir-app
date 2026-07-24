'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface CategoryItem {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  song_count?: number;
}

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

export const listCategories = async () => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated', categories: [] };

    // Fetch categories with usage song count
    const { data: categories, error } = await supabase
      .from('song_categories')
      .select('id, name, sort_order, created_at, song_category_links(song_id)')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) return { error: error.message, categories: [] };

    const formatted: CategoryItem[] = (categories || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      sort_order: cat.sort_order ?? 0,
      created_at: cat.created_at,
      song_count: Array.isArray(cat.song_category_links) ? cat.song_category_links.length : 0,
    }));

    return { categories: formatted };
  } catch (err: any) {
    return { error: err.message || 'Failed to list categories', categories: [] };
  }
};

export const createCategory = async (rawName: string) => {
  const { supabase, user, error } = await getAdminClient();
  if (error) return { error };

  const name = rawName?.trim();
  if (!name) return { error: 'Category name cannot be empty.' };

  // Get max sort_order
  const { data: existing } = await supabase
    .from('song_categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextSortOrder = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0;

  const { data, error: dbErr } = await supabase
    .from('song_categories')
    .insert({
      name,
      sort_order: nextSortOrder,
      created_by: user?.id,
    })
    .select('id, name, sort_order, created_at')
    .single();

  if (dbErr) return { error: dbErr.message };
  if (!data) return { error: 'Failed to create category (write unconfirmed).' };

  revalidatePath('/admin/songs');
  revalidatePath('/admin/categories');
  revalidatePath('/repertoire');

  return { success: true, category: { ...data, song_count: 0 } };
};

export const renameCategory = async (id: string, rawName: string) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const name = rawName?.trim();
  if (!name) return { error: 'Category name cannot be empty.' };

  const { data, error: dbErr } = await supabase
    .from('song_categories')
    .update({ name })
    .eq('id', id)
    .select('id, name')
    .single();

  if (dbErr) return { error: dbErr.message };
  if (!data) return { error: 'Failed to rename category (write unconfirmed).' };

  revalidatePath('/admin/songs');
  revalidatePath('/admin/categories');
  revalidatePath('/repertoire');

  return { success: true };
};

export const deleteCategory = async (id: string) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const { data, error: dbErr } = await supabase
    .from('song_categories')
    .delete()
    .eq('id', id)
    .select('id');

  if (dbErr) return { error: dbErr.message };
  if (!data || data.length === 0) return { error: 'Failed to delete category (write unconfirmed).' };

  revalidatePath('/admin/songs');
  revalidatePath('/admin/categories');
  revalidatePath('/repertoire');

  return { success: true };
};

export const reorderCategories = async (items: { id: string; sort_order: number }[]) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  if (!items || items.length === 0) return { success: true };

  const updates = items.map((item) =>
    supabase
      .from('song_categories')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
      .select('id')
  );

  const results = await Promise.all(updates);
  const hasError = results.some((r) => r.error);

  if (hasError) {
    const firstErr = results.find((r) => r.error)?.error;
    return { error: firstErr?.message || 'Failed to reorder categories.' };
  }

  revalidatePath('/admin/songs');
  revalidatePath('/admin/categories');
  revalidatePath('/repertoire');

  return { success: true };
};
