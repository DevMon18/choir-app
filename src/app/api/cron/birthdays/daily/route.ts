import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToAll, PushReport } from '@/lib/push';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Query all non-private, non-pending profiles with birthdates
    const { data: bdayProfiles, error: fetchErr } = await adminSupabase
      .from('profiles')
      .select('id, full_name, birthdate')
      .not('birthdate', 'is', null)
      .eq('is_birthdate_private', false)
      .not('role', 'in', '("pending","rejected")');

    if (fetchErr) {
      await adminSupabase.from('birthday_cron_logs').insert({
        job_type: 'daily_birthday',
        birthdays_found: 0,
        notifications_sent: 0,
        notifications_failed: 0,
        status: 'error',
        details: { error: fetchErr.message },
      });
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const now = new Date();
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    const matches = (bdayProfiles || []).filter((p) => {
      if (!p.birthdate) return false;
      const parts = p.birthdate.split('-').map(Number);
      if (parts.length < 3) return false;
      return parts[1] === todayMonth && parts[2] === todayDay;
    });

    let totalSuccess = 0;
    let totalFailed = 0;
    const reports: { profileId: string; name: string; report: PushReport }[] = [];

    for (const match of matches) {
      const report = await sendPushToAll(
        {
          title: '🎂 Birthday Today!',
          body: `🎂 It's ${match.full_name}'s birthday today!`,
          url: '/directory',
        },
        { excludeUserIds: [match.id] }
      );

      totalSuccess += report.webPush.success + report.fcm.success;
      totalFailed += report.webPush.failed + report.fcm.failed;
      reports.push({
        profileId: match.id,
        name: match.full_name,
        report,
      });
    }

    // Log run explicitly to database
    await adminSupabase.from('birthday_cron_logs').insert({
      job_type: 'daily_birthday',
      birthdays_found: matches.length,
      notifications_sent: totalSuccess,
      notifications_failed: totalFailed,
      status: 'success',
      details: {
        matches: matches.map((m) => ({ id: m.id, name: m.full_name })),
        reports,
      },
    });

    return NextResponse.json({
      success: true,
      birthdaysFound: matches.length,
      notificationsSent: totalSuccess,
      notificationsFailed: totalFailed,
      reports,
    });
  } catch (err: any) {
    console.error('Error in daily birthday cron route:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
