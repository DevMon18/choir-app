import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Find archived assignments eligible for permanent 30-day cleanup
    const { data: eligibleAssignments, error: fetchErr } = await adminSupabase
      .from('task_assignments')
      .select('id, task_id, responsibility, member_id, archived_at')
      .not('archived_at', 'is', null)
      .lt('archived_at', thirtyDaysAgoIso);

    if (fetchErr) {
      console.error('Error querying assignments for 30-day retention cleanup:', fetchErr);
      await adminSupabase.from('task_cron_logs').insert({
        job_type: 'retention_cleanup',
        tasks_checked: 0,
        assignments_flagged: 0,
        status: 'error',
        details: { error: fetchErr.message },
      });
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const assignments = eligibleAssignments || [];
    let purgedAssignmentsCount = 0;

    if (assignments.length > 0) {
      const assignmentIds = assignments.map((a) => a.id);

      const { error: deleteErr } = await adminSupabase
        .from('task_assignments')
        .delete()
        .in('id', assignmentIds);

      if (deleteErr) {
        console.error('Error deleting expired task assignments:', deleteErr);
      } else {
        purgedAssignmentsCount = assignments.length;
      }
    }

    // 2. Also clean up archived parent tasks with no remaining assignments
    const { data: eligibleTasks } = await adminSupabase
      .from('tasks')
      .select('id, is_archived, archived_at, assignments:task_assignments(id)')
      .eq('is_archived', true)
      .not('archived_at', 'is', null)
      .lt('archived_at', thirtyDaysAgoIso);

    let purgedTasksCount = 0;
    const taskIdsToDelete = (eligibleTasks || [])
      .filter((t: any) => !t.assignments || t.assignments.length === 0)
      .map((t: any) => t.id);

    if (taskIdsToDelete.length > 0) {
      const { error: taskDelErr } = await adminSupabase
        .from('tasks')
        .delete()
        .in('id', taskIdsToDelete);

      if (!taskDelErr) {
        purgedTasksCount = taskIdsToDelete.length;
      }
    }

    // 3. Record in task_cron_logs
    await adminSupabase.from('task_cron_logs').insert({
      job_type: 'retention_cleanup',
      tasks_checked: assignments.length + (eligibleTasks || []).length,
      assignments_flagged: purgedAssignmentsCount,
      status: 'success',
      details: {
        timestamp: new Date().toISOString(),
        thirtyDaysAgoThreshold: thirtyDaysAgoIso,
        purgedAssignmentsCount,
        purgedTasksCount,
      },
    });

    return NextResponse.json({
      success: true,
      purgedAssignmentsCount,
      purgedTasksCount,
      cutoff: thirtyDaysAgoIso,
    });
  } catch (err: any) {
    console.error('Error in task 30-day retention cleanup route:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
