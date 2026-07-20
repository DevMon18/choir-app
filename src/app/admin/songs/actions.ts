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

export const createSong = async (formData: FormData) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const title = (formData.get('title') as string)?.trim();
  const composer = (formData.get('composer') as string)?.trim() || null;
  const arranger = (formData.get('arranger') as string)?.trim() || null;
  const category = (formData.get('category') as string)?.trim() || null;
  const lyrics = (formData.get('lyrics') as string)?.trim() || null;

  if (!title) return { error: 'Song title is required.' };

  const { data, error: dbErr } = await supabase
    .from('songs')
    .insert({ title, composer, arranger, category, lyrics })
    .select('id')
    .single();

  if (dbErr) return { error: dbErr.message };

  revalidatePath('/admin/songs');
  revalidatePath('/repertoire');
  return { success: true, id: data.id };
};

export const updateSong = async (id: string, formData: FormData) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const title = (formData.get('title') as string)?.trim();
  const composer = (formData.get('composer') as string)?.trim() || null;
  const arranger = (formData.get('arranger') as string)?.trim() || null;
  const category = (formData.get('category') as string)?.trim() || null;
  const lyrics = (formData.get('lyrics') as string)?.trim() || null;

  if (!title) return { error: 'Song title is required.' };

  const { error: dbErr } = await supabase
    .from('songs')
    .update({ title, composer, arranger, category, lyrics })
    .eq('id', id);

  if (dbErr) return { error: dbErr.message };

  revalidatePath('/admin/songs');
  revalidatePath('/repertoire');
  revalidatePath(`/repertoire/${id}`);
  return { success: true };
};

export const archiveSong = async (id: string) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const { error: dbErr } = await supabase
    .from('songs')
    .update({ is_archived: true })
    .eq('id', id);

  if (dbErr) return { error: dbErr.message };

  revalidatePath('/admin/songs');
  revalidatePath('/repertoire');
  return { success: true };
};

export const restoreSong = async (id: string) => {
  const { supabase, error } = await getAdminClient();
  if (error) return { error };

  const { error: dbErr } = await supabase
    .from('songs')
    .update({ is_archived: false })
    .eq('id', id);

  if (dbErr) return { error: dbErr.message };

  revalidatePath('/admin/songs');
  return { success: true };
};
