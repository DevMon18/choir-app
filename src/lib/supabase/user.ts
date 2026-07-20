import { cache } from 'react';
import { headers } from 'next/headers';
import { createClient } from './server';

export interface Profile {
  id: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  full_name: string;
  created_at: string;
}

/**
 * Request-scoped memoized user lookup to prevent duplicate Supabase Auth network calls.
 * Safe to call multiple times in the same request rendering lifecycle.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
});

/**
 * Fast-path profile details lookup.
 * Attempts to retrieve profile/role context from custom headers set by middleware,
 * and falls back to building the profile from the cached Supabase Auth JWT claims/metadata.
 * Zero database profiles table queries required.
 */
export const getProfile = async (): Promise<Profile | null> => {
  try {
    const headersList = await headers();
    const id = headersList.get('x-user-id');
    const email = headersList.get('x-user-email');
    const role = headersList.get('x-user-role');
    const fullName = headersList.get('x-user-name');

    if (id && email && role) {
      return {
        id,
        email,
        role: role as any,
        full_name: fullName || '',
        created_at: '',
      };
    }
  } catch (e) {
    // next/headers might throw when called outside request context (e.g. in some static pre-renders)
  }

  // Fallback: Get verified user from Supabase Auth and construct profile from claims/metadata
  const user = await getCachedUser();
  if (!user) return null;

  return {
    id: user.id,
    email: user.email || '',
    role: (user.app_metadata?.role as any) || 'pending',
    full_name: (user.user_metadata?.full_name as string) || '',
    created_at: user.created_at,
  };
};
