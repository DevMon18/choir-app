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
  knownAllergies: z.string().trim().optional(),
  noAllergies: z.boolean().default(false),
  currentMedications: z.string().trim().optional(),
  noMedications: z.boolean().default(false),
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

    const supabaseAdmin = createAdminClient();
    let pdfSignedUrl: string | null = null;

    const isAlreadySigned = ['submitted', 'verified', 'verified_manual'].includes(signature.status);

    if (isAlreadySigned) {
      let stampedPath = signature.signed_pdf_path;

      // Auto-backfill stamped PDF if missing on submitted/verified record
      if (!stampedPath && signature.signature_path && document.file_path) {
        try {
          const templateBuf = await fetchTemplateBuffer(document.file_path);
          if (templateBuf) {
            // Download signature PNG
            let cleanSigPath = signature.signature_path.replace(/^\/+/, '');
            if (cleanSigPath.startsWith('member_signatures/')) {
              cleanSigPath = cleanSigPath.replace(/^member_signatures\//, '');
            }
            const { data: sigBlob } = await supabaseAdmin.storage
              .from('member_signatures')
              .download(cleanSigPath);

            if (sigBlob) {
              const sigBase64 = Buffer.from(await sigBlob.arrayBuffer()).toString('base64');
              const formattedDate = new Date(signature.updated_at || signature.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });

              const { data: memberProf } = await supabaseAdmin
                .from('profiles')
                .select('full_name')
                .eq('id', signature.primary_member_id)
                .single();

              const { generateSignedPdf } = await import('@/lib/pdf-stamper');
              const stampedBytes = await generateSignedPdf({
                templatePdfBuffer: templateBuf,
                signaturePngBase64: sigBase64,
                signerPrintedName: signature.signer_printed_name || memberProf?.full_name || 'Member',
                signerRelationship: signature.signer_relationship || 'Parent / Guardian',
                memberName: memberProf?.full_name || 'Member',
                additionalNames: signature.additional_names || [],
                signedAtDate: formattedDate,
                verificationId: signature.id,
                noAllergies: true,
                noMedications: true,
              });

              const newSignedPath = `${signature.primary_member_id}/${signature.id}_signed_${Date.now()}.pdf`;
              const { error: upErr } = await supabaseAdmin.storage
                .from('member_signatures')
                .upload(newSignedPath, stampedBytes, {
                  contentType: 'application/pdf',
                  upsert: true,
                });

              if (!upErr) {
                stampedPath = newSignedPath;
                await supabaseAdmin
                  .from('document_signatures')
                  .update({ signed_pdf_path: newSignedPath })
                  .eq('id', signature.id);
              }
            }
          }
        } catch (bfErr) {
          console.error('[getSignatureData] Stamped PDF auto-backfill error:', bfErr);
        }
      }

      if (stampedPath) {
        let cleanPath = stampedPath.replace(/^\/+/, '');
        if (cleanPath.startsWith('member_signatures/')) {
          cleanPath = cleanPath.replace(/^member_signatures\//, '');
        }
        const { data: stampedData } = await supabaseAdmin.storage
          .from('member_signatures')
          .createSignedUrl(cleanPath, 3600);
        if (stampedData?.signedUrl) {
          pdfSignedUrl = stampedData.signedUrl;
        }
      }
    }

    // Fallback to raw document template if not signed or stamped PDF unavailable
    if (!pdfSignedUrl && document.file_path) {
      let cleanDocPath = document.file_path.replace(/^\/+/, '');
      if (cleanDocPath.startsWith('choir_documents/')) {
        cleanDocPath = cleanDocPath.replace(/^choir_documents\//, '');
      }
      const { data: pdfData } = await supabaseAdmin.storage
        .from('choir_documents')
        .createSignedUrl(cleanDocPath, 3600); // 1 hour
      pdfSignedUrl = pdfData?.signedUrl || null;
    }

    return {
      signature: signature as any,
      document: document as any,
      pdfSignedUrl,
    };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
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

    const supabaseAdmin = createAdminClient();

    // Direct download
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from('choir_documents')
      .download(cleanPath);

    if (!dlErr && blob) {
      return Buffer.from(await blob.arrayBuffer());
    }

    // Signed URL download fallback
    const { data: signedData } = await supabaseAdmin.storage
      .from('choir_documents')
      .createSignedUrl(cleanPath, 3600);

    if (signedData?.signedUrl) {
      const res = await fetch(signedData.signedUrl);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    }

    // Public URL fallback
    const { data: pubData } = supabaseAdmin.storage
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
    const knownAllergies = (formData.get('knownAllergies') as string) || '';
    const noAllergies = formData.get('noAllergies') === 'true';
    const currentMedications = (formData.get('currentMedications') as string) || '';
    const noMedications = formData.get('noMedications') === 'true';

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
      knownAllergies,
      noAllergies,
      currentMedications,
      noMedications,
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
        const templateBuffer = await fetchTemplateBuffer(docFilePath);

        if (templateBuffer) {
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
            knownAllergies: parsed.data.knownAllergies,
            noAllergies: parsed.data.noAllergies,
            currentMedications: parsed.data.currentMedications,
            noMedications: parsed.data.noMedications,
          });

          signedPdfPath = `${user.id}/${signatureId}_signed_${timestamp}.pdf`;

          const { error: pdfUpErr } = await supabaseAdmin.storage
            .from('member_signatures')
            .upload(signedPdfPath, stampedPdfBytes, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (pdfUpErr) {
            console.error('[submitSignatureAction] Stamped PDF upload failed:', pdfUpErr);
            signedPdfPath = null;
          }
        } else {
          console.error('[submitSignatureAction] Could not download document template at:', docFilePath);
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
