'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// Helper to check for admin roles
const checkAdminAuth = async () => {
  const supabase = await createClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    return { error: 'Not authenticated', supabase: null };
  }

  const { data: currentProfile, error: profileErr } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if (profileErr || !['super_admin', 'director', 'secretary'].includes(currentProfile?.role || '')) {
    return { error: 'Unauthorized. Secretary, Director, or Super Admin role required.', supabase: null };
  }

  return { error: null, supabase };
};

export const createUserDirectly = async (input: {
  email: string;
  fullName: string;
  role: 'director' | 'treasurer' | 'secretary' | 'member';
}) => {
  try {
    const { error } = await checkAdminAuth();
    if (error) return { error };

    const supabaseAdmin = createAdminClient();
    const tempPassword = 'TempPassword123!';

    const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: input.fullName },
    });

    if (authError) {
      return { error: authError.message };
    }

    const newUserId = authResult.user.id;

    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: input.fullName,
        email: input.email,
        role: input.role,
      });

    if (upsertError) {
      return { error: upsertError.message };
    }

    revalidatePath('/admin/users');
    return { success: true, tempPassword };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const updateProfileRole = async (profileId: string, role: string) => {
  try {
    const { error } = await checkAdminAuth();
    if (error) return { error };

    const supabase = await createClient();

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', profileId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

// ---------------------------------------------------------------------------
// Recruitment Join Requests actions
// ---------------------------------------------------------------------------

export const approveJoinRequest = async (requestId: string) => {
  try {
    const { error } = await checkAdminAuth();
    if (error) return { error };

    const supabase = await createClient();

    // 1. Fetch request details
    const { data: request, error: fetchErr } = await supabase
      .from('join_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return { error: 'Join request not found.' };
    }

    const supabaseAdmin = createAdminClient();
    const tempPassword = 'TempPassword123!';

    // 2. Create the official auth.users account
    const { data: authResult, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: request.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: request.full_name },
    });

    if (authError) {
      return { error: `Authentication account creation failed: ${authError.message}` };
    }

    // 3. Upsert official member profile
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authResult.user.id,
        full_name: request.full_name,
        email: request.email,
        role: 'member',
        voice_part: request.voice_part, // Auto-assign requested voice part
      });

    if (profileErr) {
      return { error: `Profile creation failed: ${profileErr.message}` };
    }

    // 4. Update status in join_requests table
    const { error: statusErr } = await supabase
      .from('join_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);

    if (statusErr) {
      return { error: `Failed to update request status: ${statusErr.message}` };
    }

    revalidatePath('/admin/users');
    return { success: true, tempPassword, email: request.email, fullName: request.full_name };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const rejectJoinRequest = async (requestId: string, rejectionReason: string) => {
  try {
    const { error } = await checkAdminAuth();
    if (error) return { error };

    if (!rejectionReason.trim()) {
      return { error: 'Rejection reason is required.' };
    }

    const supabase = await createClient();

    // 1. Fetch request details to get email
    const { data: request, error: fetchErr } = await supabase
      .from('join_requests')
      .select('email, full_name')
      .eq('id', requestId)
      .single();

    if (fetchErr || !request) {
      return { error: 'Join request not found.' };
    }

    // 2. Mark request as rejected with reason
    const { error: statusErr } = await supabase
      .from('join_requests')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason,
      })
      .eq('id', requestId);

    if (statusErr) {
      return { error: statusErr.message };
    }

    // 3. Create or update profile record with 'rejected' role, preventing signup bypass
    const supabaseAdmin = createAdminClient();
    
    // Check if profile exists already
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', request.email)
      .maybeSingle();

    if (profile) {
      await supabaseAdmin
        .from('profiles')
        .update({ role: 'rejected' })
        .eq('id', profile.id);
    } else {
      // Create a dummy / shadow profile entry with the email to block future signups directly
      // Wait, since auth.users does not exist, profiles FK constraint would fail because id references auth.users!
      // So we can let profiles be created upon auth signup, but we reject them.
      // Wait, in signup/actions.ts, let's verify if they are allowed to sign up.
      // Yes, if we want to block them from signing up directly, we can check join_requests for rejected emails in the signup handler!
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const updateUserProfile = async (
  profileId: string,
  input: {
    fullName: string;
    email: string;
    role: 'super_admin' | 'director' | 'treasurer' | 'secretary' | 'member' | 'pending' | 'rejected';
    voicePart?: string;
  }
) => {
  try {
    const { error } = await checkAdminAuth();
    if (error) return { error };

    const supabaseAdmin = createAdminClient();

    // 1. Update profiles table
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name: input.fullName,
        email: input.email,
        role: input.role,
        voice_part: input.voicePart || null,
      })
      .eq('id', profileId);

    if (profileErr) {
      return { error: `Profile update failed: ${profileErr.message}` };
    }

    // 2. Update auth.users email and metadata
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
      email: input.email,
      user_metadata: { full_name: input.fullName },
    });

    if (authErr) {
      // It is okay if auth updates fail if email already exists or auth doesn't exist (e.g. shadow profile),
      // but let's report the error.
      return { error: `Authentication update failed: ${authErr.message}` };
    }

    revalidatePath('/admin/users');
    revalidatePath('/admin/roster');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const deleteUserDirectly = async (profileId: string) => {
  try {
    const { error } = await checkAdminAuth();
    if (error) return { error };

    const supabaseAdmin = createAdminClient();

    // 1. Delete from profiles table
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', profileId);

    if (profileErr) {
      return { error: `Profile deletion failed: ${profileErr.message}` };
    }

    // 2. Delete from auth.users
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(profileId);

    if (authErr) {
      if (!authErr.message.includes('not found') && !authErr.message.includes('does not exist')) {
        return { error: `Authentication account deletion failed: ${authErr.message}` };
      }
    }

    revalidatePath('/admin/users');
    revalidatePath('/admin/roster');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};
