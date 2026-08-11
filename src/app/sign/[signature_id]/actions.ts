'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/permissions';
import { checkRateLimitUpload } from '@/lib/ratelimit';

// ─── Zod Validation Schemas ───────────────────────────────────────────────────

const SubmitSignatureSchema = z.object({
  signatureId: z.string().uuid('Invalid signature ID.'),
  signerPrintedName: z
    .string()
    .trim()
    .min(2, 'Printed name must be at least 2 characters.')
    .max(150, 'Printed name is too long.'),
  signerRelationship: z
    .string()
    .trim()
    .min(2, 'Relationship is required.')
    .default('Parent / Guardian'),
  additionalNames: z.array(z.string().trim()).default([]),
});

// ─── Data Fetchers ────────────────────────────────────────────────────────────

export interface SignPageData {
  signature: {
    id: string;
    document_id: string;
    activity_id: string | null;
    primary_member_id: string;
    additional_names: string[];
    signer_printed_name: string | null;
    status: 'pending' | 'submitted' | 'verified' | 'verified_manual' | 'rejected';
    signature_path: string | null;
    selfie_path: string | null;
    created_at: string;
  };
  document: {
    id: string;
    title: string;
    type: string;
    file_path: string;
    expires_at: string | null;
  };
  pdfSignedUrl: string | null;
}

/**
 * Retrieve signature record and associated document details for the signing page.
 */
