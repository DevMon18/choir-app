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
  known_allergies?: string | null;
  no_allergies?: boolean;
  current_medications?: string | null;
  no_medications?: boolean;
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

async function getVerificationSupabase() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      return createAdminClient();
    } catch {
      // Fallback
    }
  }
  return await createClient();
}

async function fetchTemplateBuffer(filePath: string): Promise<Buffer | null> {
  try {
    if (!filePath || !filePath.trim()) return null;
    let cleanPath = filePath.trim();

    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      const res = await fetch(cleanPath);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    }

    cleanPath = cleanPath.replace(/^\/+/, '');
    if (cleanPath.startsWith('choir_documents/')) {
      cleanPath = cleanPath.replace(/^choir_documents\//, '');
    }

    const supabaseClient = await getVerificationSupabase();

    const { data: blob, error: dlErr } = await supabaseClient.storage
      .from('choir_documents')
      .download(cleanPath);

    if (!dlErr && blob) {
      return Buffer.from(await blob.arrayBuffer());
    }

    const { data: signedData } = await supabaseClient.storage
      .from('choir_documents')
      .createSignedUrl(cleanPath, 3600);

    if (signedData?.signedUrl) {
      const res = await fetch(signedData.signedUrl);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    }

    const { data: pubData } = supabaseClient.storage
      .from('choir_documents')
      .getPublicUrl(cleanPath);

    if (pubData?.publicUrl) {
      const res = await fetch(pubData.publicUrl);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    }

    return null;
  } catch (err) {
    console.error('[fetchTemplateBuffer] Error:', err);
    return null;
  }
}

