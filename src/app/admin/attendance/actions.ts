'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export const createAttendanceSession = async (input: {
  name: string;
  date: string;
  type: 'rehearsal' | 'performance' | 'mass' | 'special_event';
}) => {
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

    if (profileErr || !['super_admin', 'director', 'secretary'].includes(currentProfile.role)) {
      return { error: 'Only a Secretary, Director, or Super Admin can create attendance sessions.' };
    }

    // 3. Insert new attendance session
    const { data: session, error: insertErr } = await supabase
      .from('attendance_sessions')
      .insert({
        name: input.name,
        date: input.date,
        type: input.type,
      })
      .select()
      .single();

    if (insertErr) {
      return { error: insertErr.message };
    }

    revalidatePath('/admin/attendance');
    return { success: true, session };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const recordAttendance = async (input: {
  sessionId: string;
  records: Array<{
    profileId: string;
    status: 'present' | 'absent' | 'excused' | 'late';
  }>;
}) => {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'Not authenticated' };
    }

    const { data: currentProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !['super_admin', 'director', 'secretary'].includes(currentProfile.role)) {
      return { error: 'Only a Secretary, Director, or Super Admin can record attendance.' };
    }

    const upsertRows = input.records.map((rec) => ({
      session_id: input.sessionId,
      profile_id: rec.profileId,
      status: rec.status,
    }));

    const { error: upsertErr } = await supabase
      .from('attendance_records')
      .upsert(upsertRows, { onConflict: 'session_id,profile_id' });

    if (upsertErr) {
      return { error: upsertErr.message };
    }

    revalidatePath('/admin/attendance');
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

export const getOrCreateSessionForDate = async (
  date: string,
  type: 'rehearsal' | 'performance' | 'mass' | 'special_event' = 'mass'
) => {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const { data: currentProfile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileErr || !['super_admin', 'director', 'secretary'].includes(currentProfile.role)) {
      return { error: 'Only a Secretary, Director, or Super Admin can manage attendance.' };
    }

    // Try to find existing session for this date + type
    const { data: existing } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('date', date)
      .eq('type', type)
      .maybeSingle();

    if (existing) {
      return { success: true, session: existing, created: false };
    }

    // Auto-generate name from date
    const d = new Date(date + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const dateFmt = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
    const name = `${dayName} ${typeLabel} — ${dateFmt}`;

    const { data: session, error: insertErr } = await supabase
      .from('attendance_sessions')
      .insert({ name, date, type })
      .select()
      .single();

    if (insertErr) return { error: insertErr.message };

    revalidatePath('/admin/attendance');
    return { success: true, session, created: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred' };
  }
};

