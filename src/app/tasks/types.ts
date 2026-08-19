export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type AssignmentStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked' // Note: UI label is "Can't Complete"
  | 'completed'
  | 'overdue'
  | 'reassigned'
  | 'cancelled';

export type TaskRequestType =
  | 'reassignment'
  | 'deadline_extension'
  | 'clarification'
  | 'blocker';

export type TaskRequestStatus = 'pending' | 'approved' | 'rejected';

export type TaskAudienceType = 'individual' | 'all' | 'system_group' | 'custom_group';

export type SystemGroupKey = 'officers' | 'soprano' | 'alto' | 'tenor' | 'bass';

export interface CustomGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  members?: CustomGroupMember[];
  creator?: { id: string; full_name: string };
  member_count?: number;
}

export interface CustomGroupMember {
  id: string;
  group_id: string;
  member_id: string;
  added_at: string;
  member?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    voice_part?: string | null;
    role?: string;
  };
}

export interface TaskItem {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_date: string | null;
  created_by: string | null;
  related_song_id: string | null;
  related_sequence_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  creator?: { id: string; full_name: string; avatar_url?: string | null };
  related_song?: { id: string; title: string; composer?: string | null };
  related_sequence?: { id: string; title: string; scheduled_at?: string | null };
  assignments?: TaskAssignmentItem[];
}

export interface TaskAssignmentItem {
  id: string;
  task_id: string;
  member_id: string;
  responsibility: string;
  status: AssignmentStatus;
  due_date: string | null;
  blocker_reason: string | null;
  assigned_by: string | null;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  task?: TaskItem;
  member?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    voice_part?: string | null;
    role?: string;
  };
  assigner?: { id: string; full_name: string };
  requests?: TaskRequestItem[];
  comments?: TaskCommentItem[];
  history?: TaskAssignmentHistoryItem[];
}

export interface TaskRequestItem {
  id: string;
  task_assignment_id: string;
  request_type: TaskRequestType;
  requested_by: string;
  suggested_member_id: string | null;
  reason: string;
  requested_due_date: string | null;
  status: TaskRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  requester?: { id: string; full_name: string; avatar_url?: string | null };
  suggested_member?: { id: string; full_name: string; avatar_url?: string | null };
  reviewer?: { id: string; full_name: string };
  assignment?: TaskAssignmentItem;
}

export interface TaskAssignmentHistoryItem {
  id: string;
  task_assignment_id: string;
  action: string;
  performed_by: string | null;
  old_member_id: string | null;
  new_member_id: string | null;
  old_status: string | null;
  new_status: string | null;
  note: string | null;
  created_at: string;
  performer?: { id: string; full_name: string };
  old_member?: { id: string; full_name: string };
  new_member?: { id: string; full_name: string };
}

export interface TaskCommentItem {
  id: string;
  task_assignment_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    role?: string;
  };
}

export const OFFICER_ROLES = ['super_admin', 'director', 'secretary', 'treasurer'] as const;

export const isUserOfficer = (role?: string | null): boolean => {
  if (!role) return false;
  return OFFICER_ROLES.includes(role as any);
};
