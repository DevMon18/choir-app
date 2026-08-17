'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser, requireRole } from '@/lib/auth/permissions';
import { checkRateLimitMutation, checkRateLimitUpload } from '@/lib/ratelimit';
import { generateCombinedWaiverPdf, WaiverContent, DEFAULT_WAIVER_CONTENT } from '@/lib/pdf-generator';

import { sendPushToUser } from '@/lib/push';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentType = 'activity_waiver' | 'wedding_waiver' | 'wake_guide' | 'general';

export interface RecipientInfo {
  signatureId: string;
  memberId: string;
  fullName: string;
  email: string;
  role: string;
  voicePart: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: 'pending' | 'submitted' | 'verified' | 'verified_manual' | 'rejected';
  assignedAt: string;
  signedAt: string | null;
  verifiedAt: string | null;
  signerType: 'self' | 'parent_guardian' | null;
  signerPrintedName: string | null;
}

export interface DocumentRow {
  id: string;
  title: string;
  type: DocumentType;
  file_path: string;
  folder_id?: string | null;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  profiles?: { full_name: string } | null;
}

export interface MemberOption {
  id: string;
  full_name: string;
  email: string;
  birthdate: string | null;
  role: string;
}

export interface SequenceOption {
  id: string;
  name: string;
}

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const UploadDocumentSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters.').max(200),
  type: z.enum(['activity_waiver', 'wedding_waiver', 'wake_guide', 'general'] as const, {
    message: 'Invalid document type.',
  }),
  folder_id: z.string().uuid().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});

