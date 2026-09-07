'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getProfile } from '@/lib/supabase/user';
import { recordAuditLog } from '@/lib/audit';
import { sendPushToUser, sendPushToAll } from '@/lib/push';
import { delCache } from '@/lib/cache';
import { revalidatePath } from 'next/cache';

export type ReactionType = 'like' | 'heart' | 'pray' | 'clap' | 'music';

export interface ThreadMediaItem {
  id?: string;
  media_type: 'image' | 'gif';
  url: string;
  order_index?: number;
}

export interface ThreadCommentData {
  id: string;
  post_id: string;
  author_id: string | null;
  parent_comment_id?: string | null;
  content: string;
  is_anonymous: boolean;
  status: 'active' | 'edited' | 'deleted';
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    voice_part?: string | null;
    role: string;
  } | null;
  media?: ThreadMediaItem[];
  reactions?: Array<{
    id: string;
    reaction_type: ReactionType;
    member_id: string;
  }>;
}

export interface ThreadPostData {
  id: string;
  author_id: string | null;
  content: string;
  is_anonymous: boolean;
  is_pinned: boolean;
  category?: 'general' | 'minutes' | 'announcement' | 'repertoire' | 'prayer';
  requires_acknowledgement?: boolean;
  status: 'active' | 'edited' | 'deleted';
  created_at: string;
  updated_at: string;
  comment_count: number;
  reaction_count: number;
  acknowledgement_count: number;
  comments_count: number; // backward-compatibility alias for comment_count
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    voice_part?: string | null;
    role: string;
  } | null;
  media?: ThreadMediaItem[];
  reactions?: Array<{
    id: string;
    reaction_type: ReactionType;
    member_id: string;
    member?: {
      id: string;
      full_name: string;
      avatar_url: string | null;
      role: string;
      voice_part?: string | null;
    } | null;
  }>;
  acknowledgements?: Array<{
    id: string;
    member_id: string;
    acknowledged_at: string;
  }>;
}

const OFFICER_ROLES = ['super_admin', 'director', 'secretary', 'treasurer'];

/**
 * Fetch thread posts with masked anonymous author data for non-officers
 * Optimized with database counter caches to eliminate N+1 queries.
 */
export async function getThreadPosts(options: {
  limit?: number;
  offset?: number;
  filter?: 'all' | 'pinned' | 'media' | 'anonymous' | 'minutes';
} = {}) {
  const profile = await getProfile();
  if (!profile) return { data: [], error: 'Unauthorized' };

  const isOfficer = OFFICER_ROLES.includes(profile.role);
  const supabase = await createClient();
  const limit = options.limit || 25;
  const offset = options.offset || 0;

  let query = supabase
    .from('thread_posts')
    .select(`
      id,
      author_id,
      content,
      is_anonymous,
      is_pinned,
      category,
      requires_acknowledgement,
      status,
      created_at,
      updated_at,
      comment_count,
      reaction_count,
      acknowledgement_count,
      author:author_id(id, full_name, avatar_url, voice_part, role),
      media:thread_media(id, media_type, url, order_index),
      reactions:thread_reactions(id, reaction_type, member_id, member:member_id(id, full_name, avatar_url, role, voice_part)),
      acknowledgements:thread_acknowledgements(id, member_id, acknowledged_at)
    `)
    .neq('status', 'deleted');

  if (options.filter === 'pinned') {
    query = query.eq('is_pinned', true);
  } else if (options.filter === 'anonymous') {
    query = query.eq('is_anonymous', true);
  } else if (options.filter === 'minutes') {
    query = query.eq('category', 'minutes');
  }

  // Order pinned first, then newest
  query = query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: rawPosts, error } = await query;
  if (error) {
    console.error('Error fetching thread posts:', error);
    return { data: [], error: error.message };
  }

  // Process posts and apply anonymity masking (counter caches are retrieved in single query)
  const posts: ThreadPostData[] = (rawPosts || []).map((p: any) => {
    const isAnon = !!p.is_anonymous;
    const isAuthor = p.author_id === profile.id;
    const canSeeAuthor = !isAnon || isOfficer || isAuthor;

    const author = canSeeAuthor && p.author
      ? {
          id: p.author.id,
          full_name: p.author.full_name,
          avatar_url: p.author.avatar_url,
          voice_part: p.author.voice_part,
          role: p.author.role,
        }
      : {
          id: '',
          full_name: 'Anonymous Member',
          avatar_url: null,
          voice_part: 'Choir Member',
          role: 'member',
        };

    const commentCount = typeof p.comment_count === 'number' ? p.comment_count : 0;
    const reactionCount = typeof p.reaction_count === 'number' ? p.reaction_count : (p.reactions?.length || 0);
    const acknowledgementCount = typeof p.acknowledgement_count === 'number' ? p.acknowledgement_count : (p.acknowledgements?.length || 0);

    return {
      id: p.id,
      author_id: canSeeAuthor ? p.author_id : null,
      content: p.content,
      is_anonymous: isAnon,
      is_pinned: !!p.is_pinned,
      category: p.category || 'general',
      requires_acknowledgement: !!p.requires_acknowledgement,
      status: p.status,
      created_at: p.created_at,
      updated_at: p.updated_at,
      comment_count: commentCount,
      reaction_count: reactionCount,
      acknowledgement_count: acknowledgementCount,
      comments_count: commentCount,
      author,
      media: (p.media || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)),
      reactions: p.reactions || [],
      acknowledgements: p.acknowledgements || [],
    };
  });

  return { data: posts, error: null };
}

