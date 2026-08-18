'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/lib/push';
import type { TaskItem, TaskRequestItem, TaskPriority } from '@/app/tasks/types';

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority: TaskPriority;
  due_date?: string | null;
  related_song_id?: string | null;
  related_sequence_id?: string | null;
}

export interface CreateResponsibilityItem {
  member_id: string;
  responsibility: string;
  due_date?: string | null;
}

export async function getAllTasksAdmin(): Promise<TaskItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        creator:created_by (id, full_name, avatar_url),
        related_song:related_song_id (id, title, composer),
        related_sequence:related_sequence_id (id, title, scheduled_at),
        assignments:task_assignments (
          id,
          task_id,
          member_id,
          responsibility,
          status,
          due_date,
          blocker_reason,
          assigned_by,
          assigned_at,
          started_at,
          completed_at,
          created_at,
          member:member_id (id, full_name, avatar_url, voice_part, role),
          requests:task_requests (
            id,
            request_type,
            requested_by,
            suggested_member_id,
            reason,
            status,
            review_note,
            created_at,
            requester:requested_by (id, full_name, avatar_url),
            suggested_member:suggested_member_id (id, full_name, avatar_url)
          ),
          comments:task_comments (
            id,
            author_id,
            content,
            created_at,
            author:author_id (id, full_name, avatar_url, role)
          ),
          history:task_assignment_history (
            id,
            action,
            old_status,
            new_status,
            note,
            created_at,
            performer:performed_by (id, full_name),
            old_member:old_member_id (id, full_name),
            new_member:new_member_id (id, full_name)
          )
        )
      `)
      .order('is_archived', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin tasks:', error);
      return [];
    }

    return (data || []) as unknown as TaskItem[];
  } catch (err) {
    console.error('getAllTasksAdmin failed:', err);
    return [];
  }
}

export async function getPendingRequestsAdmin(): Promise<TaskRequestItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('task_requests')
      .select(`
        *,
        requester:requested_by (id, full_name, avatar_url),
        suggested_member:suggested_member_id (id, full_name, avatar_url),
        assignment:task_assignment_id (
          id,
          task_id,
          responsibility,
          status,
          due_date,
          task:task_id (id, title, priority)
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending requests:', error);
      return [];
    }

    return (data || []) as unknown as TaskRequestItem[];
  } catch (err) {
    console.error('getPendingRequestsAdmin failed:', err);
    return [];
  }
}

