'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/lib/push';
import type {
  TaskItem,
  TaskRequestItem,
  TaskPriority,
  CustomGroup,
  TaskAudienceType,
  SystemGroupKey,
} from '@/app/tasks/types';
import { OFFICER_ROLES } from '@/app/tasks/types';

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
          completion_comment,
          archived_at,
          assigned_by,
          assigned_at,
          started_at,
          completed_at,
          created_at,
          updated_at,
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

// ----------------------------------------------------
// Custom Groups CRUD
// ----------------------------------------------------
export async function getCustomGroupsAdmin(): Promise<CustomGroup[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('custom_groups')
      .select(`
        *,
        creator:created_by(id, full_name),
        members:custom_group_members (
          id,
          group_id,
          member_id,
          added_at,
          member:member_id(id, full_name, avatar_url, voice_part, role)
        )
      `)
      .order('name', { ascending: true });

    if (error) {
      console.error('getCustomGroupsAdmin error:', error);
      return [];
    }

    const formatted: CustomGroup[] = (data || []).map((g: any) => ({
      ...g,
      member_count: g.members ? g.members.length : 0,
    }));

    return formatted;
  } catch (err) {
    console.error('getCustomGroupsAdmin failed:', err);
    return [];
  }
}

export async function createCustomGroup(name: string, description?: string, memberIds: string[] = []) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    if (!name?.trim()) {
      return { error: 'Group name is required.' };
    }

    // Insert group
    const { data: group, error: groupErr } = await supabase
      .from('custom_groups')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (groupErr || !group) {
      return { error: groupErr?.message || 'Failed to create custom group' };
    }

    // Insert members
    if (memberIds.length > 0) {
      const rows = memberIds.map((mid) => ({
        group_id: group.id,
        member_id: mid,
      }));
      const { error: memErr } = await supabase.from('custom_group_members').insert(rows);
      if (memErr) console.error('Error adding initial group members:', memErr);
    }

    revalidatePath('/admin/tasks');
    return { success: true, group };
  } catch (err: any) {
    console.error('createCustomGroup failed:', err);
    return { error: err.message || 'Failed to create group' };
  }
}

export async function updateCustomGroup(groupId: string, name: string, description?: string, memberIds?: string[]) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    const { error: updateErr } = await supabase
      .from('custom_groups')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', groupId);

    if (updateErr) return { error: updateErr.message };

    if (memberIds !== undefined) {
      // Re-sync members
      await supabase.from('custom_group_members').delete().eq('group_id', groupId);
      if (memberIds.length > 0) {
        const rows = memberIds.map((mid) => ({
          group_id: groupId,
          member_id: mid,
        }));
        await supabase.from('custom_group_members').insert(rows);
      }
    }

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('updateCustomGroup failed:', err);
    return { error: err.message || 'Failed to update group' };
  }
}

export async function deleteCustomGroup(groupId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    const { error } = await supabase.from('custom_groups').delete().eq('id', groupId);
    if (error) return { error: error.message };

    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('deleteCustomGroup failed:', err);
    return { error: err.message || 'Failed to delete group' };
  }
}