/**
 * Create a new Thread Post
 */
export async function createThreadPost(params: {
  content: string;
  is_anonymous?: boolean;
  category?: 'general' | 'minutes' | 'announcement' | 'repertoire' | 'prayer';
  requires_acknowledgement?: boolean;
  media?: Array<{ media_type: 'image' | 'gif'; url: string }>;
  mentions?: string[]; // Member IDs
}) {
  const profile = await getProfile();
  if (!profile) return { error: 'You must be logged in to post.' };

  const isOfficer = OFFICER_ROLES.includes(profile.role);
  const content = params.content?.trim();
  if (!content && (!params.media || params.media.length === 0)) {
    return { error: 'Post cannot be empty.' };
  }

  // Only officers can post official minutes / mandatory acknowledgements
  const requestedCategory = params.category || 'general';
  const category = (requestedCategory === 'minutes' || requestedCategory === 'announcement') && !isOfficer
    ? 'general'
    : requestedCategory;

  const requiresAcknowledgement = isOfficer
    ? !!params.requires_acknowledgement || category === 'minutes'
    : false;

  const supabase = await createClient();

  // 1. Insert thread_post (author_id is always recorded)
  const { data: post, error: postErr } = await supabase
    .from('thread_posts')
    .insert({
      author_id: profile.id,
      content: content || '',
      is_anonymous: !!params.is_anonymous,
      category,
      requires_acknowledgement: requiresAcknowledgement,
      status: 'active',
    })
    .select()
    .single();

  if (postErr || !post) {
    console.error('Error creating post:', postErr);
    return { error: postErr?.message || 'Failed to create post.' };
  }

  // 2. Insert media if any
  if (params.media && params.media.length > 0) {
    const mediaRows = params.media.map((m, idx) => ({
      post_id: post.id,
      media_type: m.media_type,
      url: m.url,
      order_index: idx,
    }));
    await supabase.from('thread_media').insert(mediaRows);
  }

  // 3. Insert mentions and trigger push notification
  if (params.mentions && params.mentions.length > 0) {
    const uniqueMentionIds = Array.from(new Set(params.mentions)).filter((id) => id !== profile.id);
    if (uniqueMentionIds.length > 0) {
      const mentionRows = uniqueMentionIds.map((memberId) => ({
        post_id: post.id,
        mentioned_member_id: memberId,
      }));
      await supabase.from('thread_mentions').insert(mentionRows);

      // Trigger push notifications for mentioned members
      for (const targetId of uniqueMentionIds) {
        const title = params.is_anonymous
          ? 'Choir Feed: New Mention'
          : `Choir Feed: ${profile.full_name} mentioned you`;
        const body = params.is_anonymous
          ? 'Someone mentioned you in an anonymous post.'
          : `${profile.full_name}: "${content.length > 80 ? content.slice(0, 77) + '...' : content}"`;

        sendPushToUser(targetId, {
          title,
          body,
          url: '/dashboard',
        }).catch(console.error);
      }
    }
  }

  // 4. If Meeting Minutes or Official Announcement (or requires_acknowledgement), notify ALL choristers
  if (category === 'minutes' || category === 'announcement' || requiresAcknowledgement) {
    const pushTitle = category === 'minutes'
      ? 'Please Read and Acknowledge: Minutes of the Meeting!'
      : 'Please Read and Acknowledge: Official Announcement!';

    const cleanSnippet = (content || '')
      .replace(/[#*`_>~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    sendPushToAll(
      {
        title: pushTitle,
        body:
          cleanSnippet.length > 115
            ? cleanSnippet.slice(0, 112) + '...'
            : cleanSnippet || 'A new official update requires your acknowledgement.',
        url: '/dashboard',
      },
      { excludeUserIds: [profile.id] }
    ).catch(console.error);
  }

  revalidatePath('/dashboard');
  return { success: true, post };
}

/**
 * Update / Edit an existing Thread Post
 */
export async function updateThreadPost(params: {
  postId: string;
  content: string;
  is_anonymous?: boolean;
}) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const isOfficer = OFFICER_ROLES.includes(profile.role);
  const supabase = await createClient();

  // Verify ownership or officer role
  const { data: post } = await supabase
    .from('thread_posts')
    .select('author_id')
    .eq('id', params.postId)
    .single();

  if (!post) return { error: 'Post not found.' };
  if (post.author_id !== profile.id && !isOfficer) {
    return { error: 'You do not have permission to edit this post.' };
  }

  const content = params.content?.trim();
  if (!content) {
    return { error: 'Post content cannot be empty.' };
  }

  const { error: updateErr } = await supabase
    .from('thread_posts')
    .update({
      content,
      is_anonymous: !!params.is_anonymous,
      status: 'edited',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.postId);

  if (updateErr) return { error: updateErr.message };

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Toggle Pin on a Thread Post (Officer only)
 */
export async function togglePinThreadPost(postId: string, isPinned: boolean) {
  const profile = await getProfile();
  if (!profile || !OFFICER_ROLES.includes(profile.role)) {
    return { error: 'Only choir officers can pin or unpin posts.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('thread_posts')
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq('id', postId);

  if (error) return { error: error.message };

  await recordAuditLog({
    actorId: profile.id,
    action: isPinned ? 'thread.pin_post' : 'thread.unpin_post',
    entityType: 'thread_post',
    entityId: postId,
    metadata: { is_pinned: isPinned, officer_role: profile.role },
  });

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Delete / Soft-Delete a Post
 */
export async function deleteThreadPost(postId: string) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const isOfficer = OFFICER_ROLES.includes(profile.role);
  const supabase = await createClient();

  // Verify ownership or officer role
  const { data: post } = await supabase
    .from('thread_posts')
    .select('author_id, is_anonymous')
    .eq('id', postId)
    .single();

  if (!post) return { error: 'Post not found.' };

  if (post.author_id !== profile.id && !isOfficer) {
    return { error: 'You do not have permission to delete this post.' };
  }

  const { error } = await supabase
    .from('thread_posts')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', postId);

  if (error) return { error: error.message };

  if (isOfficer && post.author_id !== profile.id) {
    await recordAuditLog({
      actorId: profile.id,
      action: 'thread.moderate_delete_post',
      entityType: 'thread_post',
      entityId: postId,
      metadata: { original_author_id: post.author_id, is_anonymous: post.is_anonymous },
    });
  }

  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Toggle Reaction on a Post or Comment
 */
export async function toggleThreadReaction(params: {
  postId?: string;
  commentId?: string;
  reactionType: ReactionType;
}) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const supabase = await createClient();

  // Check if reaction already exists
  let checkQuery = supabase
    .from('thread_reactions')
    .select('id')
    .eq('member_id', profile.id)
    .eq('reaction_type', params.reactionType);

  if (params.postId) {
    checkQuery = checkQuery.eq('post_id', params.postId);
  } else if (params.commentId) {
    checkQuery = checkQuery.eq('comment_id', params.commentId);
  } else {
    return { error: 'Invalid reaction target.' };
  }

  const { data: existing } = await checkQuery.maybeSingle();

  if (existing) {
    // Remove reaction
    const { error: delErr } = await supabase
      .from('thread_reactions')
      .delete()
      .eq('id', existing.id);

    if (delErr) return { error: delErr.message };
    return { success: true, action: 'removed' };
  } else {
    // Insert reaction
    const { error: insErr } = await supabase
      .from('thread_reactions')
      .insert({
        post_id: params.postId || null,
        comment_id: params.commentId || null,
        member_id: profile.id,
        reaction_type: params.reactionType,
      });

    if (insErr) return { error: insErr.message };
    return { success: true, action: 'added' };
  }
}

/**
 * Toggle Acknowledgement on a Post
 */
export async function toggleThreadAcknowledgement(postId: string) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('thread_acknowledgements')
    .select('id')
    .eq('post_id', postId)
    .eq('member_id', profile.id)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await supabase
      .from('thread_acknowledgements')
      .delete()
      .eq('id', existing.id);

    if (delErr) return { error: delErr.message };
    return { success: true, action: 'unacknowledged' };
  } else {
    const { error: insErr } = await supabase
      .from('thread_acknowledgements')
      .insert({
        post_id: postId,
        member_id: profile.id,
      });

    if (insErr) return { error: insErr.message };
    return { success: true, action: 'acknowledged' };
  }
}

/**
 * Fetch comments for a specific post
 */
export async function getThreadComments(postId: string) {
  const profile = await getProfile();
  if (!profile) return { data: [], error: 'Unauthorized' };

  const isOfficer = OFFICER_ROLES.includes(profile.role);
  const supabase = await createClient();

  const { data: rawComments, error } = await supabase
    .from('thread_comments')
    .select(`
      id,
      post_id,
      author_id,
      parent_comment_id,
      content,
      is_anonymous,
      status,
      created_at,
      updated_at,
      author:author_id(id, full_name, avatar_url, voice_part, role),
      media:thread_media(id, media_type, url, order_index),
      reactions:thread_reactions(id, reaction_type, member_id, member:member_id(id, full_name, avatar_url, role, voice_part))
    `)
    .eq('post_id', postId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching thread comments:', error);
    return { data: [], error: error.message };
  }

  const comments: ThreadCommentData[] = (rawComments || []).map((c: any) => {
    const isAnon = !!c.is_anonymous;
    const isAuthor = c.author_id === profile.id;
    const canSeeAuthor = !isAnon || isOfficer || isAuthor;

    const author = canSeeAuthor && c.author
      ? {
          id: c.author.id,
          full_name: c.author.full_name,
          avatar_url: c.author.avatar_url,
          voice_part: c.author.voice_part,
          role: c.author.role,
        }
      : {
          id: '',
          full_name: 'Anonymous Member',
          avatar_url: null,
          voice_part: 'Choir Member',
          role: 'member',
        };

    return {
      id: c.id,
      post_id: c.post_id,
      author_id: canSeeAuthor ? c.author_id : null,
      parent_comment_id: c.parent_comment_id || null,
      content: c.content,
      is_anonymous: isAnon,
      status: c.status,
      created_at: c.created_at,
      updated_at: c.updated_at,
      author,
      media: (c.media || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)),
      reactions: c.reactions || [],
    };
  });

  return { data: comments, error: null };
}

/**
 * Create a new Thread Comment
 */
export async function createThreadComment(params: {
  postId: string;
  parentCommentId?: string | null;
  content: string;
  is_anonymous?: boolean;
  media?: Array<{ media_type: 'image' | 'gif'; url: string }>;
  mentions?: string[];
}) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const content = params.content?.trim();
  if (!content && (!params.media || params.media.length === 0)) {
    return { error: 'Comment cannot be empty.' };
  }

  const supabase = await createClient();

  const { data: comment, error: cErr } = await supabase
    .from('thread_comments')
    .insert({
      post_id: params.postId,
      author_id: profile.id,
      parent_comment_id: params.parentCommentId || null,
      content: content || '',
      is_anonymous: !!params.is_anonymous,
      status: 'active',
    })
    .select()
    .single();

  if (cErr || !comment) {
    return { error: cErr?.message || 'Failed to add comment.' };
  }

  if (params.media && params.media.length > 0) {
    const mediaRows = params.media.map((m, idx) => ({
      comment_id: comment.id,
      media_type: m.media_type,
      url: m.url,
      order_index: idx,
    }));
    await supabase.from('thread_media').insert(mediaRows);
  }

  // Notify original post author (if not self and not anonymous)
  const { data: post } = await supabase
    .from('thread_posts')
    .select('author_id')
    .eq('id', params.postId)
    .single();

  if (post && post.author_id !== profile.id) {
    const title = params.is_anonymous
      ? 'Choir Feed: New comment on your post'
      : `Choir Feed: ${profile.full_name} commented on your post`;
    const body = params.is_anonymous
      ? 'An anonymous chorister replied to your post.'
      : `${profile.full_name}: "${content.length > 80 ? content.slice(0, 77) + '...' : content}"`;

    sendPushToUser(post.author_id, {
      title,
      body,
      url: '/dashboard',
    }).catch(console.error);
  }

  return { success: true, comment };
}

