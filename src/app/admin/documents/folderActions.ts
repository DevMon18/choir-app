'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/permissions';
import { revalidatePath } from 'next/cache';

export interface FolderInput {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parent_id?: string | null;
}

const ADMIN_ROLES = ['super_admin', 'director', 'secretary'];

export async function createFolderAction(input: FolderInput) {
  try {
    const user = await requireUser();
    if (!ADMIN_ROLES.includes(user.role)) {
      return { error: 'Unauthorized to create folders.' };
    }

    const supabase = await createClient();

    if (!input.name || !input.name.trim()) {
      return { error: 'Folder name is required.' };
    }

    const { data: folder, error } = await supabase
      .from('document_folders')
      .insert({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        icon: input.icon || '📁',
        color: input.color || '#0b4d24',
        parent_id: input.parent_id || null,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('[createFolderAction] Error creating folder:', error);
      return { error: `Failed to create folder: ${error.message}` };
    }

    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');

    return { success: true, folder };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updateFolderAction(id: string, input: FolderInput) {
  try {
    const user = await requireUser();
    if (!ADMIN_ROLES.includes(user.role)) {
      return { error: 'Unauthorized to update folders.' };
    }

    const supabase = await createClient();

    if (!input.name || !input.name.trim()) {
      return { error: 'Folder name is required.' };
    }

    const { data: folder, error } = await supabase
      .from('document_folders')
      .update({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        icon: input.icon || '📁',
        color: input.color || '#0b4d24',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      return { error: `Failed to update folder: ${error.message}` };
    }

    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');

    return { success: true, folder };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function deleteFolderAction(folderId: string) {
  try {
    const user = await requireUser();
    if (!ADMIN_ROLES.includes(user.role)) {
      return { error: 'Unauthorized to delete folders.' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('document_folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      return { error: `Failed to delete folder: ${error.message}` };
    }

    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function assignDocumentToFolderAction(documentId: string, folderId: string | null) {
  try {
    const user = await requireUser();
    if (!ADMIN_ROLES.includes(user.role)) {
      return { error: 'Unauthorized to move documents.' };
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('documents')
      .update({ folder_id: folderId })
      .eq('id', documentId);

    if (error) {
      return { error: `Failed to move document: ${error.message}` };
    }

    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}
