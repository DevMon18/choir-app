'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/permissions';

/**
 * Toggle archive status (is_archived) for a document signature record owned by the member.
 * Members can archive verified waivers so they disappear from their home dashboard feed.
 */
export async function toggleArchiveSignatureAction(signatureId: string) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    // Verify ownership & status
    const { data: sigRow, error: fetchErr } = await supabase
      .from('document_signatures')
      .select('id, primary_member_id, status, is_archived')
      .eq('id', signatureId)
      .single();

    if (fetchErr || !sigRow) {
      return { error: 'Signature record not found.' };
    }

    if (sigRow.primary_member_id !== user.id) {
      return { error: 'Unauthorized to modify this signature record.' };
    }

    const nextArchivedState = !sigRow.is_archived;

    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        is_archived: nextArchivedState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signatureId);

    if (updateErr) {
      return { error: `Failed to archive document: ${updateErr.message}` };
    }

    revalidatePath('/dashboard');
    revalidatePath('/my-documents');
    revalidatePath(`/sign/${signatureId}`);

    return { success: true, is_archived: nextArchivedState };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}
