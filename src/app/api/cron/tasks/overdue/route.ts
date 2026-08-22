import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendPushToUser } from '@/lib/push';
import { getStartOfDayManila } from '@/lib/dateUtils';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const nowIso = new Date().toISOString();
    // In Asia/Manila business timezone, tasks are overdue ONLY if their due date is strictly before today's start
    const startOfTodayManilaIso = getStartOfDayManila(new Date()).toISOString();

    // Query assignments that are past due and not yet completed, cancelled, or overdue
    const { data: expiredAssignments, error: fetchErr } = await adminSupabase
      .from('task_assignments')
      .select('id, task_id, member_id, responsibility, due_date, status, task:task_id(title)')
      .in('status', ['pending', 'in_progress'])
      .not('due_date', 'is', null)
      .is('archived_at', null)
      .lt('due_date', startOfTodayManilaIso);

    if (fetchErr) {
      console.error('Error fetching overdue assignments:', fetchErr);
      await adminSupabase.from('task_cron_logs').insert({
        job_type: 'overdue_checker',
        tasks_checked: 0,
        assignments_flagged: 0,
        status: 'error',
        details: { error: fetchErr.message },
      });
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const assignments = expiredAssignments || [];
    let flaggedCount = 0;

    for (const a of assignments) {
      // 1. Transition status to 'overdue'
      const { error: updateErr } = await adminSupabase
        .from('task_assignments')
        .update({
          status: 'overdue',
          updated_at: nowIso,
        })
        .eq('id', a.id);

      if (!updateErr) {
        flaggedCount++;

        // 2. Log in task history
        await adminSupabase.from('task_assignment_history').insert({
          task_assignment_id: a.id,
          action: 'Marked Overdue by System Cron',
          old_status: a.status,
          new_status: 'overdue',
          note: `Due date passed (${new Date(a.due_date!).toLocaleDateString()})`,
        });

        // 3. Notify member
        if (a.member_id) {
          await sendPushToUser(a.member_id, {
            title: '⏰ Task Overdue',
            body: `"${a.responsibility}" in "${(a.task as any)?.title || 'Task'}" is now past due.`,
            url: '/tasks',
          });
        }
      }
    }

    // Log to task_cron_logs
    await adminSupabase.from('task_cron_logs').insert({
      job_type: 'overdue_checker',
      tasks_checked: assignments.length,
      assignments_flagged: flaggedCount,
      status: 'success',
      details: {
        timestamp: nowIso,
        flaggedIds: assignments.map((a) => a.id),
      },
    });

    return NextResponse.json({
      success: true,
      tasksChecked: assignments.length,
      assignmentsFlagged: flaggedCount,
      timestamp: nowIso,
    });
  } catch (err: any) {
    console.error('Error in task overdue cron route:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
