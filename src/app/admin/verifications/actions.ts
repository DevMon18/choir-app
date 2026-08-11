'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/lib/supabase/user';

const BulkVerifySchema = z.object({
  signatureIds: z.array(z.string().uuid()).min(1, 'Select at least one signature to verify'),
});

const SingleSignatureSchema = z.object({
  signatureId: z.string().uuid(),
});

export interface VerificationCardData {
  id: string;
  document_id: string;
  activity_id: string | null;
  primary_member_id: string;
  additional_names: string[];
  signer_printed_name: string | null;
  signer_relationship?: string | null;
  status: 'pending' | 'submitted' | 'verified' | 'verified_manual' | 'rejected';
  signature_path: string | null;
  selfie_path: string | null;
  signed_pdf_path?: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  member: {
    id: string;
    full_name: string;
    email: string;
    voice_part: string | null;
    avatar_url: string | null;
    role: string;
  } | null;
  document: {
    id: string;
    title: string;
    type: string;
    expires_at: string | null;
  } | null;
  verifier?: {
    full_name: string;
  } | null;
  signatureSignedUrl?: string | null;
  selfieSignedUrl?: string | null;
  signedPdfSignedUrl?: string | null;
}

export async function getPendingVerifications(statusFilter: string = 'submitted'): Promise<VerificationCardData[]> {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    return [];
  }

  const adminSupabase = createAdminClient();

  let query = adminSupabase
    .from('document_signatures')
    .select(`
      *,
      member:primary_member_id (
        id, full_name, email, voice_part, avatar_url, role
      ),
      document:document_id (
        id, title, type, expires_at
      ),
      verifier:verified_by (
        full_name
      )
    `)
    .order('updated_at', { ascending: false });

  if (statusFilter !== 'all') {
    if (statusFilter === 'verified') {
      query = query.in('status', ['verified', 'verified_manual']);
    } else {
      query = query.eq('status', statusFilter);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getPendingVerifications] Error fetching verifications:', error);
    return [];
  }

  const rows = (data as any[]) || [];

  // Generate signed URLs for private bucket images and signed PDF
  const enrichedRows = await Promise.all(
    rows.map(async (row) => {
      let signatureSignedUrl: string | null = null;
      let selfieSignedUrl: string | null = null;
      let signedPdfSignedUrl: string | null = null;

      if (row.signature_path) {
        const { data: sigData } = await adminSupabase.storage
          .from('member_signatures')
          .createSignedUrl(row.signature_path, 3600);
        signatureSignedUrl = sigData?.signedUrl || null;
      }

      if (row.selfie_path) {
        const { data: selfieData } = await adminSupabase.storage
          .from('member_signatures')
          .createSignedUrl(row.selfie_path, 3600);
        selfieSignedUrl = selfieData?.signedUrl || null;
      }

      if (row.signed_pdf_path) {
        const { data: pdfData } = await adminSupabase.storage
          .from('member_signatures')
          .createSignedUrl(row.signed_pdf_path, 3600);
        signedPdfSignedUrl = pdfData?.signedUrl || null;
      }

      return {
        ...row,
        signatureSignedUrl,
        selfieSignedUrl,
        signedPdfSignedUrl,
      };
    })
  );

  return enrichedRows;
}

export async function bulkVerifySignaturesAction(rawInput: { signatureIds: string[] }) {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    return { success: false, error: 'Unauthorized. Admin role required.' };
  }

  const parseRes = BulkVerifySchema.safeParse(rawInput);
  if (!parseRes.success) {
    return { success: false, error: parseRes.error.issues[0]?.message || 'Invalid input' };
  }

  const { signatureIds } = parseRes.data;
  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from('document_signatures')
    .update({
      status: 'verified',
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
    })
    .in('id', signatureIds);

  if (error) {
    console.error('[bulkVerifySignaturesAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/verifications');
  revalidatePath('/admin/documents');
  revalidatePath('/dashboard');
  return { success: true, count: signatureIds.length };
}

export async function singleVerifySignatureAction(signatureId: string) {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    return { success: false, error: 'Unauthorized. Admin role required.' };
  }

  const parseRes = SingleSignatureSchema.safeParse({ signatureId });
  if (!parseRes.success) {
    return { success: false, error: 'Invalid signature ID' };
  }

  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from('document_signatures')
    .update({
      status: 'verified',
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', signatureId);

  if (error) {
    console.error('[singleVerifySignatureAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/verifications');
  revalidatePath('/admin/documents');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function rejectSignatureAction(signatureId: string) {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    return { success: false, error: 'Unauthorized. Admin role required.' };
  }

  const parseRes = SingleSignatureSchema.safeParse({ signatureId });
  if (!parseRes.success) {
    return { success: false, error: 'Invalid signature ID' };
  }

  const adminSupabase = createAdminClient();

  // Fetch current paths to delete files from storage
  const { data: current } = await adminSupabase
    .from('document_signatures')
    .select('signature_path, selfie_path')
    .eq('id', signatureId)
    .single();

  if (current) {
    const filesToDelete: string[] = [];
    if (current.signature_path) filesToDelete.push(current.signature_path);
    if (current.selfie_path) filesToDelete.push(current.selfie_path);

    if (filesToDelete.length > 0) {
      await adminSupabase.storage
        .from('member_signatures')
        .remove(filesToDelete);
    }
  }

  // Update status to rejected and clear storage paths
  const { error } = await adminSupabase
    .from('document_signatures')
    .update({
      status: 'rejected',
      signature_path: null,
      selfie_path: null,
      signer_printed_name: null,
      additional_names: [],
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', signatureId);

  if (error) {
    console.error('[rejectSignatureAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/verifications');
  revalidatePath('/admin/documents');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function manualVerifySignatureAction(signatureId: string) {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    return { success: false, error: 'Unauthorized. Admin role required.' };
  }

  const parseRes = SingleSignatureSchema.safeParse({ signatureId });
  if (!parseRes.success) {
    return { success: false, error: 'Invalid signature ID' };
  }

  const adminSupabase = createAdminClient();

  const { error } = await adminSupabase
    .from('document_signatures')
    .update({
      status: 'verified_manual',
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', signatureId);

  if (error) {
    console.error('[manualVerifySignatureAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/verifications');
  revalidatePath('/admin/documents');
  revalidatePath('/dashboard');
  return { success: true };
}