/**
 * Delete a Thread Comment
 */
export async function deleteThreadComment(commentId: string) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const isOfficer = OFFICER_ROLES.includes(profile.role);
  const supabase = await createClient();

  const { data: comment } = await supabase
    .from('thread_comments')
    .select('author_id, is_anonymous, post_id')
    .eq('id', commentId)
    .single();

  if (!comment) return { error: 'Comment not found.' };

  if (comment.author_id !== profile.id && !isOfficer) {
    return { error: 'You do not have permission to delete this comment.' };
  }

  const { error } = await supabase
    .from('thread_comments')
    .update({
      status: 'deleted',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', commentId);

  if (error) return { error: error.message };

  if (isOfficer && comment.author_id !== profile.id) {
    await recordAuditLog({
      actorId: profile.id,
      action: 'thread.moderate_delete_comment',
      entityType: 'thread_comment',
      entityId: commentId,
      metadata: { original_author_id: comment.author_id, is_anonymous: comment.is_anonymous },
    });
  }

  return { success: true };
}

/**
 * Officer unmask audit log
 */
export async function logAnonymousRevealAudit(postId: string, authorId: string) {
  const profile = await getProfile();
  if (!profile || !OFFICER_ROLES.includes(profile.role)) return;

  await recordAuditLog({
    actorId: profile.id,
    action: 'thread.reveal_anonymous',
    entityType: 'thread_post',
    entityId: postId,
    metadata: {
      revealed_author_id: authorId,
      officer_role: profile.role,
      revealed_at: new Date().toISOString(),
    },
  });
}

export interface AcknowledgementRosterMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  voice_part: string | null;
  role: string;
  has_acknowledged: boolean;
  acknowledged_at?: string | null;
}