export async function createTaskWithResponsibilities(
  taskInput: CreateTaskInput,
  responsibilities: CreateResponsibilityItem[],
  assignToAll: boolean = false,
  commonResponsibilityTitle: string = ''
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
      return { error: 'Unauthorized: Privileged role required' };
    }

    if (!taskInput.title?.trim()) {
      return { error: 'Task title is required.' };
    }

    // 1. Create Task
    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .insert({
        title: taskInput.title.trim(),
        description: taskInput.description?.trim() || null,
        priority: taskInput.priority || 'normal',
        due_date: taskInput.due_date || null,
        related_song_id: taskInput.related_song_id || null,
        related_sequence_id: taskInput.related_sequence_id || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (taskErr || !taskData) {
      return { error: taskErr?.message || 'Failed to create task.' };
    }

    const taskId = taskData.id;
    let assignmentsToInsert: any[] = [];

    if (assignToAll) {
      // Fetch all active members
      const { data: members, error: memErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('role', ['super_admin', 'director', 'secretary', 'treasurer', 'member']);

      if (memErr || !members || members.length === 0) {
        return { error: 'Could not fetch active choir members.' };
      }

      const respText = commonResponsibilityTitle?.trim() || taskInput.title.trim();
      assignmentsToInsert = members.map((m) => ({
        task_id: taskId,
        member_id: m.id,
        responsibility: respText,
        due_date: taskInput.due_date || null,
        status: 'pending',
        assigned_by: user.id,
      }));
    } else {
      if (!responsibilities || responsibilities.length === 0) {
        return { error: 'Please add at least one member responsibility.' };
      }

      assignmentsToInsert = responsibilities.map((r) => ({
        task_id: taskId,
        member_id: r.member_id,
        responsibility: r.responsibility.trim(),
        due_date: r.due_date || taskInput.due_date || null,
        status: 'pending',
        assigned_by: user.id,
      }));
    }

    // 2. Insert assignments
    const { data: insertedAssignments, error: assignErr } = await supabase
      .from('task_assignments')
      .insert(assignmentsToInsert)
      .select();

    if (assignErr) {
      console.error('Error inserting assignments:', assignErr);
      return { error: assignErr.message };
    }

    // 3. Record history for each assignment & push notify
    for (const a of insertedAssignments || []) {
      await supabase.from('task_assignment_history').insert({
        task_assignment_id: a.id,
        action: 'Assigned Responsibility',
        performed_by: user.id,
        new_member_id: a.member_id,
        new_status: 'pending',
        note: a.responsibility,
      });

      if (a.member_id !== user.id) {
        await sendPushToUser(a.member_id, {
          title: '📋 New Responsibility Assigned',
          body: `You were assigned "${a.responsibility}" in task "${taskInput.title}"`,
          url: '/tasks',
        });
      }
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    revalidatePath('/dashboard');
    return { success: true, taskId };
  } catch (err: any) {
    console.error('createTaskWithResponsibilities failed:', err);
    return { error: err.message || 'Failed to create task' };
  }
}

export async function approveReassignment(
  requestId: string,
  newMemberId: string,
  reviewNote?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
      return { error: 'Unauthorized: Director or Super Admin role required' };
    }

    // Fetch request & assignment
    const { data: req, error: reqErr } = await supabase
      .from('task_requests')
      .select('*, assignment:task_assignment_id(*, task:task_id(title))')
      .eq('id', requestId)
      .single();

    if (reqErr || !req) return { error: 'Request not found' };

    const assignment = req.assignment;
    const oldMemberId = assignment.member_id;

    // 1. Update assignment
    const { error: updateAssignErr } = await supabase
      .from('task_assignments')
      .update({
        member_id: newMemberId,
        status: 'pending',
        blocker_reason: null,
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);

    if (updateAssignErr) return { error: updateAssignErr.message };

    // 2. Update request status
    const { error: updateReqErr } = await supabase
      .from('task_requests')
      .update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote?.trim() || 'Approved by Director',
        suggested_member_id: newMemberId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateReqErr) return { error: updateReqErr.message };

    // 3. Record history
    await supabase.from('task_assignment_history').insert({
      task_assignment_id: assignment.id,
      action: 'Reassignment Approved',
      performed_by: user.id,
      old_member_id: oldMemberId,
      new_member_id: newMemberId,
      old_status: assignment.status,
      new_status: 'pending',
      note: reviewNote?.trim() || req.reason,
    });

    // 4. Send push notifications
    if (oldMemberId) {
      await sendPushToUser(oldMemberId, {
        title: '✅ Reassignment Approved',
        body: `Your reassignment request for "${assignment.responsibility}" was approved.`,
        url: '/tasks',
      });
    }

    if (newMemberId && newMemberId !== user.id) {
      await sendPushToUser(newMemberId, {
        title: '📋 New Responsibility Assigned',
        body: `You have been assigned "${assignment.responsibility}" in "${assignment.task?.title || 'Task'}"`,
        url: '/tasks',
      });
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('approveReassignment failed:', err);
    return { error: err.message || 'Failed to approve reassignment' };
  }
}

export async function rejectReassignment(requestId: string, reviewNote: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
      return { error: 'Unauthorized: Director or Super Admin role required' };
    }

    const { data: req, error: reqErr } = await supabase
      .from('task_requests')
      .select('*, assignment:task_assignment_id(*)')
      .eq('id', requestId)
      .single();

    if (reqErr || !req) return { error: 'Request not found' };

    // Update request
    const { error: updateReqErr } = await supabase
      .from('task_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote.trim() || 'Request declined.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateReqErr) return { error: updateReqErr.message };

    // Record history
    await supabase.from('task_assignment_history').insert({
      task_assignment_id: req.task_assignment_id,
      action: 'Reassignment Rejected',
      performed_by: user.id,
      old_status: req.assignment?.status,
      new_status: req.assignment?.status,
      note: reviewNote.trim(),
    });

    // Notify requester
    if (req.requested_by) {
      await sendPushToUser(req.requested_by, {
        title: '❌ Reassignment Request Declined',
        body: `Your reassignment request for "${req.assignment?.responsibility}" was declined: ${reviewNote.trim()}`,
        url: '/tasks',
      });
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('rejectReassignment failed:', err);
    return { error: err.message || 'Failed to reject reassignment' };
  }
}

export async function resolveBlocker(assignmentId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: assignment, error: fetchErr } = await supabase
      .from('task_assignments')
      .select('*, task:task_id(title)')
      .eq('id', assignmentId)
      .single();

    if (fetchErr || !assignment) return { error: 'Assignment not found' };

    const { error: updateErr } = await supabase
      .from('task_assignments')
      .update({
        status: 'in_progress',
        blocker_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (updateErr) return { error: updateErr.message };

    await supabase.from('task_assignment_history').insert({
      task_assignment_id: assignmentId,
      action: 'Blocker Resolved by Director',
      performed_by: user.id,
      old_status: 'blocked',
      new_status: 'in_progress',
      note: 'Blocker cleared',
    });

    if (assignment.member_id !== user.id) {
      await sendPushToUser(assignment.member_id, {
        title: '✨ Blocker Resolved',
        body: `The blocker on "${assignment.responsibility}" has been marked resolved. You may resume work!`,
        url: '/tasks',
      });
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('resolveBlocker failed:', err);
    return { error: err.message || 'Failed to resolve blocker' };
  }
}

export async function archiveTask(taskId: string, isArchived: boolean) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('tasks')
      .update({ is_archived: isArchived, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) return { error: error.message };

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('archiveTask failed:', err);
    return { error: err.message || 'Failed to archive task' };
  }
}

export async function deleteTask(taskId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) return { error: error.message };

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('deleteTask failed:', err);
    return { error: err.message || 'Failed to delete task' };
  }
}
