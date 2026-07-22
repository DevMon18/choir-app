'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

export const requestPasswordReset = async (formData: FormData) => {
  const email = formData.get('email') as string;

  if (!email) {
    return { error: 'Email address is required.' };
  }

  const supabase = await createClient();
  const headersList = await headers();
  const host = headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'https';
  
  let siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (host && !host.includes('localhost')) {
    siteUrl = `${proto}://${host}`;
  } else if (!siteUrl || siteUrl.includes('localhost')) {
    if (host) {
      siteUrl = `${host.includes('localhost') ? 'http' : proto}://${host}`;
    } else {
      siteUrl = 'http://localhost:3000';
    }
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  // Always return success — don't reveal whether the email exists
  return { success: true };
};

export const updatePassword = async (formData: FormData) => {
  const password = formData.get('password') as string;
  const confirm = formData.get('confirmPassword') as string;

  if (!password || !confirm) {
    return { error: 'Both password fields are required.' };
  }

  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  if (password !== confirm) {
    return { error: 'Passwords do not match.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
};
