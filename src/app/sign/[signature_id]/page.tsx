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
      <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '60px auto', textAlign: 'center' }}>
        <div className="alert alert-error" style={{ fontSize: '1rem', padding: '20px' }}>
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
