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

  const { data: signatures, error } = await supabase
    .from('document_signatures')
    .select('*, documents:document_id(id, title, type, file_path, expires_at)')
    .eq('primary_member_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[MyDocumentsPage] Error fetching signatures:', error);
  }

  return (
    <MyDocumentsClient
      currentUserProfile={profile}
      initialSignatures={(signatures as any) || []}
    />
  );
}