export interface AcknowledgementRosterSection {
  section: string;
  confirmed_count: number;
  total_count: number;
  members: AcknowledgementRosterMember[];
}

/**
 * Fetch full section-by-section roster for post acknowledgements
 */
export async function getPostAcknowledgementRoster(postId: string) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const adminSupabase = createAdminClient();

  // 1. Fetch all active members from profiles using admin client
  const { data: allProfiles, error: profErr } = await adminSupabase
    .from('profiles')
    .select('id, full_name, avatar_url, voice_part, role')
    .not('role', 'in', '("pending","rejected")')
    .order('full_name', { ascending: true });

  if (profErr) return { error: profErr.message };

  // 2. Fetch all acknowledgements for this post
  const { data: acks, error: ackErr } = await adminSupabase
    .from('thread_acknowledgements')
    .select('id, member_id, acknowledged_at')
    .eq('post_id', postId);

  if (ackErr) return { error: ackErr.message };

  const ackMap = new Map<string, string>();
  (acks || []).forEach((a) => {
    ackMap.set(a.member_id, a.acknowledged_at);
  });

  // Group by voice section (Soprano, Alto, Tenor, Bass, Other)
  const sectionsMap: Record<string, AcknowledgementRosterMember[]> = {
    Soprano: [],
    Alto: [],
    Tenor: [],
    Bass: [],
    'Officers & Others': [],
  };

  (allProfiles || []).forEach((p) => {
    const hasAck = ackMap.has(p.id);
    const memberObj: AcknowledgementRosterMember = {
      id: p.id,
      full_name: p.full_name || 'Choir Member',
      avatar_url: p.avatar_url,
      voice_part: p.voice_part,
      role: p.role,
      has_acknowledged: hasAck,
      acknowledged_at: hasAck ? ackMap.get(p.id) : null,
    };

    const vp = (p.voice_part || '').toLowerCase();
    if (vp.includes('soprano')) {
      sectionsMap.Soprano.push(memberObj);
    } else if (vp.includes('alto')) {
      sectionsMap.Alto.push(memberObj);
    } else if (vp.includes('tenor')) {
      sectionsMap.Tenor.push(memberObj);
    } else if (vp.includes('bass')) {
      sectionsMap.Bass.push(memberObj);
    } else {
      sectionsMap['Officers & Others'].push(memberObj);
    }
  });

  const sections: AcknowledgementRosterSection[] = Object.entries(sectionsMap)
    .filter(([_, list]) => list.length > 0)
    .map(([section, list]) => {
      // Sort: confirmed first, then by name
      const sortedList = [...list].sort((a, b) => {
        if (a.has_acknowledged && !b.has_acknowledged) return -1;
        if (!a.has_acknowledged && b.has_acknowledged) return 1;
        return a.full_name.localeCompare(b.full_name);
      });

      return {
        section,
        confirmed_count: list.filter((m) => m.has_acknowledged).length,
        total_count: list.length,
        members: sortedList,
      };
    });

  const totalConfirmed = acks?.length || 0;
  const totalMembers = allProfiles?.length || 0;

  return {
    success: true,
    total_confirmed: totalConfirmed,
    total_members: totalMembers,
    percentage: totalMembers > 0 ? Math.round((totalConfirmed / totalMembers) * 100) : 0,
    sections,
  };
}

