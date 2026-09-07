'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageSquare,
  CheckCircle2,
  MoreVertical,
  Pin,
  Trash2,
  Lock,
  Globe,
  Share2,
  Sparkles,
  ShieldAlert,
  ThumbsUp,
  Music,
  Pencil,
  Check,
  X,
  Loader2,
  FileText,
  Megaphone,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import {
  ThreadPostData,
  ReactionType,
  toggleThreadReaction,
  toggleThreadAcknowledgement,
  togglePinThreadPost,
  deleteThreadPost,
  updateThreadPost,
  logAnonymousRevealAudit,
} from '../actions';
import { ThreadAcknowledgementModal } from './ThreadAcknowledgementModal';
import { ThreadReactionsModal } from './ThreadReactionsModal';
import { RichFormattedText } from './RichFormattedText';
import { PostFormattingToolbar, FormatType } from './PostFormattingToolbar';
import { useToast } from '@/components/Toast';

interface ThreadPostCardProps {
  post: ThreadPostData;
  currentUserProfile: {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
  };
  onOpenComments: (post: ThreadPostData) => void;
  onPostUpdated?: () => void;
}

const REACTION_CONFIG: Array<{ type: ReactionType; label: string; icon: string; activeColor: string }> = [
  { type: 'like', label: 'Like', icon: '👍', activeColor: 'text-blue-600 bg-blue-50 border-blue-200' },
  { type: 'heart', label: 'Heart', icon: '❤️', activeColor: 'text-red-600 bg-red-50 border-red-200' },
  { type: 'pray', label: 'Pray', icon: '🙏', activeColor: 'text-amber-600 bg-amber-50 border-amber-200' },
  { type: 'clap', label: 'Clap', icon: '👏', activeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  { type: 'music', label: 'Music', icon: '🎵', activeColor: 'text-purple-600 bg-purple-50 border-purple-200' },
];

export const ThreadPostCard: React.FC<ThreadPostCardProps> = ({
  post,
  currentUserProfile,
  onOpenComments,
  onPostUpdated,
}) => {
  const [reactions, setReactions] = useState(post.reactions || []);
  const [acknowledgements, setAcknowledgements] = useState(post.acknowledgements || []);
  const [isPinned, setIsPinned] = useState(post.is_pinned);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [showAckModal, setShowAckModal] = useState(false);

  // Post Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editIsAnonymous, setEditIsAnonymous] = useState(post.is_anonymous);
  const [currentContent, setCurrentContent] = useState(post.content);
  const [isAnonymousState, setIsAnonymousState] = useState(post.is_anonymous);
  const [postStatus, setPostStatus] = useState(post.status);
  const [savingEdit, setSavingEdit] = useState(false);
  const [reactionsModalOpen, setReactionsModalOpen] = useState(false);
  const [reactionsModalType, setReactionsModalType] = useState<ReactionType | 'all'>('all');
  const editTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (type: ReactionType) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setReactionsModalType(type);
      setReactionsModalOpen(true);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const { addToast } = useToast();
  const isOfficer = ['super_admin', 'director', 'secretary', 'treasurer'].includes(currentUserProfile.role);
  const isAuthor = post.author_id === currentUserProfile.id;
  const isAcknowledged = acknowledgements.some((a) => a.member_id === currentUserProfile.id);

  const isMinutes = post.category === 'minutes' || currentContent.toUpperCase().includes('MINUTES OF THE MEETING');
  const isAnnouncement = post.category === 'announcement' || isPinned;
  const requiresAcknowledgement = post.requires_acknowledgement || isMinutes || isAnnouncement;

  // Format apply handler for inline edit mode
  const handleApplyEditFormat = (type: FormatType, extra?: string) => {
    const textarea = editTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = editContent.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        replacement = selectedText ? `**${selectedText}**` : '**bold text**';
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'italic':
        replacement = selectedText ? `*${selectedText}*` : '*italic text*';
        cursorOffset = selectedText ? replacement.length : 1;
        break;
      case 'underline':
        replacement = selectedText ? `<u>${selectedText}</u>` : '<u>underlined text</u>';
        cursorOffset = selectedText ? replacement.length : 3;
        break;
      case 'strike':
        replacement = selectedText ? `~~${selectedText}~~` : '~~strikethrough text~~';
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'h1':
        replacement = selectedText ? `\n# ${selectedText}\n` : '\n# Main Heading\n';
        cursorOffset = replacement.length;
        break;
      case 'h2':
        replacement = selectedText ? `\n## ${selectedText}\n` : '\n## Section Heading\n';
        cursorOffset = replacement.length;
        break;
      case 'bullet':
        if (selectedText) {
          replacement = selectedText
            .split('\n')
            .map((line) => (line.startsWith('- ') ? line : `- ${line}`))
            .join('\n');
        } else {
          replacement = '\n- Bullet item\n';
        }
        cursorOffset = replacement.length;
        break;
      case 'numbered':
        if (selectedText) {
          replacement = selectedText
            .split('\n')
            .map((line, i) => `${i + 1}. ${line}`)
            .join('\n');
        } else {
          replacement = '\n1. List item\n';
        }
        cursorOffset = replacement.length;
        break;
      case 'quote':
        replacement = selectedText ? `\n> ${selectedText}\n` : '\n> Important quote or notice\n';
        cursorOffset = replacement.length;
        break;
      case 'hr':
        replacement = '\n---\n';
        cursorOffset = replacement.length;
        break;
      case 'color':
        const col = extra || '#059669';
        replacement = selectedText
          ? `<span style="color:${col}">${selectedText}</span>`
          : `<span style="color:${col}">colored text</span>`;
        cursorOffset = replacement.length;
        break;
      case 'highlight':
        const bg = extra || '#fef08a';
        replacement = selectedText
          ? `<mark style="background:${bg}">${selectedText}</mark>`
          : `<mark style="background:${bg}">highlighted text</mark>`;
        cursorOffset = replacement.length;
        break;
    }

    const newContent = editContent.substring(0, start) + replacement + editContent.substring(end);
    setEditContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 20);
  };

  if (isDeleted) return null;

  // Format relative timestamp
  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) {
      addToast({ type: 'error', title: 'Content Required', message: 'Post content cannot be empty.' });
      return;
    }

    setSavingEdit(true);
    const res = await updateThreadPost({
      postId: post.id,
      content: editContent.trim(),
      is_anonymous: editIsAnonymous,
    });
    setSavingEdit(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Update Failed', message: res.error });
    } else {
      setCurrentContent(editContent.trim());
      setIsAnonymousState(editIsAnonymous);
      setPostStatus('edited');
      setIsEditing(false);
      addToast({ type: 'success', title: 'Post Updated', message: 'Your post was saved.' });
      if (onPostUpdated) onPostUpdated();
    }
  };

  const handleReactionClick = async (reactionType: ReactionType) => {
    const existingIndex = reactions.findIndex(
      (r) => r.member_id === currentUserProfile.id && r.reaction_type === reactionType
    );

    let updatedReactions = [...reactions];
    if (existingIndex >= 0) {
      updatedReactions.splice(existingIndex, 1);
    } else {
      updatedReactions.push({
        id: `temp-${Date.now()}`,
        reaction_type: reactionType,
        member_id: currentUserProfile.id,
      });
    }
    setReactions(updatedReactions);

    const res = await toggleThreadReaction({ postId: post.id, reactionType });
    if (res?.error) {
      setReactions(post.reactions || []);
      addToast({ type: 'error', title: 'Error', message: res.error });
    }
  };

  const handleAcknowledgementClick = async () => {
    const hadAck = isAcknowledged;
    let updatedAcks = [...acknowledgements];

    if (hadAck) {
      updatedAcks = updatedAcks.filter((a) => a.member_id !== currentUserProfile.id);
    } else {
      updatedAcks.push({
        id: `temp-${Date.now()}`,
        member_id: currentUserProfile.id,
        acknowledged_at: new Date().toISOString(),
      });
    }
    setAcknowledgements(updatedAcks);

    const res = await toggleThreadAcknowledgement(post.id);
    if (res?.error) {
      setAcknowledgements(post.acknowledgements || []);
      addToast({ type: 'error', title: 'Error', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: hadAck ? 'Acknowledgement Removed' : '✓ Acknowledged',
        message: hadAck ? 'You unnoted this post.' : 'Marked as seen & noted.',
      });
    }
  };

  const handleTogglePin = async () => {
    setLoadingAction(true);
    const newPinState = !isPinned;
    setIsPinned(newPinState);
    setMenuOpen(false);

    const res = await togglePinThreadPost(post.id, newPinState);
    setLoadingAction(false);

    if (res?.error) {
      setIsPinned(!newPinState);
      addToast({ type: 'error', title: 'Pin Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: newPinState ? '📌 Post Pinned' : 'Post Unpinned',
        message: newPinState ? 'This post is pinned to the top of the feed.' : 'Post unpinned.',
      });
      if (onPostUpdated) onPostUpdated();
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;

    setLoadingAction(true);
    const res = await deleteThreadPost(post.id);
    setLoadingAction(false);
    setMenuOpen(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Delete Failed', message: res.error });
    } else {
      setIsDeleted(true);
      addToast({ type: 'success', title: 'Post Deleted', message: 'Thread removed from feed.' });
      if (onPostUpdated) onPostUpdated();
    }
  };

  // Group reactions by type with reactor names
  const reactionCounts = REACTION_CONFIG.map((config) => {
    const list = reactions.filter((r) => r.reaction_type === config.type);
    const isMine = list.some((r) => r.member_id === currentUserProfile.id);
    const reactorNames = list
      .map((r) => (r.member_id === currentUserProfile.id ? 'You' : r.member?.full_name || 'Choir Member'))
      .filter(Boolean);

    return {
      ...config,
      count: list.length,
      isMine,
      reactors: list,
      reactorNames,
    };
  });


  return (
    <div
      className={`bg-white rounded-3xl p-4 sm:p-5 border transition-all shadow-2xs relative ${
        isPinned
          ? 'border-primary/40 bg-gradient-to-b from-primary/5 to-white shadow-xs'
          : isMinutes
          ? 'border-amber-200/90 bg-gradient-to-b from-amber-50/20 to-white'
          : 'border-slate-200/90'
      }`}
    >
      {/* Official Notice / Meeting Minutes / Pinned Header Banner */}
      {isMinutes ? (
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-amber-900 bg-amber-50/90 border border-amber-200/80 px-3 py-1.5 rounded-2xl mb-3">
          <div className="flex items-center gap-1.5">
            <FileText size={14} className="text-amber-700" />
            <span>📋 Minutes of the Meeting</span>
          </div>
          <button
            type="button"
            onClick={() => setShowAckModal(true)}
            className="text-[0.68rem] text-amber-800 hover:text-amber-950 font-extrabold underline underline-offset-2 inline-flex items-center gap-1 cursor-pointer"
          >
            <Users size={12} />
            <span>{acknowledgements.length} Acknowledged</span>
          </button>
        </div>
      ) : isAnnouncement ? (
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-emerald-900 bg-emerald-50/90 border border-emerald-200/80 px-3 py-1.5 rounded-2xl mb-3">
          <div className="flex items-center gap-1.5">
            <Megaphone size={14} className="text-emerald-700" />
            <span>📢 Official Announcement</span>
          </div>
          {requiresAcknowledgement && (
            <button
              type="button"
              onClick={() => setShowAckModal(true)}
              className="text-[0.68rem] text-emerald-800 hover:text-emerald-950 font-extrabold underline underline-offset-2 inline-flex items-center gap-1 cursor-pointer"
            >
              <Users size={12} />
              <span>{acknowledgements.length} Confirmed</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Post Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar or Anonymous Badge */}
          {isAnonymousState && !isOfficer ? (
            <div className="w-10 h-10 rounded-full bg-slate-800 text-amber-300 flex items-center justify-center shrink-0 border border-slate-700 shadow-xs">
              <Lock size={18} />
            </div>
          ) : (
            <Link
              href={post.author?.id === currentUserProfile.id ? '/profile' : `/directory/${post.author?.id || post.author_id}`}
              className="hover:opacity-85 transition-opacity shrink-0 cursor-pointer"
            >
              <Avatar
                src={post.author?.avatar_url}
                name={post.author?.full_name || 'Member'}
                size={40}
                className="border border-slate-200"
              />
            </Link>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isAnonymousState && !isOfficer ? (
                <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                  Anonymous Member
                </span>
              ) : (
                <Link
                  href={post.author?.id === currentUserProfile.id ? '/profile' : `/directory/${post.author?.id || post.author_id}`}
                  className="font-bold text-slate-900 text-xs sm:text-sm truncate hover:text-primary hover:underline transition-colors cursor-pointer"
                >
                  {post.author?.full_name}
                </Link>
              )}

              {post.author?.voice_part && (
                <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[0.65rem] font-bold bg-primary/10 text-primary">
                  {post.author.voice_part}
                </span>
              )}

              {isAnonymousState && (
                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[0.65rem] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  <Lock size={10} /> Anonymous
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[0.68rem] text-slate-400 mt-0.5">
              <span>{formatTimestamp(post.created_at)}</span>
              {postStatus === 'edited' && (
                <>
                  <span>•</span>
                  <span className="text-slate-400 font-medium">Edited</span>
                </>
              )}
              <span>•</span>
              <span className="capitalize">{post.author?.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Action Menu (Edit, Pin, Delete) */}
        {(isAuthor || isOfficer) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-20 animate-in fade-in-50 zoom-in-95">
                {isAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(true);
                      setEditContent(currentContent);
                      setEditIsAnonymous(isAnonymousState);
                      setMenuOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Pencil size={14} className="text-slate-400" />
                    <span>Edit Post</span>
                  </button>
                )}

                {isOfficer && (
                  <button
                    type="button"
                    onClick={handleTogglePin}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Pin size={14} className={isPinned ? 'text-primary fill-primary' : 'text-slate-400'} />
                    <span>{isPinned ? 'Unpin Post' : 'Pin to Top'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDeletePost}
                  className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>{isAuthor ? 'Delete Post' : 'Moderate (Delete)'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Officer Anonymous Reveal Banner */}
      {isAnonymousState && isOfficer && (
        <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[0.72rem] flex items-center gap-2">
          <ShieldAlert size={14} className="shrink-0 text-amber-700" />
          <span>
            <strong>🔒 Officer Visibility:</strong> Real author identity (<strong>{post.author?.full_name}</strong>) is visible only to officers. Regular choristers see &quot;Anonymous Member&quot;.
          </span>
        </div>
      )}

      {/* Post Content or Inline Edit Box */}
      {isEditing ? (
        <div className="mb-3.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col gap-2 animate-in fade-in">
          <PostFormattingToolbar onApplyFormat={handleApplyEditFormat} className="bg-white" />
          <textarea
            ref={editTextareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={4}
            placeholder="Edit your post…"
            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-primary resize-y min-h-[90px]"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() => setEditIsAnonymous(!editIsAnonymous)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                editIsAnonymous
                  ? 'bg-slate-900 text-amber-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Lock size={11} />
              <span>{editIsAnonymous ? 'Anonymous' : 'Public to Choir'}</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={savingEdit}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit || !editContent.trim()}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        currentContent && (
          <div className="mb-3">
            <RichFormattedText content={currentContent} />
          </div>
        )
      )}

      {/* Attached Media Gallery */}
      {post.media && post.media.length > 0 && (
        <div
          className={`grid gap-2 mb-3.5 rounded-2xl overflow-hidden ${
            post.media.length === 1 ? 'grid-cols-1' : post.media.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {post.media.map((m, idx) => (
            <div
              key={idx}
              className="relative aspect-video sm:aspect-square bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-2xs group"
            >
              <img
                src={m.url}
                alt="attachment"
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                loading="lazy"
              />
              {m.media_type === 'gif' && (
                <span className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-xs text-white text-[0.6rem] font-black px-1.5 py-0.2 rounded-md uppercase">
                  GIF
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Interaction Bar */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 flex-wrap">
        {/* Left: 5 Reaction Buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {reactionCounts.map((r) => (
            <div className="relative group/react" key={r.type}>
              <button
                type="button"
                onClick={() => handleReactionClick(r.type)}
                onTouchStart={() => handleTouchStart(r.type)}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onContextMenu={(e) => {
                  if (r.count > 0) {
                    e.preventDefault();
                    setReactionsModalType(r.type);
                    setReactionsModalOpen(true);
                  }
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-1 cursor-pointer active:scale-95 ${
                  r.isMine
                    ? r.activeColor
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title={
                  r.count > 0
                    ? `${r.label} (${r.count}) — Long press or hover to see who reacted`
                    : `React with ${r.label}`
                }
              >
                <span className="text-xs">{r.icon}</span>
                {r.count > 0 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setReactionsModalType(r.type);
                      setReactionsModalOpen(true);
                    }}
                    className="text-[0.68rem] hover:underline cursor-pointer"
                  >
                    {r.count}
                  </span>
                )}
              </button>

              {/* Desktop Hover Tooltip */}
              {r.count > 0 && (
                <div className="hidden sm:group-hover/react:flex absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 bg-slate-900/95 text-white text-[0.7rem] rounded-xl shadow-xl pointer-events-none z-30 whitespace-nowrap flex-col gap-0.5 animate-in fade-in-50 zoom-in-95">
                  <div className="font-bold flex items-center gap-1 text-amber-300">
                    <span>{r.icon}</span>
                    <span>
                      {r.label} ({r.count})
                    </span>
                  </div>
                  <div className="text-slate-200 text-[0.68rem] max-w-[200px] truncate leading-tight">
                    {r.reactorNames.slice(0, 5).join(', ')}
                    {r.reactorNames.length > 5 ? ` +${r.reactorNames.length - 5} more` : ''}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: Acknowledge & Comments Triggers */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Acknowledge Button */}
          <div className="inline-flex items-center">
            <button
              type="button"
              onClick={handleAcknowledgementClick}
              className={`px-2.5 py-1 rounded-l-xl text-xs font-bold border transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                isAcknowledged
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              } ${acknowledgements.length === 0 ? 'rounded-r-xl' : 'border-r-0'}`}
              title={isAcknowledged ? 'You acknowledged this notice' : 'Click to acknowledge you noted this'}
            >
              <CheckCircle2 size={13} className={isAcknowledged ? 'text-emerald-700' : 'text-slate-400'} />
              <span>{isAcknowledged ? 'Noted' : 'Acknowledge'}</span>
            </button>

            {acknowledgements.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAckModal(true)}
                className={`px-2 py-1 rounded-r-xl text-xs font-mono font-bold border transition-all cursor-pointer hover:bg-emerald-100 ${
                  isAcknowledged
                    ? 'bg-emerald-100/70 text-emerald-900 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="View who acknowledged this post"
              >
                {acknowledgements.length}
              </button>
            )}
          </div>

          {/* Comments Toggle */}
          <button
            type="button"
            onClick={() => onOpenComments(post)}
            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare size={13} className="text-slate-500" />
            <span>{post.comments_count > 0 ? `${post.comments_count}` : 'Comment'}</span>
          </button>
        </div>
      </div>

      {/* Acknowledgement Section Roster Modal */}
      <ThreadAcknowledgementModal
        isOpen={showAckModal}
        postId={post.id}
        isOfficer={isOfficer}
        onClose={() => setShowAckModal(false)}
      />

      {/* Reactions Detail Modal (Desktop click or Mobile Long-press) */}
      <ThreadReactionsModal
        isOpen={reactionsModalOpen}
        reactions={(reactions || []) as any}
        currentUserId={currentUserProfile.id}
        initialType={reactionsModalType}
        onClose={() => setReactionsModalOpen(false)}
      />
    </div>
  );
};

