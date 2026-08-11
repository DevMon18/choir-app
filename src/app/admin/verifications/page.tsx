import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getPendingVerifications } from './actions';
import VerificationsClient from './VerificationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminVerificationsPage() {
  const profile = await getProfile();

  if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
    redirect('/dashboard');
  }

  const verifications = await getPendingVerifications('all');

  return (
    <VerificationsClient
      currentUserProfile={profile}
      initialVerifications={verifications}
    />
  );
}
