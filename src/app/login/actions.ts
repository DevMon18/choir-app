'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export const loginWithEmail = async (formData: FormData) => {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/dashboard');
};

export const loginWithGoogle = async () => {
  const supabase = await createClient();
  const headersList = await headers();
  const host = headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'https';
  
  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl && host) {
    siteUrl = `${host.includes('localhost') ? 'http' : proto}://${host}`;
  }
  if (!siteUrl) {
    siteUrl = 'http://localhost:3000';
  }
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data?.url) {
    redirect(data.url);
  }
  
  return { error: 'Could not generate Google OAuth redirect URL' };
};
