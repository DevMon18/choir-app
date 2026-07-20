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

  // 3. Fetch active roster from database
  const { data: roster, error: rosterErr } = await supabase
    .from('profiles')
    .select('*')
    .neq('role', 'pending')
    .neq('role', 'rejected')
    .order('full_name');

  if (rosterErr) {
    console.error('Error fetching roster:', rosterErr);
  }

  // 4. Fetch attendance sessions from database
  const { data: sessions, error: sessionsErr } = await supabase
    .from('attendance_sessions')
    .select('*')
    .order('date', { ascending: false });

  if (sessionsErr) {
    console.error('Error fetching sessions:', sessionsErr);
  }

  // 5. Fetch all attendance records
  const { data: records, error: recordsErr } = await supabase
    .from('attendance_records')
    .select('*');

  if (recordsErr) {
    console.error('Error fetching records:', recordsErr);
  }

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
