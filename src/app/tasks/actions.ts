'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { sendPushToUser } from '@/lib/push';
import type { TaskAssignmentItem, AssignmentStatus, TaskCommentItem } from './types';

export async function getMyTaskAssignments(): Promise<TaskAssignmentItem[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('task_assignments')
      .select(`
        *,
        task:task_id (
          id,
          title,
          description,
          priority,
          due_date,
          created_by,
          related_song_id,
          related_sequence_id,
          is_archived,
          created_at,
          updated_at,
          creator:created_by (id, full_name, avatar_url),
          related_song:related_song_id (id, title, composer),
          related_sequence:related_sequence_id (id, title, scheduled_at)
        ),
        assigner:assigned_by (id, full_name),
        requests:task_requests (
          id,
          task_assignment_id,
          request_type,
          requested_by,
          suggested_member_id,
          reason,
          status,
          review_note,
          created_at
        ),
        comments:task_comments (
          id,
          task_assignment_id,
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
          performer:performed_by (id, full_name)
        )
      `)
      .eq('member_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my task assignments:', error);
      return [];
    }

    // Filter out archived parent tasks
    const active = (data || []).filter((a: any) => !a.task?.is_archived);
    return active as unknown as TaskAssignmentItem[];
  } catch (err) {
    console.error('getMyTaskAssignments failed:', err);
    return [];
  }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  newStatus: AssignmentStatus,
  blockerReason?: string
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Fetch existing assignment
    const { data: existing, error: fetchErr } = await supabase
      .from('task_assignments')
      .select('*, task:task_id(title)')
      .eq('id', assignmentId)
      .single();

    if (fetchErr || !existing) {
      return { error: 'Assignment not found' };
    }

    if (existing.member_id !== user.id) {
      // Check if user is director/admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!profile || !['super_admin', 'director', 'secretary'].includes(profile.role)) {
        return { error: 'Unauthorized to update this assignment' };
      }
    }

    const updates: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'in_progress' && !existing.started_at) {
      updates.started_at = new Date().toISOString();
    } else if (newStatus === 'completed') {
      updates.completed_at = new Date().toISOString();
      updates.blocker_reason = null;
    } else if (newStatus === 'blocked') {
      updates.blocker_reason = blockerReason?.trim() || 'Blocked';
    } else if (newStatus === 'pending') {
      updates.completed_at = null;
      updates.blocker_reason = null;
    }

    const { error: updateErr } = await supabase
      .from('task_assignments')
      .update(updates)
      .eq('id', assignmentId);

    if (updateErr) return { error: updateErr.message };

    // Record history
    await supabase.from('task_assignment_history').insert({
      task_assignment_id: assignmentId,
      action: `Status changed to ${newStatus}`,
      performed_by: user.id,
      old_status: existing.status,
      new_status: newStatus,
      note: blockerReason?.trim() || null,
    });

    // If blocked, notify directors
    if (newStatus === 'blocked') {
      const { data: directors } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['super_admin', 'director']);

      if (directors && directors.length > 0) {
        for (const d of directors) {
          if (d.id !== user.id) {
            await sendPushToUser(d.id, {
              title: '🛑 Task Blocked',
              body: `Responsibility "${existing.responsibility}" was reported as blocked: ${blockerReason || 'No reason provided'}`,
              url: '/admin/tasks',
            });
          }
        }
      }
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error('updateAssignmentStatus failed:', err);
    return { error: err.message || 'Failed to update assignment' };
  }
}

export async function requestReassignment(
  assignmentId: string,
  reason: string,
  suggestedMemberId?: string | null
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    if (!reason?.trim()) {
      return { error: 'Please provide a reason for the reassignment request.' };
    }

    // Verify assignment belongs to user
    const { data: assignment, error: assignErr } = await supabase
      .from('task_assignments')
      .select('*, task:task_id(title)')
      .eq('id', assignmentId)
      .eq('member_id', user.id)
      .single();

    if (assignErr || !assignment) {
      return { error: 'Assignment not found' };
    }

    // Check if there is already a pending request
    const { data: existingReq } = await supabase
      .from('task_requests')
      .select('id')
      .eq('task_assignment_id', assignmentId)
      .eq('request_type', 'reassignment')
      .eq('status', 'pending')
      .maybeSingle();

    if (existingReq) {
      return { error: 'A reassignment request is already pending review for this responsibility.' };
    }

    // Insert request
    const { error: reqErr } = await supabase.from('task_requests').insert({
      task_assignment_id: assignmentId,
      request_type: 'reassignment',
      requested_by: user.id,
      suggested_member_id: suggestedMemberId || null,
      reason: reason.trim(),
      status: 'pending',
    });

    if (reqErr) return { error: reqErr.message };

    // Record history
    await supabase.from('task_assignment_history').insert({
      task_assignment_id: assignmentId,
      action: 'Requested Reassignment',
      performed_by: user.id,
      old_status: assignment.status,
      new_status: assignment.status,
      note: reason.trim(),
    });

    // Notify Directors
    const { data: directors } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['super_admin', 'director']);

    if (directors && directors.length > 0) {
      for (const d of directors) {
        if (d.id !== user.id) {
          await sendPushToUser(d.id, {
            title: '🔄 Reassignment Request',
            body: `Reassignment requested for "${assignment.responsibility}": ${reason.trim()}`,
            url: '/admin/tasks',
          });
        }
      }
    }

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true };
  } catch (err: any) {
    console.error('requestReassignment failed:', err);
    return { error: err.message || 'Failed to submit reassignment request' };
  }
}

export async function addAssignmentComment(assignmentId: string, content: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    if (!content?.trim()) {
      return { error: 'Comment cannot be empty.' };
    }

    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_assignment_id: assignmentId,
        author_id: user.id,
        content: content.trim(),
      })
      .select(`
        *,
        author:author_id (id, full_name, avatar_url, role)
      `)
      .single();

    if (error) return { error: error.message };

    revalidatePath('/tasks');
    revalidatePath('/admin/tasks');
    return { success: true, comment: data as unknown as TaskCommentItem };
  } catch (err: any) {
    console.error('addAssignmentComment failed:', err);
    return { error: err.message || 'Failed to post comment' };
  }
}

export async function getAssignmentComments(assignmentId: string): Promise<TaskCommentItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        author:author_id (id, full_name, avatar_url, role)
      `)
      .eq('task_assignment_id', assignmentId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching assignment comments:', error);
      return [];
    }
    return (data || []) as unknown as TaskCommentItem[];
  } catch (err) {
    console.error('getAssignmentComments failed:', err);
    return [];
  }
}

export async function getAssignmentHistory(assignmentId: string): Promise<any[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('task_assignment_history')
      .select(`
        *,
        performer:performed_by (id, full_name)
      `)
      .eq('task_assignment_id', assignmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching assignment history:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('getAssignmentHistory failed:', err);
    return [];
  }
}