export async function getPendingVerifications(statusFilter: string = 'submitted'): Promise<VerificationCardData[]> {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    return [];
  }

  const supabaseClient = await getVerificationSupabase();

  let query = supabaseClient
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

  // Generate signed URLs and auto-backfill missing signed PDFs if signature exists
  const enrichedRows = await Promise.all(
    rows.map(async (row) => {
      let signatureSignedUrl: string | null = null;
      let selfieSignedUrl: string | null = null;
      let signedPdfSignedUrl: string | null = null;

      if (row.signature_path) {
        try {
          const { data: sigData } = await supabaseClient.storage
            .from('member_signatures')
            .createSignedUrl(row.signature_path, 3600);
          signatureSignedUrl = sigData?.signedUrl || null;
        } catch {}
      }

      if (row.selfie_path) {
        try {
          const { data: selfieData } = await supabaseClient.storage
            .from('member_signatures')
            .createSignedUrl(row.selfie_path, 3600);
          selfieSignedUrl = selfieData?.signedUrl || null;
        } catch {}
      }

      // Auto-backfill missing signed_pdf_path for existing submitted signatures
      if (!row.signed_pdf_path && row.signature_path && row.document_id) {
        try {
          const { data: docData } = await supabaseClient
            .from('documents')
            .select('file_path')
            .eq('id', row.document_id)
            .single();

          if (docData?.file_path) {
            const templateBuffer = await fetchTemplateBuffer(docData.file_path);
            const { data: sigBlob } = await supabaseClient.storage
              .from('member_signatures')
              .download(row.signature_path);

            if (templateBuffer && sigBlob) {
              const sigArrayBuf = await sigBlob.arrayBuffer();
              const sigBase64 = Buffer.from(sigArrayBuf).toString('base64');
              const { generateSignedPdf } = await import('@/lib/pdf-stamper');

              const stampedBytes = await generateSignedPdf({
                templatePdfBuffer: templateBuffer,
                signaturePngBase64: sigBase64,
                signerPrintedName: row.signer_printed_name || row.member?.full_name || 'Signer',
                signerRelationship: row.signer_relationship || 'Parent / Guardian',
                memberName: row.member?.full_name || 'Member',
                additionalNames: row.additional_names || [],
                signedAtDate: new Date(row.updated_at || row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                verificationId: row.id,
                knownAllergies: row.known_allergies,
                noAllergies: row.no_allergies,
                currentMedications: row.current_medications,
                noMedications: row.no_medications,
              });

              const autoPdfPath = `${row.primary_member_id}/${row.id}_signed_${Date.now()}.pdf`;
              const { error: upErr } = await supabaseClient.storage
                .from('member_signatures')
                .upload(autoPdfPath, stampedBytes, { contentType: 'application/pdf', upsert: true });

              if (!upErr) {
                await supabaseClient
                  .from('document_signatures')
                  .update({ signed_pdf_path: autoPdfPath })
                  .eq('id', row.id);

                row.signed_pdf_path = autoPdfPath;
              }
            }
          }
        } catch (autoErr) {
          console.error('[getPendingVerifications] Auto-backfill error:', autoErr);
        }
      }

      if (row.signed_pdf_path) {
        try {
          const { data: pdfData } = await supabaseClient.storage
            .from('member_signatures')
            .createSignedUrl(row.signed_pdf_path, 3600);
          signedPdfSignedUrl = pdfData?.signedUrl || null;
        } catch {}
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
  const supabaseClient = await getVerificationSupabase();

  const { error } = await supabaseClient
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
  revalidatePath('/my-documents');
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

  const supabaseClient = await getVerificationSupabase();

  const { error } = await supabaseClient
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
  revalidatePath('/my-documents');
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

  const supabaseClient = await getVerificationSupabase();

  // Fetch current paths to delete files from storage
  const { data: current } = await supabaseClient
    .from('document_signatures')
    .select('signature_path, selfie_path, signed_pdf_path')
    .eq('id', signatureId)
    .single();

  if (current) {
    const filesToDelete: string[] = [];
    if (current.signature_path) filesToDelete.push(current.signature_path);
    if (current.selfie_path) filesToDelete.push(current.selfie_path);
    if (current.signed_pdf_path) filesToDelete.push(current.signed_pdf_path);

    if (filesToDelete.length > 0) {
      try {
        await supabaseClient.storage
          .from('member_signatures')
          .remove(filesToDelete);
      } catch (err) {
        console.warn('[rejectSignatureAction] Storage remove warning:', err);
      }
    }
  }

  // Update status to rejected and clear storage paths
  const { error } = await supabaseClient
    .from('document_signatures')
    .update({
      status: 'rejected',
      signature_path: null,
      selfie_path: null,
      signed_pdf_path: null,
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
  revalidatePath('/my-documents');
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

  const supabaseClient = await getVerificationSupabase();

  const { error } = await supabaseClient
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
  revalidatePath('/my-documents');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function deleteSignatureAction(signatureId: string) {
  const profile = await getProfile();
  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    return { success: false, error: 'Unauthorized. Admin role required.' };
  }

  const parseRes = SingleSignatureSchema.safeParse({ signatureId });
  if (!parseRes.success) {
    return { success: false, error: 'Invalid signature ID' };
  }

  const supabaseClient = await getVerificationSupabase();

  // Fetch current paths to delete files from storage
  const { data: current } = await supabaseClient
    .from('document_signatures')
    .select('signature_path, selfie_path, signed_pdf_path')
    .eq('id', signatureId)
    .single();

  if (current) {
    const filesToDelete: string[] = [];
    if (current.signature_path) filesToDelete.push(current.signature_path);
    if (current.selfie_path) filesToDelete.push(current.selfie_path);
    if (current.signed_pdf_path) filesToDelete.push(current.signed_pdf_path);

    if (filesToDelete.length > 0) {
      try {
        await supabaseClient.storage
          .from('member_signatures')
          .remove(filesToDelete);
      } catch (err) {
        console.warn('[deleteSignatureAction] Storage delete warning:', err);
      }
    }
  }

  // Delete row from document_signatures database table
  const { error } = await supabaseClient
    .from('document_signatures')
    .delete()
    .eq('id', signatureId);

  if (error) {
    console.error('[deleteSignatureAction]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/admin/verifications');
  revalidatePath('/admin/documents');
  revalidatePath('/my-documents');
  revalidatePath('/dashboard');
  return { success: true };
}
