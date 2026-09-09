import { cache } from 'react';
import { headers } from 'next/headers';
import { createClient } from './server';

export interface Profile {
  id: string;
  email: string;
  role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
  full_name: string;
  avatar_url?: string | null;
  created_at: string;
}

/**
 * Request-scoped memoized user lookup to prevent duplicate Supabase Auth network calls.
 * Safe to call multiple times in the same request rendering lifecycle.
 */
export const getCachedUser = cache(async () => {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch (err) {
    return null;
  }
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
    const avatarUrl = headersList.get('x-user-avatar');

    if (id && email && role) {
      return {
        id,
        email,
        role: role as any,
        full_name: fullName || '',
        avatar_url: avatarUrl || null,
        created_at: '',
      };
    }
  } catch (e) {
    // next/headers might throw when called outside request context (e.g. in some static pre-renders)
  }

  // Fallback: Get verified user from Supabase Auth
  const user = await getCachedUser();
  if (!user) return null;

  // If app_metadata has a valid assigned role, use it
  if (user.app_metadata?.role && user.app_metadata.role !== 'pending') {
    return {
      id: user.id,
      email: user.email || '',
      role: user.app_metadata.role as any,
      full_name: (user.user_metadata?.full_name as string) || '',
      avatar_url: (user.user_metadata?.avatar_url as string) || null,
      created_at: user.created_at,
    };
  }

  // Query database profiles table for actual user role
  try {
    const supabase = await createClient();
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, email, role, full_name, avatar_url, created_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRow) {
      return {
        id: profileRow.id,
        email: profileRow.email || user.email || '',
        role: (profileRow.role as any) || 'pending',
        full_name: profileRow.full_name || (user.user_metadata?.full_name as string) || '',
        avatar_url: profileRow.avatar_url || (user.user_metadata?.avatar_url as string) || null,
        created_at: profileRow.created_at || user.created_at,
      };
    }
  } catch (err) {
    console.error('Error fetching profile fallback from database:', err);
  }

  return {
    id: user.id,
    email: user.email || '',
    role: (user.app_metadata?.role as any) || 'pending',
    full_name: (user.user_metadata?.full_name as string) || '',
    avatar_url: (user.user_metadata?.avatar_url as string) || null,
    created_at: user.created_at,
  };
};