/**
 * Nudge choir members who have not yet acknowledged this post
 */
export async function nudgePendingMembers(postId: string) {
  const profile = await getProfile();
  if (!profile || !OFFICER_ROLES.includes(profile.role)) {
    return { error: 'Only officers can send acknowledgement reminders.' };
  }

  const adminSupabase = createAdminClient();

  // Fetch post snippet
  const { data: post } = await adminSupabase
    .from('thread_posts')
    .select('content, category')
    .eq('id', postId)
    .single();

  if (!post) return { error: 'Post not found.' };

  // Fetch all active profiles
  const { data: allProfiles } = await adminSupabase
    .from('profiles')
    .select('id')
    .not('role', 'in', '("pending","rejected")');

  // Fetch who already acknowledged
  const { data: acks } = await adminSupabase
    .from('thread_acknowledgements')
    .select('member_id')
    .eq('post_id', postId);

  const ackedSet = new Set((acks || []).map((a) => a.member_id));
  const pendingIds = (allProfiles || [])
    .map((p) => p.id)
    .filter((id) => !ackedSet.has(id) && id !== profile.id);

  if (pendingIds.length === 0) {
    return { success: true, count: 0, message: 'All members have already acknowledged this post!' };
  }

  // Send push notification to pending members
  const title = post.category === 'minutes'
    ? '📋 Meeting Minutes: Acknowledgement Needed'
    : '📢 Notice: Acknowledgement Needed';
  const body = `Please review and acknowledge the latest notice from ${profile.full_name}.`;

  for (const memberId of pendingIds) {
    sendPushToUser(memberId, {
      title,
      body,
      url: '/dashboard',
    }).catch(console.error);
  }

  return { success: true, count: pendingIds.length };
}