const DistributeDocumentSchema = z.object({
  documentId: z.string().uuid('Invalid document ID.'),
  activityId: z.string().uuid().nullable().optional(),
  memberIds: z
    .array(z.string().uuid('Invalid member ID.'))
    .min(1, 'Select at least one member to distribute to.'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getAdminContext = async () => {
  const user = await requireUser();
  requireRole(user, ['super_admin', 'director']);

  const supabase = await createClient();
  return { user, supabase };
};

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Upload a PDF document to the `choir_documents` bucket and insert a row
 * into the `documents` table.
 */
export async function uploadDocumentAction(formData: FormData) {
  try {
    const { user, supabase } = await getAdminContext();

    const rateLimit = await checkRateLimitUpload(user.id);
    if (!rateLimit.success) {
      return { error: 'Upload rate limit reached. Please wait a moment and try again.' };
    }

    // ── Validate scalar fields ──────────────────────────────────────────────
    const folderIdRaw = formData.get('folder_id');
    const parsed = UploadDocumentSchema.safeParse({
      title: formData.get('title'),
      type: formData.get('type'),
      folder_id: folderIdRaw && folderIdRaw !== 'none' ? folderIdRaw : null,
      expires_at: formData.get('expires_at') || null,
    });
    if (!parsed.success) {
    const message = parsed.error.issues.map((e: any) => e.message).join(' ');
      return { error: message };
    }

    const file = formData.get('file') as File | null;
    if (!file || file.size === 0) {
      return { error: 'A PDF file is required.' };
    }
    if (file.type !== 'application/pdf') {
      return { error: 'Only PDF files are accepted.' };
    }
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_FILE_SIZE) {
      return { error: 'File size must not exceed 20 MB.' };
    }

    // ── Upload to storage ───────────────────────────────────────────────────
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${timestamp}_${safeName}`;

    const { error: storageError } = await supabase.storage
      .from('choir_documents')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (storageError) {
      return { error: `Storage upload failed: ${storageError.message}` };
    }

    // ── Insert DB row ───────────────────────────────────────────────────────
    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert({
        title: parsed.data.title,
        type: parsed.data.type,
        folder_id: parsed.data.folder_id || null,
        file_path: storagePath,
        created_by: user.id,
        expires_at: parsed.data.expires_at || null,
      })
      .select('id')
      .single();

    if (dbError) {
      // Best-effort cleanup of orphaned storage file
      await supabase.storage.from('choir_documents').remove([storagePath]);
      return { error: `Database insert failed: ${dbError.message}` };
    }

    revalidatePath('/admin/documents');
    return { success: true, id: doc.id };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Delete a document and its associated storage file.
 */
export async function deleteDocumentAction(documentId: string) {
  try {
    const { supabase } = await getAdminContext();

    // Fetch the file path first
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (fetchErr || !doc) {
      return { error: 'Document not found.' };
    }

    // Delete the document row (cascades to document_signatures via FK)
    const { error: dbErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (dbErr) {
      return { error: `Database delete failed: ${dbErr.message}` };
    }

    // Remove the PDF from storage (best-effort; non-fatal)
    await supabase.storage.from('choir_documents').remove([doc.file_path]);

    revalidatePath('/admin/documents');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Distribute a document to selected members by bulk-inserting into
 * `document_signatures` with status = 'pending'.
 */
export async function distributeDocumentAction(input: {
  documentId: string;
  activityId: string | null;
  memberIds: string[];
}) {
  try {
    const { user, supabase } = await getAdminContext();

    const rateLimit = await checkRateLimitMutation(user.id);
    if (!rateLimit.success) {
      return { error: 'Too many requests. Please slow down.' };
    }

    // ── Validate ────────────────────────────────────────────────────────────
    const parsed = DistributeDocumentSchema.safeParse(input);
    if (!parsed.success) {
    const message = parsed.error.issues.map((e: any) => e.message).join(' ');
      return { error: message };
    }

    const { documentId, activityId, memberIds } = parsed.data;

    // Deduplicate member IDs
    const uniqueMemberIds = Array.from(new Set(memberIds));

    // ── Fetch existing pending/submitted sigs to avoid duplicates ───────────
    const { data: existing } = await supabase
      .from('document_signatures')
      .select('primary_member_id')
      .eq('document_id', documentId)
      .in('status', ['pending', 'submitted']);

    const alreadyHave = new Set((existing || []).map((r: any) => r.primary_member_id));
    const toInsert = uniqueMemberIds.filter((id) => !alreadyHave.has(id));

    if (toInsert.length === 0) {
      return {
        success: true,
        distributed: 0,
        skipped: uniqueMemberIds.length,
        message: 'All selected members already have a pending or submitted signature for this document.',
      };
    }

    // ── Bulk insert ─────────────────────────────────────────────────────────
    const rows = toInsert.map((memberId) => ({
      document_id: documentId,
      activity_id: activityId || null,
      primary_member_id: memberId,
      status: 'pending' as const,
    }));

    const { error: insertErr } = await supabase
      .from('document_signatures')
      .insert(rows);

    if (insertErr) {
      return { error: `Distribution failed: ${insertErr.message}` };
    }

    revalidatePath('/admin/documents');
    revalidatePath('/dashboard'); // member dashboard shows pending signature banners

    return {
      success: true,
      distributed: toInsert.length,
      skipped: uniqueMemberIds.length - toInsert.length,
    };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

// ─── Data Fetchers ────────────────────────────────────────────────────────────

// ─── Data Fetchers ────────────────────────────────────────────────────────────

function getStorageClient(userSupabase: any) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      return createAdminClient();
    } catch {
      // Fallback
    }
  }
  return userSupabase;
}

async function fetchPdfBuffer(supabase: any, storageSupabase: any, filePath: string): Promise<Buffer | null> {
  try {
    if (!filePath) return null;
    let targetUrl = filePath;
    if (!filePath.startsWith('http://') && !filePath.startsWith('https://')) {
      const signedUrl = await getDocumentSignedUrl(filePath);
      if (signedUrl) {
        targetUrl = signedUrl;
      }
    }

    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      const res = await fetch(targetUrl);
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
    }

    const { data: blob, error } = await storageSupabase.storage
      .from('choir_documents')
      .download(filePath);

    if (!error && blob) {
      return Buffer.from(await blob.arrayBuffer());
    }

    const { data: userBlob, error: userErr } = await supabase.storage
      .from('choir_documents')
      .download(filePath);

    if (!userErr && userBlob) {
      return Buffer.from(await userBlob.arrayBuffer());
    }

    return null;
  } catch (err) {
    console.error('[fetchPdfBuffer] Error:', err);
    return null;
  }
}

/**
 * Fetch all documents for the admin list.
 */
export async function getDocuments(): Promise<DocumentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('documents')
    .select('*, profiles:created_by(full_name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getDocuments] Error fetching documents:', error);
    return [];
  }
  return (data as DocumentRow[]) || [];
}

export async function getFolders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('document_folders')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('[getFolders] Error fetching folders:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetch all active choir members for the distribution modal.
 */
export async function getActiveMembers(): Promise<MemberOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, birthdate, role')
      .not('role', 'in', '("pending","rejected")')
      .order('full_name');

    if (error) {
      console.error('[getActiveMembers]', error);
      return [];
    }
    return (data as MemberOption[]) || [];
  } catch (err) {
    console.error('[getActiveMembers] unexpected:', err);
    return [];
  }
}

/**
 * Fetch upcoming mass sequences (used as activity link in distribution modal).
 */
export async function getUpcomingSequences(): Promise<SequenceOption[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('mass_sequences')
      .select('id, title')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[getUpcomingSequences]', error);
      return [];
    }
    return (data || []).map((s: any) => ({ id: s.id, name: s.title }));
  } catch (err) {
    console.error('[getUpcomingSequences] unexpected:', err);
    return [];
  }
}

/**
 * Generate a short-lived signed URL for a document PDF.
 */
export async function getDocumentSignedUrl(filePath: string): Promise<string | null> {
  try {
    if (!filePath || !filePath.trim()) return null;
    let cleanPath = filePath.trim();

    if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
      return cleanPath;
    }

    // Strip leading slashes or bucket name if prefixed
    cleanPath = cleanPath.replace(/^\/+/, '');
    if (cleanPath.startsWith('choir_documents/')) {
      cleanPath = cleanPath.replace(/^choir_documents\//, '');
    }

    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.storage
      .from('choir_documents')
      .createSignedUrl(cleanPath, 3600);

    if (!userErr && userData?.signedUrl) {
      return userData.signedUrl;
    }

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const adminSupabase = createAdminClient();
        const { data: adminData, error: adminErr } = await adminSupabase.storage
          .from('choir_documents')
          .createSignedUrl(cleanPath, 3600);
        if (!adminErr && adminData?.signedUrl) {
          return adminData.signedUrl;
        }
      } catch (err) {
        console.error('[getDocumentSignedUrl] Admin client failed:', err);
      }
    }

    // Fallback: public URL
    const { data: pubData } = supabase.storage
      .from('choir_documents')
      .getPublicUrl(cleanPath);

    if (pubData?.publicUrl) {
      return pubData.publicUrl;
    }

    return null;
  } catch (err) {
    console.error('[getDocumentSignedUrl] Unexpected error:', err);
    return null;
  }
}

/**
 * Rename a document title.
 */
export async function renameDocumentAction(documentId: string, newTitle: string) {
  try {
    const { user, supabase } = await getAdminContext();
    if (!newTitle || !newTitle.trim()) {
      return { error: 'Document title cannot be empty.' };
    }
    const { error } = await supabase
      .from('documents')
      .update({ title: newTitle.trim() })
      .eq('id', documentId);

    if (error) {
      console.error('[renameDocumentAction] DB error:', error);
      return { error: 'Failed to rename document.' };
    }
    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');
    return { success: true };
  } catch (err: any) {
    console.error('[renameDocumentAction] unexpected:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Move a document to a different folder (or root drive if null).
 */
export async function moveDocumentAction(documentId: string, newFolderId: string | null) {
  try {
    const { user, supabase } = await getAdminContext();
    const { error } = await supabase
      .from('documents')
      .update({ folder_id: newFolderId || null })
      .eq('id', documentId);

    if (error) {
      console.error('[moveDocumentAction] DB error:', error);
      return { error: 'Failed to move document.' };
    }
    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');
    return { success: true };
  } catch (err: any) {
    console.error('[moveDocumentAction] unexpected:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Appends the Waiver Page (Page 2) directly onto an existing uploaded PDF document in-place,
 * converting it to an Activity Waiver document without creating duplicate files.
 */
export async function createWaiverFromDocumentAction(input: {
  documentId: string;
  customTitle?: string;
  waiverContent?: WaiverContent;
}) {
  try {
    const { user, supabase } = await getAdminContext();
    const storageSupabase = getStorageClient(supabase);

    // Fetch original document row
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', input.documentId)
      .single();

    if (fetchErr || !doc) {
      return { error: 'Source document not found.' };
    }

    // Download original PDF from choir_documents bucket safely
    const templatePdfBuffer = await fetchPdfBuffer(supabase, storageSupabase, doc.file_path);
    if (!templatePdfBuffer) {
      console.warn(`[createWaiverFromDocumentAction] Source PDF at ${doc.file_path} could not be downloaded. Generating standalone waiver page.`);
    }

    const title = input.customTitle?.trim() || doc.title;
    const waiverContent = input.waiverContent || DEFAULT_WAIVER_CONTENT;

    // Generate combined 2-page PDF (Page 1 = Original PDF, Page 2 = Waiver)
    const combinedBytes = await generateCombinedWaiverPdf({
      templatePdfBuffer: templatePdfBuffer || undefined,
      title,
      waiverContent,
    });

    // Overwrite combined PDF to the existing document's file_path in storage
    const { error: uploadErr } = await storageSupabase.storage
      .from('choir_documents')
      .upload(doc.file_path, combinedBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      return { error: `Failed to update document PDF in storage: ${uploadErr.message}` };
    }

    // Update existing document DB row to type = 'activity_waiver'
    const { data: updatedDoc, error: updateErr } = await supabase
      .from('documents')
      .update({
        title,
        type: 'activity_waiver' as const,
      })
      .eq('id', doc.id)
      .select('*, profiles:created_by(full_name)')
      .single();

    if (updateErr) {
      return { error: `Database update failed: ${updateErr.message}` };
    }

    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');
    return { success: true, id: updatedDoc.id, title, document: updatedDoc as DocumentRow };
  } catch (err: any) {
    console.error('[createWaiverFromDocumentAction] unexpected:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Saves updated waiver clauses and title for an Activity Waiver document,
 * regenerating the combined PDF file in storage.
 */
export async function saveWaiverTemplateAction(input: {
  documentId: string;
  title: string;
  waiverContent: WaiverContent;
}) {
  try {
    const { user, supabase } = await getAdminContext();
    const storageSupabase = getStorageClient(supabase);

    // Fetch existing document row
    const { data: doc, error: fetchErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', input.documentId)
      .single();

    if (fetchErr || !doc) {
      return { error: 'Document not found.' };
    }

    const templateBuffer = await fetchPdfBuffer(supabase, storageSupabase, doc.file_path);

    // Generate updated PDF
    const updatedPdfBytes = await generateCombinedWaiverPdf({
      templatePdfBuffer: templateBuffer || undefined,
      title: input.title.trim(),
      waiverContent: input.waiverContent,
    });

    // Re-upload to doc's storage path
    const { error: uploadErr } = await storageSupabase.storage
      .from('choir_documents')
      .upload(doc.file_path, updatedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      return { error: `Failed to update PDF in storage: ${uploadErr.message}` };
    }

    // Update DB row
    const { error: updateErr } = await supabase
      .from('documents')
      .update({
        title: input.title.trim(),
      })
      .eq('id', input.documentId);

    if (updateErr) {
      return { error: `Failed to update database record: ${updateErr.message}` };
    }

    revalidatePath('/admin/documents');
    revalidatePath('/my-documents');
    return { success: true };
  } catch (err: any) {
    console.error('[saveWaiverTemplateAction] unexpected:', err);
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Fetch all assigned recipients of a document and their real-time signing/submission status.
 * (Identifies who has submitted and who hasn't submitted yet).
 */
export async function getDocumentRecipientsAction(documentId: string) {
  try {
    const { supabase } = await getAdminContext();

    const { data: sigs, error } = await supabase
      .from('document_signatures')
      .select(`
        id, primary_member_id, status, created_at, signed_at, verified_at,
        signer_type, signer_printed_name,
        profiles:primary_member_id ( id, full_name, email, role, voice_part, phone, avatar_url )
      `)
      .eq('document_id', documentId)
      .order('created_at', { ascending: false });

    if (error) {
      return { error: `Failed to load recipients: ${error.message}` };
    }

    const recipients: RecipientInfo[] = (sigs || []).map((s: any) => {
      const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      return {
        signatureId: s.id,
        memberId: s.primary_member_id,
        fullName: p?.full_name || 'Unknown Member',
        email: p?.email || '',
        role: p?.role || 'member',
        voicePart: p?.voice_part || null,
        phone: p?.phone || null,
        avatarUrl: p?.avatar_url || null,
        status: s.status,
        assignedAt: s.created_at,
        signedAt: s.signed_at,
        verifiedAt: s.verified_at,
        signerType: s.signer_type,
        signerPrintedName: s.signer_printed_name,
      };
    });

    const pendingRecipients = recipients.filter((r) => r.status === 'pending');
    const submittedRecipients = recipients.filter((r) => r.status === 'submitted');
    const verifiedRecipients = recipients.filter((r) => r.status === 'verified' || r.status === 'verified_manual');
    const rejectedRecipients = recipients.filter((r) => r.status === 'rejected');

    return {
      success: true,
      recipients,
      totalCount: recipients.length,
      pendingCount: pendingRecipients.length,
      submittedCount: submittedRecipients.length,
      verifiedCount: verifiedRecipients.length,
      rejectedCount: rejectedRecipients.length,
      completionRate:
        recipients.length > 0
          ? Math.round(((submittedRecipients.length + verifiedRecipients.length) / recipients.length) * 100)
          : 0,
    };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

/**
 * Send a notification/reminder to members who have not yet submitted their waiver.
 */
export async function sendWaiverReminderAction(input: {
  documentId: string;
  documentTitle: string;
  memberIds?: string[];
}) {
  try {
    const { user, supabase } = await getAdminContext();

    const rateLimit = await checkRateLimitMutation(user.id);
    if (!rateLimit.success) {
      return { error: 'Too many requests. Please slow down.' };
    }

    let query = supabase
      .from('document_signatures')
      .select('primary_member_id')
      .eq('document_id', input.documentId)
      .eq('status', 'pending');

    if (input.memberIds && input.memberIds.length > 0) {
      query = query.in('primary_member_id', input.memberIds);
    }

    const { data: pendingSigs, error } = await query;
    if (error) {
      return { error: `Failed to query pending members: ${error.message}` };
    }

    const targetUserIds = Array.from(new Set((pendingSigs || []).map((s: any) => s.primary_member_id)));

    if (targetUserIds.length === 0) {
      return { success: true, count: 0, message: 'All members have already submitted their waiver!' };
    }

    // Send push notification to all pending members
    await Promise.allSettled(
      targetUserIds.map((userId) =>
        sendPushToUser(userId, {
          title: '⚠️ Action Required: Pending Waiver Signature',
          body: `Please review and sign "${input.documentTitle}". Tap here to complete.`,
          url: '/dashboard',
        })
      )
    );

    return {
      success: true,
      count: targetUserIds.length,
      message: `Sent reminder to ${targetUserIds.length} member${targetUserIds.length !== 1 ? 's' : ''} who haven't submitted yet.`,
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to send waiver reminder.' };
  }
}

