'use server';

import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

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

  // Notify super_admin and directors about new pending registration
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['super_admin', 'director']);

    if (admins && admins.length > 0) {
      const { sendPushToUser } = await import('@/lib/push');
      for (const admin of admins) {
        sendPushToUser(admin.id, {
          title: '👤 New Member Sign-Up Waiting for Approval',
          body: `${fullName} has signed up and is waiting for account approval.`,
          url: '/admin/users',
        }).catch(() => {});
      }
    }
  } catch (pushErr) {
    console.error('Error sending push notification on signup:', pushErr);
  }

  return { success: 'Registration successful! Please check your email to confirm your account.' };
};