/**
 * Toggle Acknowledgement on a top-banner Announcement
 */
export async function toggleAnnouncementAcknowledgement(announcementId: string) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('announcement_acknowledgements')
    .select('id')
    .eq('announcement_id', announcementId)
    .eq('member_id', profile.id)
    .maybeSingle();

  if (existing) {
    const { error: delErr } = await supabase
      .from('announcement_acknowledgements')
      .delete()
      .eq('id', existing.id);

    if (delErr) return { error: delErr.message };
    await delCache('announcements:active');
    revalidatePath('/dashboard');
    return { success: true, action: 'unacknowledged' };
  } else {
    const { error: insErr } = await supabase
      .from('announcement_acknowledgements')
      .insert({
        announcement_id: announcementId,
        member_id: profile.id,
      });

    if (insErr) return { error: insErr.message };
    await delCache('announcements:active');
    revalidatePath('/dashboard');
    return { success: true, action: 'acknowledged' };
  }
}

/**
 * Fetch section-by-section roster for top-banner Announcement acknowledgements
 */
export async function getAnnouncementAcknowledgementRoster(announcementId: string) {
  const profile = await getProfile();
  if (!profile) return { error: 'Unauthorized' };

  const adminSupabase = createAdminClient();

  const { data: allProfiles, error: profErr } = await adminSupabase
    .from('profiles')
    .select('id, full_name, avatar_url, voice_part, role')
    .not('role', 'in', '("pending","rejected")')
    .order('full_name', { ascending: true });

  if (profErr) return { error: profErr.message };

  const { data: acks, error: ackErr } = await adminSupabase
    .from('announcement_acknowledgements')
    .select('id, member_id, acknowledged_at')
    .eq('announcement_id', announcementId);

  if (ackErr) return { error: ackErr.message };

  const ackMap = new Map<string, string>();
  (acks || []).forEach((a) => {
    ackMap.set(a.member_id, a.acknowledged_at);
  });

  const sectionMap = new Map<string, AcknowledgementRosterMember[]>();
  const defaultSections = ['Soprano', 'Alto', 'Tenor', 'Bass', 'Officers & Others'];
  defaultSections.forEach((s) => sectionMap.set(s, []));

  (allProfiles || []).forEach((p) => {
    const isAcked = ackMap.has(p.id);
    const ackTime = ackMap.get(p.id) || null;

    let targetSec = 'Officers & Others';
    if (p.voice_part) {
      const vpLower = p.voice_part.toLowerCase();
      if (vpLower.includes('soprano')) targetSec = 'Soprano';
      else if (vpLower.includes('alto')) targetSec = 'Alto';
      else if (vpLower.includes('tenor')) targetSec = 'Tenor';
      else if (vpLower.includes('bass')) targetSec = 'Bass';
    }

    const memberEntry: AcknowledgementRosterMember = {
      id: p.id,
      full_name: p.full_name || 'Member',
      avatar_url: p.avatar_url || null,
      voice_part: p.voice_part || null,
      role: p.role,
      has_acknowledged: isAcked,
      acknowledged_at: ackTime,
    };

    if (!sectionMap.has(targetSec)) {
      sectionMap.set(targetSec, []);
    }
    sectionMap.get(targetSec)!.push(memberEntry);
  });

  const sections: AcknowledgementRosterSection[] = defaultSections
    .filter((sec) => (sectionMap.get(sec) || []).length > 0)
    .map((section) => {
      const list = sectionMap.get(section) || [];
      const sortedList = [...list].sort((a, b) => {
        if (a.has_acknowledged && !b.has_acknowledged) return -1;
        if (!a.has_acknowledged && b.has_acknowledged) return 1;
        return a.full_name.localeCompare(b.full_name);
      });

      return {
        section,
        confirmed_count: list.filter((m) => m.has_acknowledged).length,
        total_count: list.length,
        members: sortedList,
      };
    });

  const totalConfirmed = acks?.length || 0;
  const totalMembers = allProfiles?.length || 0;

  return {
    success: true,
    total_confirmed: totalConfirmed,
    total_members: totalMembers,
    percentage: totalMembers > 0 ? Math.round((totalConfirmed / totalMembers) * 100) : 0,
    sections,
  };
}