export async function getSignatureData(signatureId: string): Promise<SignPageData | { error: string }> {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    // Fetch signature row
    const { data: signature, error: sigError } = await supabase
      .from('document_signatures')
      .select('*')
      .eq('id', signatureId)
      .single();

    if (sigError || !signature) {
      return { error: 'Signature request not found.' };
    }

    // Verify owner or admin permission
    const isOwner = signature.primary_member_id === user.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = ['super_admin', 'director', 'secretary'].includes(profile?.role || '');
    if (!isOwner && !isAdmin) {
      return { error: 'Unauthorized to view this signature request.' };
    }

    // Fetch document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, title, type, file_path, expires_at')
      .eq('id', signature.document_id)
      .single();

    if (docError || !document) {
      return { error: 'Associated document template not found.' };
    }

    // Generate signed URL for PDF template using admin client
    const supabaseAdmin = createAdminClient();
    const { data: pdfData } = await supabaseAdmin.storage
      .from('choir_documents')
      .createSignedUrl(document.file_path, 3600); // 1 hour

    return {
      signature: signature as any,
      document: document as any,
      pdfSignedUrl: pdfData?.signedUrl || null,
    };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Submit signature & selfie images, signer printed name, and dependent names.
 * Uploads files to private `member_signatures` bucket under owner uid prefix.
 */
export async function submitSignatureAction(formData: FormData) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const rateLimit = await checkRateLimitUpload(user.id);
    if (!rateLimit.success) {
      return { error: 'Upload rate limit reached. Please wait a moment and try again.' };
    }

    // Parse scalar fields
    const signatureId = formData.get('signatureId') as string;
    const signerPrintedName = formData.get('signerPrintedName') as string;
    const signerRelationship = (formData.get('signerRelationship') as string) || 'Parent / Guardian';
    const rawAdditionalNames = formData.get('additionalNames') as string;

    let additionalNames: string[] = [];
    if (rawAdditionalNames) {
      try {
        additionalNames = JSON.parse(rawAdditionalNames);
      } catch {
        additionalNames = [];
      }
    }

    // Validate with Zod
    const parsed = SubmitSignatureSchema.safeParse({
      signatureId,
      signerPrintedName,
      signerRelationship,
      additionalNames,
    });

    if (!parsed.success) {
      const message = parsed.error.issues.map((e: any) => e.message).join(' ');
      return { error: message };
    }

    // Extract files
    const signatureFile = formData.get('signatureFile') as File | null;
    const selfieFile = formData.get('selfieFile') as File | null;

    if (!signatureFile || signatureFile.size === 0) {
      return { error: 'Signature drawing is required.' };
    }
    if (!selfieFile || selfieFile.size === 0) {
      return { error: 'Selfie photo capture is required.' };
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (signatureFile.size > MAX_FILE_SIZE || selfieFile.size > MAX_FILE_SIZE) {
      return { error: 'Uploaded files must not exceed 10 MB.' };
    }

    // Confirm ownership of signature row
    const { data: sigRow, error: sigErr } = await supabase
      .from('document_signatures')
      .select('id, primary_member_id, status')
      .eq('id', signatureId)
      .single();

    if (sigErr || !sigRow) {
      return { error: 'Signature record not found.' };
    }
    if (sigRow.primary_member_id !== user.id) {
      return { error: 'You are not authorized to submit for this signature request.' };
    }

    // Generate storage paths enforcing owner uid prefix: {user_id}/{signature_id}_sig_{timestamp}.png
    const timestamp = Date.now();
    const sigPath = `${user.id}/${signatureId}_sig_${timestamp}.png`;
    const selfiePath = `${user.id}/${signatureId}_selfie_${timestamp}.jpg`;

    // Upload to member_signatures bucket using admin client (bypasses subtle RLS multipart header quirks)
    const supabaseAdmin = createAdminClient();

    const { error: sigUpErr } = await supabaseAdmin.storage
      .from('member_signatures')
      .upload(sigPath, signatureFile, {
        contentType: 'image/png',
        upsert: true,
      });

    if (sigUpErr) {
      return { error: `Failed to upload signature image: ${sigUpErr.message}` };
    }

    const { error: selfieUpErr } = await supabaseAdmin.storage
      .from('member_signatures')
      .upload(selfiePath, selfieFile, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (selfieUpErr) {
      // Best effort cleanup
      await supabaseAdmin.storage.from('member_signatures').remove([sigPath]);
      return { error: `Failed to upload selfie photo: ${selfieUpErr.message}` };
    }

    // Fetch associated document template to stamp signature on PDF
    const { data: sigRowWithDoc } = await supabase
      .from('document_signatures')
      .select('id, document_id, documents:document_id(file_path)')
      .eq('id', signatureId)
      .single();

    let signedPdfPath: string | null = null;

    const docFilePath = Array.isArray(sigRowWithDoc?.documents)
      ? (sigRowWithDoc.documents[0] as any)?.file_path
      : (sigRowWithDoc?.documents as any)?.file_path;

    if (docFilePath) {
      try {
        const { data: pdfBlob } = await supabaseAdmin.storage
          .from('choir_documents')
          .download(docFilePath);

        if (pdfBlob) {
          const templateBuffer = Buffer.from(await pdfBlob.arrayBuffer());
          const sigArrayBuf = await signatureFile.arrayBuffer();
          const sigBase64 = Buffer.from(sigArrayBuf).toString('base64');

          const formattedDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          const { generateSignedPdf } = await import('@/lib/pdf-stamper');

          const { data: memberProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

          const stampedPdfBytes = await generateSignedPdf({
            templatePdfBuffer: templateBuffer,
            signaturePngBase64: sigBase64,
            signerPrintedName: parsed.data.signerPrintedName,
            signerRelationship: parsed.data.signerRelationship,
            memberName: memberProfile?.full_name || 'Member',
            additionalNames: parsed.data.additionalNames,
            signedAtDate: formattedDate,
            verificationId: signatureId,
          });

          signedPdfPath = `${user.id}/${signatureId}_signed_${timestamp}.pdf`;

          await supabaseAdmin.storage
            .from('member_signatures')
            .upload(signedPdfPath, stampedPdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            });
        }
      } catch (pdfErr) {
        console.error('[submitSignatureAction] Error generating stamped PDF:', pdfErr);
      }
    }

    // Update document_signatures database row
    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        status: 'submitted',
        signer_printed_name: parsed.data.signerPrintedName,
        signer_relationship: parsed.data.signerRelationship,
        additional_names: parsed.data.additionalNames,
        signature_path: sigPath,
        selfie_path: selfiePath,
        signed_pdf_path: signedPdfPath,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signatureId);

    if (updateErr) {
      return { error: `Failed to save signature submission: ${updateErr.message}` };
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin/verifications');
    revalidatePath(`/sign/${signatureId}`);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Retract a submitted signature, resetting status back to 'pending'
 * and deleting stored signature/selfie images.
 */
export async function retractSignatureAction(signatureId: string) {
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: sigRow, error: fetchErr } = await supabase
      .from('document_signatures')
      .select('id, primary_member_id, status, signature_path, selfie_path, signed_pdf_path')
      .eq('id', signatureId)
      .single();

    if (fetchErr || !sigRow) {
      return { error: 'Signature record not found.' };
    }

    if (sigRow.primary_member_id !== user.id) {
      return { error: 'Unauthorized to retract this signature.' };
    }

    if (sigRow.status !== 'submitted') {
      return { error: 'Only submitted signatures can be retracted.' };
    }

    // Delete stored files
    const filesToRemove: string[] = [];
    if (sigRow.signature_path) filesToRemove.push(sigRow.signature_path);
    if (sigRow.selfie_path) filesToRemove.push(sigRow.selfie_path);
    if (sigRow.signed_pdf_path) filesToRemove.push(sigRow.signed_pdf_path);

    if (filesToRemove.length > 0) {
      const supabaseAdmin = createAdminClient();
      await supabaseAdmin.storage.from('member_signatures').remove(filesToRemove);
    }

    // Reset database status to 'pending'
    const { error: updateErr } = await supabase
      .from('document_signatures')
      .update({
        status: 'pending',
        signature_path: null,
        selfie_path: null,
        signed_pdf_path: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', signatureId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/admin/verifications');
    revalidatePath(`/sign/${signatureId}`);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}