// ----------------------------------------------------
// Create Task With Extended Audience / Group Resolution
// ----------------------------------------------------
export async function createTaskWithResponsibilities(
  taskInput: CreateTaskInput,
  responsibilities: CreateResponsibilityItem[],
  audienceType: TaskAudienceType = 'individual',
  audienceParam?: {
    systemGroup?: SystemGroupKey;
    customGroupId?: string;
    commonResponsibilityTitle?: string;
  }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Officer check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    if (!taskInput.title?.trim()) {
      return { error: 'Task title is required.' };
    }

    // 1. Create Task Record
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
    const commonResp = audienceParam?.commonResponsibilityTitle?.trim() || taskInput.title.trim();

    // 2. Resolve audience to member assignments
    if (audienceType === 'all') {
      const { data: members, error: memErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .not('role', 'in', '("pending","rejected")');

      if (memErr || !members || members.length === 0) {
        return { error: 'Could not fetch active choir members.' };
      }

      assignmentsToInsert = members.map((m) => ({
        task_id: taskId,
        member_id: m.id,
        responsibility: commonResp,
        due_date: taskInput.due_date || null,
        status: 'pending',
        assigned_by: user.id,
      }));
    } else if (audienceType === 'system_group') {
      const groupKey = audienceParam?.systemGroup;
      let query = supabase.from('profiles').select('id, full_name').not('role', 'in', '("pending","rejected")');

      if (groupKey === 'officers') {
        query = query.in('role', ['super_admin', 'director', 'secretary', 'treasurer']);
      } else if (groupKey && ['soprano', 'alto', 'tenor', 'bass'].includes(groupKey)) {
        const capitalized = groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
        query = query.eq('voice_part', capitalized);
      }

      const { data: members, error: memErr } = await query;
      if (memErr || !members || members.length === 0) {
        return { error: `No active members found in system group "${groupKey}".` };
      }

      assignmentsToInsert = members.map((m) => ({
        task_id: taskId,
        member_id: m.id,
        responsibility: commonResp,
        due_date: taskInput.due_date || null,
        status: 'pending',
        assigned_by: user.id,
      }));
    } else if (audienceType === 'custom_group') {
      const groupId = audienceParam?.customGroupId;
      if (!groupId) return { error: 'Custom group not selected.' };

      const { data: groupMembers, error: gmErr } = await supabase
        .from('custom_group_members')
        .select('member_id')
        .eq('group_id', groupId);

      if (gmErr || !groupMembers || groupMembers.length === 0) {
        return { error: 'Selected custom group has no members.' };
      }

      assignmentsToInsert = groupMembers.map((gm) => ({
        task_id: taskId,
        member_id: gm.member_id,
        responsibility: commonResp,
        due_date: taskInput.due_date || null,
        status: 'pending',
        assigned_by: user.id,
      }));
    } else {
      // Individual responsibilities list
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

    // 3. Insert assignments
    const { data: insertedAssignments, error: assignErr } = await supabase
      .from('task_assignments')
      .insert(assignmentsToInsert)
      .select();

    if (assignErr) {
      console.error('Error inserting assignments:', assignErr);
      return { error: assignErr.message };
    }

    // 4. Record history & send push notification
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

// ----------------------------------------------------
// Forward / Add Assignees to Existing Task
// ----------------------------------------------------
export async function forwardTaskAssignees(
  taskId: string,
  newAssignees: { member_id: string; responsibility: string; due_date?: string | null }[]
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, title, due_date')
      .eq('id', taskId)
      .single();

    if (taskErr || !task) return { error: 'Task not found' };

    if (!newAssignees || newAssignees.length === 0) {
      return { error: 'Please select at least one member to assign.' };
    }

    const rows = newAssignees.map((na) => ({
      task_id: taskId,
      member_id: na.member_id,
      responsibility: na.responsibility.trim() || task.title,
      due_date: na.due_date || task.due_date || null,
      status: 'pending',
      assigned_by: user.id,
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from('task_assignments')
      .insert(rows)
      .select();

    if (insertErr) return { error: insertErr.message };

    for (const a of inserted || []) {
      await supabase.from('task_assignment_history').insert({
        task_assignment_id: a.id,
        action: 'Forwarded / Added Assignee',
        performed_by: user.id,
        new_member_id: a.member_id,
        new_status: 'pending',
        note: `Added to existing task "${task.title}"`,
      });

      if (a.member_id !== user.id) {
        await sendPushToUser(a.member_id, {
          title: '📋 Task Forwarded to You',
          body: `You were added to task "${task.title}": "${a.responsibility}"`,
          url: '/tasks',
        });
      }
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('forwardTaskAssignees failed:', err);
    return { error: err.message || 'Failed to forward task' };
  }
}

// ----------------------------------------------------
// Officer Direct Reassignment (No Approval Required)
// ----------------------------------------------------
export async function officerDirectReassign(
  assignmentId: string,
  newMemberId: string,
  note?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Officer check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    const { data: assignment, error: fetchErr } = await supabase
      .from('task_assignments')
      .select('*, task:task_id(title)')
      .eq('id', assignmentId)
      .single();

    if (fetchErr || !assignment) return { error: 'Assignment not found' };

    const oldMemberId = assignment.member_id;

    // Direct update
    const { error: updateErr } = await supabase
      .from('task_assignments')
      .update({
        member_id: newMemberId,
        status: 'pending',
        blocker_reason: null,
        started_at: null,
        completed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    if (updateErr) return { error: updateErr.message };

    // Log distinctly as officer_direct_assign
    await supabase.from('task_assignment_history').insert({
      task_assignment_id: assignmentId,
      action: 'officer_direct_assign',
      performed_by: user.id,
      old_member_id: oldMemberId,
      new_member_id: newMemberId,
      old_status: assignment.status,
      new_status: 'pending',
      note: note?.trim() || 'Directly reassigned by Officer',
    });

    // Notify both old and new members
    if (oldMemberId && oldMemberId !== user.id) {
      await sendPushToUser(oldMemberId, {
        title: '🔄 Responsibility Reassigned',
        body: `"${assignment.responsibility}" has been reassigned by an officer.`,
        url: '/tasks',
      });
    }

    if (newMemberId && newMemberId !== user.id) {
      await sendPushToUser(newMemberId, {
        title: '📋 New Responsibility Assigned',
        body: `You were assigned "${assignment.responsibility}" in "${assignment.task?.title || 'Task'}"`,
        url: '/tasks',
      });
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('officerDirectReassign failed:', err);
    return { error: err.message || 'Failed to directly reassign task' };
  }
}

// ----------------------------------------------------
// Reassignment Approval / Rejection (Member Requests)
// ----------------------------------------------------
export async function approveReassignment(
  requestId: string,
  newMemberId: string,
  reviewNote?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

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
        review_note: reviewNote?.trim() || 'Approved by Officer',
        suggested_member_id: newMemberId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateReqErr) return { error: updateReqErr.message };

    // 3. Record history
    await supabase.from('task_assignment_history').insert({
      task_assignment_id: assignment.id,
      action: 'reassignment_approved',
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    const { data: req, error: reqErr } = await supabase
      .from('task_requests')
      .select('*, assignment:task_assignment_id(*)')
      .eq('id', requestId)
      .single();

    if (reqErr || !req) return { error: 'Request not found' };

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

    await supabase.from('task_assignment_history').insert({
      task_assignment_id: req.task_assignment_id,
      action: 'reassignment_rejected',
      performed_by: user.id,
      old_status: req.assignment?.status,
      new_status: req.assignment?.status,
      note: reviewNote.trim(),
    });

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

// ----------------------------------------------------
// Resolve "Can't Complete" / Attention Flag
// ----------------------------------------------------
export async function resolveCantComplete(assignmentId: string, resolutionNote?: string) {
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
      action: 'Issue Resolved by Officer',
      performed_by: user.id,
      old_status: 'blocked',
      new_status: 'in_progress',
      note: resolutionNote?.trim() || 'Marked resolved by officer',
    });

    if (assignment.member_id !== user.id) {
      await sendPushToUser(assignment.member_id, {
        title: '✨ Issue Resolved',
        body: `Your update on "${assignment.responsibility}" was marked resolved. You may resume work!`,
        url: '/tasks',
      });
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('resolveCantComplete failed:', err);
    return { error: err.message || 'Failed to resolve issue' };
  }
}

// Backwards compatibility alias
export const resolveBlocker = resolveCantComplete;

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

// ----------------------------------------------------
// Merge / Combine Duplicate Tasks
// ----------------------------------------------------
export async function mergeTasks(
  targetTaskId: string,
  sourceTaskIds: string[],
  targetTitle?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Director / Super Admin check (Only Director/Super Admin can merge tasks)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const MERGE_PERMITTED_ROLES = ['super_admin', 'director'];
    if (!profile || !MERGE_PERMITTED_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Only the Choir Director or Super Admin can merge tasks.' };
    }

    if (!targetTaskId || !sourceTaskIds || sourceTaskIds.length === 0) {
      return { error: 'Target task and at least one source task are required.' };
    }

    // Filter out targetTaskId if accidentally passed in sourceTaskIds
    const validSourceIds = sourceTaskIds.filter((id) => id !== targetTaskId);
    if (validSourceIds.length === 0) {
      return { error: 'No distinct source tasks to merge.' };
    }

    // 1. Fetch Target Task
    const { data: targetTask, error: targetErr } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('id', targetTaskId)
      .single();

    if (targetErr || !targetTask) {
      return { error: 'Target task not found.' };
    }

    // 2. Fetch Source Tasks for titles/history logging
    const { data: sourceTasks, error: sourcesErr } = await supabase
      .from('tasks')
      .select('id, title')
      .in('id', validSourceIds);

    if (sourcesErr || !sourceTasks || sourceTasks.length === 0) {
      return { error: 'Source tasks not found.' };
    }

    const sourceTitles = sourceTasks.map((s) => `"${s.title}"`).join(', ');

    // 3. Move all task_assignments from source tasks to target task
    // First, fetch existing assignments on target task to check for duplicates
    const { data: targetAssignments } = await supabase
      .from('task_assignments')
      .select('id, member_id, responsibility, status, started_at, completed_at, blocker_reason')
      .eq('task_id', targetTaskId);

    const { data: sourceAssignments, error: fetchSourceAssignErr } = await supabase
      .from('task_assignments')
      .select('id, member_id, responsibility, status, started_at, completed_at, blocker_reason')
      .in('task_id', validSourceIds);

    if (fetchSourceAssignErr) {
      return { error: `Failed to fetch source assignments: ${fetchSourceAssignErr.message}` };
    }

    const targetMap = new Map<string, any>();
    (targetAssignments || []).forEach((ta: any) => {
      // Key by member_id + normalized responsibility
      const key = `${ta.member_id}_${(ta.responsibility || '').toLowerCase().trim()}`;
      targetMap.set(key, ta);
    });

    const statusWeight: Record<string, number> = {
      completed: 4,
      in_progress: 3,
      blocked: 2,
      pending: 1,
      overdue: 1,
    };

    let movedCount = 0;

    for (const sa of sourceAssignments || []) {
      const key = `${sa.member_id}_${(sa.responsibility || '').toLowerCase().trim()}`;
      const existingInTarget = targetMap.get(key);

      if (existingInTarget) {
        // Duplicate member assignment with identical responsibility already exists in target!
        // Preserve whichever has higher progress:
        const targetWeight = statusWeight[existingInTarget.status] || 0;
        const sourceWeight = statusWeight[sa.status] || 0;

        if (sourceWeight > targetWeight) {
          // Source has more progress! Update target's status/progress to match source
          await supabase
            .from('task_assignments')
            .update({
              status: sa.status,
              started_at: sa.started_at || existingInTarget.started_at,
              completed_at: sa.completed_at || existingInTarget.completed_at,
              blocker_reason: sa.blocker_reason || existingInTarget.blocker_reason,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInTarget.id);
        }

        // Move comments & history from the duplicate source assignment to the target assignment
        await supabase
          .from('task_comments')
          .update({ task_assignment_id: existingInTarget.id })
          .eq('task_assignment_id', sa.id);

        await supabase
          .from('task_assignment_history')
          .update({ task_assignment_id: existingInTarget.id })
          .eq('task_assignment_id', sa.id);

        // Delete the duplicate source assignment row
        await supabase.from('task_assignments').delete().eq('id', sa.id);
      } else {
        // Unique member assignment - simply move to target task (keeps exact progress, status, dates!)
        const { error: updateAssignErr } = await supabase
          .from('task_assignments')
          .update({
            task_id: targetTaskId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sa.id);

        if (!updateAssignErr) {
          movedCount++;
          // Log milestone
          await supabase.from('task_assignment_history').insert({
            task_assignment_id: sa.id,
            action: 'Merged into Task',
            performed_by: user.id,
            old_status: sa.status,
            new_status: sa.status,
            note: `Moved to "${targetTask.title}" with current progress (${sa.status}) preserved.`,
          });
        }
      }
    }

    // 4. If a new target title was provided, update it
    if (targetTitle && targetTitle.trim() && targetTitle.trim() !== targetTask.title) {
      await supabase
        .from('tasks')
        .update({ title: targetTitle.trim(), updated_at: new Date().toISOString() })
        .eq('id', targetTaskId);
    }

    // 5. Safely delete the empty duplicate source tasks
    const { error: deleteErr } = await supabase
      .from('tasks')
      .delete()
      .in('id', validSourceIds);

    if (deleteErr) {
      console.warn('Could not delete merged source tasks, archiving instead:', deleteErr);
      await supabase
        .from('tasks')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .in('id', validSourceIds);
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');

    return {
      success: true,
      mergedCount: validSourceIds.length,
      assignmentsMoved: movedCount,
      targetTitle: targetTitle || targetTask.title,
    };
  } catch (err: any) {
    console.error('mergeTasks failed:', err);
    return { error: err.message || 'Failed to merge tasks' };
  }
}

/**
 * Removes an individual member assignment from a task.
 * Restricted to officers (super_admin, director, secretary, treasurer).
 */
export async function removeTaskAssignment(assignmentId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !OFFICER_ROLES.includes(profile.role as any)) {
      return { error: 'Unauthorized: Officer privileges required' };
    }

    if (!assignmentId) {
      return { error: 'Assignment ID is required' };
    }

    // Delete associated comments, history, and requests for this assignment
    await supabase.from('task_comments').delete().eq('task_assignment_id', assignmentId);
    await supabase.from('task_assignment_history').delete().eq('task_assignment_id', assignmentId);
    await supabase.from('task_requests').delete().eq('task_assignment_id', assignmentId);

    const { error } = await supabase
      .from('task_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      return { error: `Failed to remove member assignment: ${error.message}` };
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');

    return { success: true };
  } catch (err: any) {
    console.error('removeTaskAssignment failed:', err);
    return { error: err.message || 'Failed to remove member assignment' };
  }
}


