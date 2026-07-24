import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/supabase/user';
import AnalyticsClient from './AnalyticsClient';

export const dynamic = 'force-dynamic';

const AdminAnalyticsPage = async () => {
  const currentProfile = await getProfile();

  if (!currentProfile) {
    redirect('/login');
  }

  const isAuthorized = ['super_admin', 'director', 'secretary', 'treasurer'].includes(currentProfile.role);
  if (!isAuthorized) {
    redirect('/dashboard');
  }

  const supabase = await createClient();

  // Fetch all analytics datasets concurrently via Promise.all
  const [
    { data: profiles, error: profilesErr },
    { data: dues, error: duesErr },
    { data: sessions, error: sessionsErr },
    { data: records, error: recordsErr },
    { data: songs, error: songsErr },
    { data: sequenceItems, error: itemsErr },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, created_at')
      .neq('role', 'pending')
      .neq('role', 'rejected'),
    supabase
      .from('member_dues')
      .select('amount, status'),
    supabase
      .from('attendance_sessions')
      .select('id, type'),
    supabase
      .from('attendance_records')
      .select('status, session_id'),
    supabase
      .from('songs')
      .select('id, title, category'),
    supabase
      .from('sequence_items')
      .select('song_id'),
  ]);

  if (profilesErr) console.error('Error fetching profiles for analytics:', profilesErr);
  if (duesErr) console.error('Error fetching member dues for analytics:', duesErr);
  if (sessionsErr || recordsErr) console.error('Error fetching attendance data for analytics:', { sessionsErr, recordsErr });
  if (songsErr || itemsErr) console.error('Error fetching songs/sequences for analytics:', { songsErr, itemsErr });

  // Calculate Metrics
  const activeMembers = profiles || [];
  const totalMembers = activeMembers.length;
  const roleBreakdown = activeMembers.reduce((acc, curr) => {
    acc[curr.role] = (acc[curr.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const duesList = dues || [];
  let paidSum = 0;
  let unpaidSum = 0;
  let overdueSum = 0;

  duesList.forEach((d) => {
    const val = Number(d.amount);
    if (d.status === 'paid') paidSum += val;
    else if (d.status === 'overdue') overdueSum += val;
    else unpaidSum += val;
  });

  const totalDues = paidSum + unpaidSum + overdueSum;
  const duesCompletionRate = totalDues > 0 ? Math.round((paidSum / totalDues) * 100) : 0;

  const sessionList = sessions || [];
  const recordList = records || [];

  // Overall attendance calculation
  const totalRecords = recordList.length;
  const presentCount = recordList.filter((r) => r.status === 'present' || r.status === 'late').length;
  const overallAttendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 100) : 0;

  // Breakdown by session type
  const attendanceByType = sessionList.reduce((acc, sess) => {
    const sessRecords = recordList.filter((r) => r.session_id === sess.id);
    const total = sessRecords.length;
    const present = sessRecords.filter((r) => r.status === 'present' || r.status === 'late').length;

    if (!acc[sess.type]) {
      acc[sess.type] = { total: 0, present: 0 };
    }
    acc[sess.type].total += total;
    acc[sess.type].present += present;
    return acc;
  }, {} as Record<string, { total: number; present: number }>);

  const attendanceRateByType = Object.entries(attendanceByType).reduce((acc, [type, val]) => {
    acc[type] = val.total > 0 ? Math.round((val.present / val.total) * 100) : 0;
    return acc;
  }, {} as Record<string, number>);

  // Popular songs calculation
  const songList = songs || [];
  const seqItems = sequenceItems || [];
  const songCounts = seqItems.reduce((acc, curr) => {
    if (curr.song_id) {
      acc[curr.song_id] = (acc[curr.song_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const popularSongs = Object.entries(songCounts)
    .map(([songId, count]) => {
      const songInfo = songList.find((s) => s.id === songId);
      return {
        title: songInfo?.title || 'Unknown Song',
        category: songInfo?.category || 'General',
        count,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Membership growth over last 6 months
  const monthlySignups = activeMembers.reduce((acc, curr) => {
    const date = new Date(curr.created_at);
    const label = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sort monthly signups by date
  const sortedGrowth = Object.entries(monthlySignups)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-6)
    .map(([month, count]) => ({ month, count }));

  return (
    <AnalyticsClient
      currentUserProfile={currentProfile}
      metrics={{
        totalMembers,
        roleBreakdown,
        dues: {
          paidSum,
          unpaidSum,
          overdueSum,
          totalDues,
          completionRate: duesCompletionRate,
        },
        attendance: {
          overallRate: overallAttendanceRate,
          rateByType: attendanceRateByType,
        },
        popularSongs,
        growth: sortedGrowth,
      }}
    />
  );
};

export default AdminAnalyticsPage;
