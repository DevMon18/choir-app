import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToAll } from '@/lib/push';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const currentYear = now.getFullYear();

    // Query non-private, non-pending member birthdays
    const { data: bdayProfiles, error: fetchErr } = await adminSupabase
      .from('profiles')
      .select('id, full_name, birthdate')
      .not('birthdate', 'is', null)
      .eq('is_birthdate_private', false)
      .not('role', 'in', '("pending","rejected")');

    if (fetchErr) {
      await adminSupabase.from('birthday_cron_logs').insert({
        job_type: 'monthly_summary',
        birthdays_found: 0,
        notifications_sent: 0,
        notifications_failed: 0,
        status: 'error',
        details: { error: fetchErr.message },
      });
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    // Filter profiles with birthdays in current month
    const monthMatches = (bdayProfiles || [])
      .map((p) => {
        if (!p.birthdate) return null;
        const parts = p.birthdate.split('-').map(Number);
        if (parts.length < 3) return null;
        return {
          id: p.id,
          name: p.full_name,
          month: parts[1],
          day: parts[2],
        };
      })
      .filter((p): p is { id: string; name: string; month: number; day: number } => p !== null && p.month === currentMonth)
      .sort((a, b) => a.day - b.day);

    if (monthMatches.length === 0) {
      await adminSupabase.from('birthday_cron_logs').insert({
        job_type: 'monthly_summary',
        birthdays_found: 0,
        notifications_sent: 0,
        notifications_failed: 0,
        status: 'success',
        details: { message: 'No birthdays in current month' },
      });
      return NextResponse.json({ success: true, message: 'No birthdays in current month' });
    }

    // Format month name (e.g. June)
    const monthName = now.toLocaleString('default', { month: 'long' });

    // Format list: "Name (Month Day), Name (Month Day)"
    const formattedList = monthMatches
      .map((m) => `${m.name} (${monthName} ${m.day})`)
      .join(', ');

    const announcementBody = `🎉 Birthdays this month: ${formattedList}`;
    const announcementTitle = `🎉 Birthdays in ${monthName}`;

    // End of current month date
    const lastDayOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    // 1. Insert into announcements table as pinned dashboard announcement
    const { data: annData, error: annErr } = await adminSupabase
      .from('announcements')
      .insert({
        title: announcementTitle,
        body: announcementBody,
        priority: 'normal',
        is_pinned: true,
        starts_at: now.toISOString(),
        ends_at: lastDayOfMonth.toISOString(),
      })
      .select()
      .single();

    if (annErr) {
      console.warn('Failed to insert monthly birthday announcement:', annErr.message);
    }

    // 2. Trigger push notification pipeline
    const report = await sendPushToAll({
      title: announcementTitle,
      body: announcementBody,
      url: '/dashboard',
    });

    const totalSuccess = report.webPush.success + report.fcm.success;
    const totalFailed = report.webPush.failed + report.fcm.failed;

    // 3. Log run explicitly
    await adminSupabase.from('birthday_cron_logs').insert({
      job_type: 'monthly_summary',
      birthdays_found: monthMatches.length,
      notifications_sent: totalSuccess,
      notifications_failed: totalFailed,
      status: 'success',
      details: {
        announcementId: annData?.id || null,
        matches: monthMatches,
        report,
      },
    });

    return NextResponse.json({
      success: true,
      birthdaysFound: monthMatches.length,
      announcementTitle,
      announcementBody,
      notificationsSent: totalSuccess,
      notificationsFailed: totalFailed,
      report,
    });
  } catch (err: any) {
    console.error('Error in monthly birthday cron route:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
