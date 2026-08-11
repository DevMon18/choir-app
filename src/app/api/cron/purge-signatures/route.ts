/**
 * /api/cron/purge-signatures
 *
 * Companion to the pg_cron job in Phase 1 migration.
 * This route:
 *   1. Finds `document_signatures` where status='verified', verified_at < 30 days ago,
 *      and either signature_path or selfie_path is still set.
 *   2. Deletes the actual files from the 'member_signatures' Supabase Storage bucket.
 *   3. Nulls out the paths in the DB row (audit trail preserved).
 *
 * Secured by CRON_SECRET env variable.
 * Call via pg_cron HTTP (or Vercel Cron Jobs) daily at 02:00 UTC.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ── Security gate ──────────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization');
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Find rows eligible for file purge
    const { data: rows, error: fetchError } = await supabase
      .from('document_signatures')
      .select('id, primary_member_id, signature_path, selfie_path')
      .eq('status', 'verified')
      .lt('verified_at', THIRTY_DAYS_AGO)
      .or('signature_path.not.is.null,selfie_path.not.is.null');

    if (fetchError) {
      console.error('[purge-signatures] fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ purged: 0, message: 'Nothing to purge.' });
    }

    const filesToDelete: string[] = [];
    const rowIds: string[] = [];

    for (const row of rows) {
      if (row.signature_path) filesToDelete.push(row.signature_path);
      if (row.selfie_path)    filesToDelete.push(row.selfie_path);
      rowIds.push(row.id);
    }

    // 2. Delete files from 'member_signatures' bucket (admin client bypasses RLS)
    if (filesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('member_signatures')
        .remove(filesToDelete);

      if (storageError) {
        // Log but don't abort — we still null the paths so we don't retry forever.
        console.error('[purge-signatures] storage delete error:', storageError);
      }
    }

    // 3. Null out the paths in the database — preserve the audit trail row.
    const { error: updateError } = await supabase
      .from('document_signatures')
      .update({ signature_path: null, selfie_path: null })
      .in('id', rowIds);

    if (updateError) {
      console.error('[purge-signatures] db update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log(`[purge-signatures] purged ${rowIds.length} rows, ${filesToDelete.length} files.`);
    return NextResponse.json({
      purged: rowIds.length,
      filesDeleted: filesToDelete.length,
    });
  } catch (err: any) {
    console.error('[purge-signatures] unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
