import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import { getSignatureData } from './actions';
import { SignClient } from './SignClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ signature_id: string }>;
}

export default async function SignPage({ params }: PageProps) {
  const profile = await getProfile();

  if (!profile || profile.role === 'pending' || profile.role === 'rejected') {
    redirect('/login');
  }

  const { signature_id } = await params;
  const data = await getSignatureData(signature_id);

  if ('error' in data) {
    return (
      <div className="p-5 sm:p-10 max-w-[600px] my-15 mx-auto text-center">
        <div className="alert alert-error text-base p-5">
          {data.error}
        </div>
      </div>
    );
  }

  return (
    <SignClient
      data={data}
      currentUserProfile={profile}
    />
  );
}
