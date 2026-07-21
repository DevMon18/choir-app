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

export const loginWithGoogle = async (isNative?: boolean) => {
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

  const redirectTo = isNative
    ? 'com.choircollective.app://auth/callback'
    : `${siteUrl}/auth/callback`;
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: isNative ? true : false,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (isNative) {
    return { url: data?.url };
  }

  if (data?.url) {
    redirect(data.url);
  }
  
  return { error: 'Could not generate Google OAuth redirect URL' };
};
