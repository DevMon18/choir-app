'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { requireUser, requirePermission } from '@/lib/auth/permissions';
import { recordAuditLog } from '@/lib/audit';

export const createUserDirectly = async (input: {
  email: string;
  fullName: string;
  role: 'director' | 'treasurer' | 'secretary' | 'member';
}) => {
  try {
    const user = await requireUser();
    requirePermission(user, 'users.write');

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

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'USER_CREATED_DIRECTLY',
      entityType: 'user',
      entityId: newUserId,
      metadata: { targetEmail: input.email, role: input.role },
    });

    revalidatePath('/admin/users');
    return { success: true, tempPassword };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const updateProfileRole = async (profileId: string, role: string) => {
  try {
    const user = await requireUser();
    requirePermission(user, 'users.write');

    const supabaseAdmin = createAdminClient();

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', profileId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    // Sync updated role into auth.users app_metadata (JWT claim)
    await supabaseAdmin.auth.admin.updateUserById(profileId, {
      app_metadata: { role },
    });

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'PROFILE_ROLE_UPDATED',
      entityType: 'user',
      entityId: profileId,
      metadata: { newRole: role },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/roster');
    revalidatePath('/directory');
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
    const user = await requireUser();
    requirePermission(user, 'users.write');

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
        voice_part: request.voice_part,
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

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'JOIN_REQUEST_APPROVED',
      entityType: 'join_request',
      entityId: requestId,
      metadata: { targetEmail: request.email, assignedUserId: authResult.user.id },
    });

    revalidatePath('/admin/users');
    return { success: true, tempPassword, email: request.email, fullName: request.full_name };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const rejectJoinRequest = async (requestId: string, rejectionReason: string) => {
  try {
    const user = await requireUser();
    requirePermission(user, 'users.write');

    if (!rejectionReason.trim()) {
      return { error: 'Rejection reason is required.' };
    }

    const supabase = await createClient();

    // 1. Fetch request details
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

    const supabaseAdmin = createAdminClient();

    // Check if profile exists already and set to rejected
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
    }

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'JOIN_REQUEST_REJECTED',
      entityType: 'join_request',
      entityId: requestId,
      metadata: { targetEmail: request.email, rejectionReason },
    });

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
    const user = await requireUser();
    requirePermission(user, 'users.write');

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

    // 2. Update auth.users email, user_metadata, and app_metadata (role claim)
    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(profileId, {
      email: input.email,
      user_metadata: { full_name: input.fullName },
      app_metadata: { role: input.role },
    });

    if (authErr) {
      return { error: `Authentication update failed: ${authErr.message}` };
    }

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'user',
      entityId: profileId,
      metadata: { newFullName: input.fullName, newRole: input.role },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/roster');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const deleteUserDirectly = async (profileId: string) => {
  try {
    const user = await requireUser();
    requirePermission(user, 'users.write');

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

    await recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      action: 'USER_DELETED',
      entityType: 'user',
      entityId: profileId,
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/roster');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};
