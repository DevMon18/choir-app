import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { createClient } from '@/lib/supabase/server';
import MyDocumentsClient from './MyDocumentsClient';

export const dynamic = 'force-dynamic';

export default async function MyDocumentsPage() {
  const profile = await getProfile();

  if (!profile || profile.role === 'pending' || profile.role === 'rejected') {
    redirect('/login');
  }

  if (profile.role === 'super_admin') {
    redirect('/admin/documents');
  }

  const supabase = await createClient();

  const [
    { data: signatures, error: sigErr },
    { data: folders, error: folderErr },
    { data: rawDocuments, error: docErr },
  ] = await Promise.all([
    supabase
      .from('document_signatures')
      .select('*, documents:document_id(id, title, type, file_path, folder_id, expires_at)')
      .eq('primary_member_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('document_folders')
      .select('*')
      .order('name', { ascending: true }),
    supabase
      .from('documents')
      .select('*')
      .order('title', { ascending: true }),
  ]);

  if (sigErr) console.error('[MyDocumentsPage] Signatures error:', sigErr);
  if (folderErr) console.error('[MyDocumentsPage] Folders error:', folderErr);
  if (docErr) console.error('[MyDocumentsPage] Documents error:', docErr);

  // Generate signed URLs for all documents so members can view and download files directly inside folders!
  const documentsWithSignedUrls = await Promise.all(
    (rawDocuments || []).map(async (doc) => {
      let signedUrl = '';
      if (doc.file_path) {
        let cleanDocPath = doc.file_path.replace(/^\/+/, '');
        if (cleanDocPath.startsWith('choir_documents/')) {
          cleanDocPath = cleanDocPath.replace(/^choir_documents\//, '');
        }
        const { data: signedData } = await supabase.storage
          .from('choir_documents')
          .createSignedUrl(cleanDocPath, 3600 * 2);
        signedUrl = signedData?.signedUrl || '';
      }
      return {
        ...doc,
        signedUrl,
      };
    })
  );

  // Generate signed URLs for stamped signed PDFs
  const signaturesWithSignedUrls = await Promise.all(
    (signatures || []).map(async (sig) => {
      let signedPdfSignedUrl: string | null = null;
      if (sig.signed_pdf_path) {
        let cleanSigPath = sig.signed_pdf_path.replace(/^\/+/, '');
        if (cleanSigPath.startsWith('member_signatures/')) {
          cleanSigPath = cleanSigPath.replace(/^member_signatures\//, '');
        }
        const { data: signedData } = await supabase.storage
          .from('member_signatures')
          .createSignedUrl(cleanSigPath, 3600 * 2);
        signedPdfSignedUrl = signedData?.signedUrl || null;
      }
      return {
        ...sig,
        signedPdfSignedUrl,
      };
    })
  );

  return (
    <MyDocumentsClient
      currentUserProfile={profile}
      initialSignatures={signaturesWithSignedUrls as any}
      initialFolders={(folders as any) || []}
      initialDocuments={documentsWithSignedUrls}
    />
  );
}
