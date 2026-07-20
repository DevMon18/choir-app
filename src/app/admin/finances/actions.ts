'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const recordInvoicePayment = async (invoiceId: string) => {
  try {
    const supabase = await createClient();

    // 1. Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    // 2. Verify current user profile role has permissions
    const { data: currentProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !['super_admin', 'director', 'treasurer'].includes(currentProfile.role)) {
      return { error: 'Only a Treasurer, Director, or Super Admin can record dues payments.' };
    }

    // 3. Update invoice status to paid in member_dues
    const { error: updateErr } = await supabase
      .from('member_dues')
      .update({ status: 'paid' })
      .eq('id', invoiceId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath('/admin/finances');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const toggleSinkingFund = async (
  memberId: string,
  date: string,
  status: 'paid' | 'unpaid',
  amount: number,
  periodLabel: string
) => {
  try {
    const supabase = await createClient();

    // 1. Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    // 2. Verify authorization
    const { data: currentProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !['super_admin', 'director', 'treasurer'].includes(currentProfile.role)) {
      return { error: 'Only a Treasurer, Director, or Super Admin can manage Sinking Funds.' };
    }

    // 3. Check if record exists
    const { data: existing, error: existErr } = await supabase
      .from('member_dues')
      .select('id')
      .eq('member_id', memberId)
      .eq('due_date', date)
      .eq('period_label', periodLabel)
      .maybeSingle();

    if (existErr) {
      return { error: existErr.message };
    }

    if (existing) {
      // Update existing record
      const { error: updateErr } = await supabase
        .from('member_dues')
        .update({
          status,
          amount,
          paid_date: status === 'paid' ? date : null,
          notes: `Sunday Sinking Fund Collection`
        })
        .eq('id', existing.id);

      if (updateErr) return { error: updateErr.message };
    } else {
      // Insert new record
      const { error: insertErr } = await supabase
        .from('member_dues')
        .insert({
          member_id: memberId,
          user_id: memberId, // legacy support
          amount,
          due_date: date,
          status,
          paid_date: status === 'paid' ? date : null,
          period_label: periodLabel,
          notes: `Sunday Sinking Fund Collection`
        });

      if (insertErr) return { error: insertErr.message };
    }

    revalidatePath('/admin/finances');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};
