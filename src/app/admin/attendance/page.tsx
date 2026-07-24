import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import AttendanceClient from './AttendanceClient';

export const dynamic = 'force-dynamic';

const AdminAttendancePage = async () => {
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const isAuthorized = ['super_admin', 'director', 'secretary'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch roster, sessions, and records concurrently via Promise.all
  const [
    { data: roster, error: rosterErr },
    { data: sessions, error: sessionsErr },
    { data: records, error: recordsErr },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .neq('role', 'pending')
      .neq('role', 'rejected')
      .order('full_name'),
    supabase
      .from('attendance_sessions')
      .select('*')
      .order('date', { ascending: false }),
    supabase
      .from('attendance_records')
      .select('*'),
  ]);

  if (rosterErr) console.error('Error fetching roster:', rosterErr);
  if (sessionsErr) console.error('Error fetching sessions:', sessionsErr);
  if (recordsErr) console.error('Error fetching records:', recordsErr);

  return (
    <AttendanceClient
      currentUserProfile={currentProfile}
      roster={roster || []}
      initialSessions={sessions || []}
      initialRecords={records || []}
    />
  );
};

export default AdminAttendancePage;
