'use server';

import { createClient } from '@/lib/supabase/server';

export const signupWithEmail = async (formData: FormData) => {
  const fullName = formData.get('fullName') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!fullName || !email || !password) {
    return { error: 'All fields are required' };
  }

  const supabase = await createClient();

  // Check if email has been rejected in join_requests
  const { data: joinRequest } = await supabase
    .from('join_requests')
    .select('status')
    .eq('email', email)
    .maybeSingle();

  if (joinRequest && joinRequest.status === 'rejected') {
    return { error: 'Your registration request has been rejected. Resubmission must occur via the official interest form (/join) only.' };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: 'Registration successful! Please check your email to confirm your account.' };
};
