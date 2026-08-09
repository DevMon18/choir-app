import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type UserRole =
  | 'super_admin'
  | 'director'
  | 'secretary'
  | 'treasurer'
  | 'member'
  | 'pending'
  | 'rejected';

export type Permission =
  | 'users.read'
  | 'users.write'
  | 'profile.read'
  | 'profile.write'
  | 'songs.read'
  | 'songs.write'
  | 'sequences.read'
  | 'sequences.write'
  | 'finance.read'
  | 'finance.write'
  | 'announcements.read'
  | 'announcements.write'
  | 'attendance.read'
  | 'attendance.write'
  | 'messages.read'
  | 'messages.write'
  | 'analytics.read'
  | 'audit.read';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name?: string;
}

// Centralized mapping of roles to permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'users.read', 'users.write',
    'profile.read', 'profile.write',
    'songs.read', 'songs.write',
    'sequences.read', 'sequences.write',
    'finance.read', 'finance.write',
    'announcements.read', 'announcements.write',
    'attendance.read', 'attendance.write',
    'messages.read', 'messages.write',
    'analytics.read', 'audit.read',
  ],
  director: [
    'users.read', 'users.write',
    'profile.read', 'profile.write',
    'songs.read', 'songs.write',
    'sequences.read', 'sequences.write',
    'finance.read', 'finance.write',
    'announcements.read', 'announcements.write',
    'attendance.read', 'attendance.write',
    'messages.read', 'messages.write',
    'analytics.read', 'audit.read',
  ],
  secretary: [
    'users.read', 'users.write',
    'profile.read', 'profile.write',
    'songs.read', 'songs.write',
    'sequences.read', 'sequences.write',
    'announcements.read', 'announcements.write',
    'attendance.read', 'attendance.write',
    'messages.read', 'messages.write',
    'analytics.read',
  ],
  treasurer: [
    'users.read',
    'profile.read', 'profile.write',
    'songs.read',
    'finance.read', 'finance.write',
    'announcements.read',
    'attendance.read',
    'messages.read', 'messages.write',
    'analytics.read',
  ],
  member: [
    'users.read',
    'profile.read', 'profile.write',
    'songs.read',
    'sequences.read',
    'finance.read',
    'announcements.read',
    'attendance.read',
    'messages.read', 'messages.write',
  ],
  pending: [],
  rejected: [],
};

/**
 * Get current authenticated user and profile role from server session
 */
export const requireUser = async (): Promise<AuthUser> => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  // Inspect JWT app_metadata for fast role resolution; fallback to profiles table query
  let role: UserRole = (user.app_metadata?.role as UserRole) ?? 'pending';

  if (!role || role === 'pending') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profile?.role) {
      role = profile.role as UserRole;
    }
  }

  return {
    id: user.id,
    email: user.email || '',
    role,
    full_name: user.user_metadata?.full_name,
  };
};

/**
 * Check if a given user profile has a specific permission
 */
export const hasPermission = (user: AuthUser, permission: Permission): boolean => {
  if (!user || !user.role) return false;
  const permissions = ROLE_PERMISSIONS[user.role] || [];
  return permissions.includes(permission);
};

/**
 * Assert that the user possesses a permission, throwing an Error if unauthorized
 */
export const requirePermission = (user: AuthUser, permission: Permission): void => {
  if (!hasPermission(user, permission)) {
    throw new Error(`Forbidden: Role '${user.role}' lacks permission '${permission}'`);
  }
};

/**
 * Assert that the user possesses any of the specified roles
 */
export const requireRole = (user: AuthUser, allowedRoles: UserRole[]): void => {
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error(`Forbidden: Requires one of [${allowedRoles.join(', ')}] but user role is '${user?.role}'`);
  }
};
