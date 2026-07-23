import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToAll } from '@/lib/push';

export async function checkAndTriggerTodayBirthdayPush(): Promise<void> {
  try {
    const adminSupabase = createAdminClient();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Check if daily birthday push was already processed today
    const { data: existingLogs } = await adminSupabase
      .from('birthday_cron_logs')
      .select('id')
      .eq('job_type', 'daily_birthday')
      .eq('status', 'success')
      .gte('created_at', `${todayStr}T00:00:00.000Z`)
      .limit(1);

    if (existingLogs && existingLogs.length > 0) {
      return; // Already executed today
    }

    // Query non-private, active member profiles with birthdates
    const { data: bdayProfiles, error: fetchErr } = await adminSupabase
      .from('profiles')
      .select('id, full_name, birthdate')
      .not('birthdate', 'is', null)
      .eq('is_birthdate_private', false)
      .not('role', 'in', '("pending","rejected")');

    if (fetchErr || !bdayProfiles) return;

    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    const matches = bdayProfiles.filter((p) => {
      if (!p.birthdate) return false;
      const parts = p.birthdate.split('-').map(Number);
      if (parts.length < 3) return false;
      return parts[1] === todayMonth && parts[2] === todayDay;
    });

    if (matches.length === 0) return;

    let totalSuccess = 0;
    let totalFailed = 0;

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
    }

    // Record execution log to prevent duplicate notifications
    await adminSupabase.from('birthday_cron_logs').insert({
      job_type: 'daily_birthday',
      birthdays_found: matches.length,
      notifications_sent: totalSuccess,
      notifications_failed: totalFailed,
      status: 'success',
      details: {
        matches: matches.map((m) => ({ id: m.id, name: m.full_name })),
        triggeredBy: 'auto_dashboard_check',
      },
    });
  } catch (err) {
    console.error('Error in checkAndTriggerTodayBirthdayPush:', err);
  }
}
