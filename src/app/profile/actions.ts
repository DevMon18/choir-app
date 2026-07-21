'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const updatePersonalProfile = async (input: {
  fullName: string;
  birthdate?: string | null;
  phone?: string | null;
  emergencyContact?: string | null;
  address?: string | null;
  isPhonePrivate: boolean;
  isAddressPrivate: boolean;
  avatarUrl?: string | null;
}) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    // 1. Update public.profiles table
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        full_name: input.fullName,
        birthdate: input.birthdate || null,
        phone: input.phone || null,
        emergency_contact: input.emergencyContact || null,
        address: input.address || null,
        is_phone_private: input.isPhonePrivate,
        is_address_private: input.isAddressPrivate,
        avatar_url: input.avatarUrl || null,
      })
      .eq('id', user.id);

    if (profileErr) {
      return { error: `Profile update failed: ${profileErr.message}` };
    }

    // 2. Update auth user metadata (syncs full_name and avatar_url to JWT/auth)
    const { error: authErr } = await supabase.auth.updateUser({
      data: {
        full_name: input.fullName,
        avatar_url: input.avatarUrl || null,
      },
    });

    if (authErr) {
      console.warn('Auth user metadata update failed:', authErr.message);
    }

    revalidatePath('/profile');
    revalidatePath('/profile', 'layout');
    revalidatePath('/dashboard');
    revalidatePath('/directory');
    revalidatePath('/admin/users');
    revalidatePath('/admin/roster');
    revalidatePath('/admin/finances');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const changePassword = async (input: {
  newPassword: string;
}) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated. Please log in again.' };
    }

    if (input.newPassword.length < 8) {
      return { error: 'Password must be at least 8 characters long.' };
    }

    const { error } = await supabase.auth.updateUser({
      password: input.newPassword,
    });

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