/**
 * Nudge choir members who have not yet acknowledged an Announcement
 */
export async function nudgeAnnouncementPendingMembers(announcementId: string) {
  const profile = await getProfile();
  if (!profile || !OFFICER_ROLES.includes(profile.role)) {
    return { error: 'Only officers can send acknowledgement reminders.' };
  }

  const adminSupabase = createAdminClient();

  const { data: announcement } = await adminSupabase
    .from('announcements')
    .select('title, body')
    .eq('id', announcementId)
    .single();

  if (!announcement) return { error: 'Announcement not found.' };

  const { data: allProfiles } = await adminSupabase
    .from('profiles')
    .select('id')
    .not('role', 'in', '("pending","rejected")');

  const { data: acks } = await adminSupabase
    .from('announcement_acknowledgements')
    .select('member_id')
    .eq('announcement_id', announcementId);

  const ackedSet = new Set((acks || []).map((a) => a.member_id));
  const pendingIds = (allProfiles || [])
    .map((p) => p.id)
    .filter((id) => !ackedSet.has(id) && id !== profile.id);

  if (pendingIds.length === 0) {
    return { success: true, count: 0, message: 'All members have already acknowledged this announcement!' };
  }

  const title = `📢 ${announcement.title}: Acknowledgement Needed`;
  const body = `Please review and acknowledge the choir announcement from ${profile.full_name}.`;

  for (const memberId of pendingIds) {
    sendPushToUser(memberId, {
      title,
      body,
      url: '/dashboard',
    }).catch(console.error);
  }

  return { success: true, count: pendingIds.length };
}
