import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getDocuments, getActiveMembers, getUpcomingSequences } from './actions';
import { DocumentsManagerClient } from './DocumentsManagerClient';

export const dynamic = 'force-dynamic';

export default async function AdminDocumentsPage() {
  const profile = await getProfile();

  if (!profile || profile.role === 'pending' || profile.role === 'rejected') {
    redirect('/login');
  }

  if (!['super_admin', 'director'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const [documents, members, sequences] = await Promise.all([
    getDocuments(),
    getActiveMembers(),
    getUpcomingSequences(),
  ]);

  return (
    <DocumentsManagerClient
      currentUserProfile={profile}
      initialDocuments={documents}
      initialMembers={members}
      initialSequences={sequences}
    />
  );
}
