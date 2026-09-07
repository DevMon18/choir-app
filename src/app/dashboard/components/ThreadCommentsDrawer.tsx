'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  MessageSquare,
  Lock,
  Trash2,
  Sparkles,
  Image as ImageIcon,
  Loader2,
  ShieldAlert,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import {
  ThreadPostData,
  ThreadCommentData,
  ThreadMediaItem,
  getThreadComments,
  createThreadComment,
  deleteThreadComment,
} from '../actions';
import { GifPickerModal } from './GifPickerModal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

interface ThreadCommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  post: ThreadPostData | null;
  currentUserProfile: {
    id: string;
    full_name: string;
    role: string;
    avatar_url?: string | null;
  };
  onCommentCountChange?: (postId: string, newCount: number) => void;
}

export const ThreadCommentsDrawer: React.FC<ThreadCommentsDrawerProps> = ({
  isOpen,
  onClose,
  post,
  currentUserProfile,
  onCommentCountChange,
}) => {
  const [mounted, setMounted] = useState(false);
  const [comments, setComments] = useState<ThreadCommentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [mediaList, setMediaList] = useState<ThreadMediaItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<ThreadCommentData | null>(null);

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { addToast } = useToast();

  const isOfficer = ['super_admin', 'director', 'secretary', 'treasurer'].includes(
    currentUserProfile.role
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadComments = async (postId: string) => {
    setLoading(true);
    const res = await getThreadComments(postId);
    setLoading(false);
    if (!res.error && res.data) {
      setComments(res.data);
      if (onCommentCountChange) onCommentCountChange(postId, res.data.length);
    }
  };

  useEffect(() => {
    if (isOpen && post) {
      loadComments(post.id);
      setNewComment('');
      setMediaList([]);
      setIsAnonymous(false);
      setReplyingToComment(null);
    }
  }, [isOpen, post?.id]);

  // Realtime subscription for comments
  useRealtimeSync({
    channelName: `thread-comments-${post?.id}`,
    enabled: isOpen && !!post?.id,
    tables: [{ table: 'thread_comments', filter: `post_id=eq.${post?.id}` }],
    onEvent: () => {
      if (post?.id) loadComments(post.id);
    },
  });

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Format relative timestamp
  const formatCommentTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Group comments into Facebook-style hierarchical threads
  const commentThreads = useMemo(() => {
    const rootComments: ThreadCommentData[] = [];
    const replyMap = new Map<string, ThreadCommentData[]>();

    // First pass: identify root comments and initial replies
    comments.forEach((c) => {
      if (!c.parent_comment_id) {
        rootComments.push(c);
      } else {
        const list = replyMap.get(c.parent_comment_id) || [];
        list.push(c);
        replyMap.set(c.parent_comment_id, list);
      }
    });

    // Secondary pass: if any reply was made to a child reply, flatten to root thread
    const finalTree = rootComments.map((root) => {
      const allReplies: ThreadCommentData[] = [];
      const collectReplies = (parentId: string) => {
        const directReplies = replyMap.get(parentId) || [];
        directReplies.forEach((r) => {
          allReplies.push(r);
          collectReplies(r.id);
        });
      };
      collectReplies(root.id);

      // Sort chronological
      allReplies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      return {
        root,
        replies: allReplies,
      };
    });

    return finalTree;
  }, [comments]);

  const handleReplyClick = (targetComment: ThreadCommentData) => {
    setReplyingToComment(targetComment);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast({ type: 'error', title: 'File Too Large', message: 'Image should be under 5MB.' });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserProfile.id}-${Date.now()}.${fileExt}`;
      const filePath = `comments/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('thread-media')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('thread-media')
        .getPublicUrl(filePath);

      setMediaList((prev) => [...prev, { media_type: 'image', url: publicUrl }]);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Upload Failed', message: err.message || 'Failed to upload photo.' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!post || (!newComment.trim() && mediaList.length === 0)) return;

    setSubmitting(true);
    const res = await createThreadComment({
      postId: post.id,
      parentCommentId: replyingToComment?.id || null,
      content: newComment.trim(),
      is_anonymous: isAnonymous,
      media: mediaList,
    });
    setSubmitting(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Comment Failed', message: res.error });
    } else {
      setNewComment('');
      setMediaList([]);
      setIsAnonymous(false);
      setReplyingToComment(null);
      await loadComments(post.id);
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    const res = await deleteThreadComment(commentId);
    if (res?.error) {
      addToast({ type: 'error', title: 'Error', message: res.error });
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      if (post && onCommentCountChange) onCommentCountChange(post.id, Math.max(0, comments.length - 1));
      addToast({ type: 'success', title: 'Comment Deleted', message: 'Comment removed.' });
    }
  };

  if (!mounted || !isOpen || !post) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet / Desktop Modal Dialog */}
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[88vh] h-[85vh] sm:h-[80vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-250 z-10">
        {/* Mobile Pull Handle Indicator */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden bg-slate-50/70 shrink-0">
          <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <MessageSquare size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate tracking-tight">
                Comments
              </h3>
              <span className="text-[0.68rem] text-slate-500 block truncate">
                Thread by {post.author?.full_name || 'Member'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Original Post Preview Snippet */}
        <div className="p-3 bg-slate-50 border-b border-slate-100/80 text-xs text-slate-700 shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-slate-900">{post.author?.full_name}</span>
            {post.is_anonymous && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md text-[0.6rem] font-bold bg-slate-200 text-slate-700">
                <Lock size={9} /> Anon
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-slate-600 font-medium text-[0.75rem]">{post.content}</p>
        </div>

        {/* Comments Feed (Facebook-style Nested Threading) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar overscroll-contain">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 font-medium flex flex-col items-center gap-2">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span>Loading comments…</span>
            </div>
          ) : commentThreads.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <MessageSquare size={28} className="text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-semibold">No comments yet.</span>
              <span className="text-[0.72rem] text-slate-400">
                Be the first to share your thoughts or encouragement!
              </span>
            </div>
          ) : (
            commentThreads.map(({ root, replies }) => {
              const isRootAuthor = root.author_id === currentUserProfile.id;

              return (
                <div key={root.id} className="relative">
                  {/* Vertical branch line connecting root to its replies */}
                  {replies.length > 0 && (
                    <div className="absolute left-[15px] top-9 bottom-3 w-[1.5px] bg-slate-200" />
                  )}

                  {/* Root Comment Row */}
                  <div className="flex items-start gap-2.5 relative">
                    {/* Avatar */}
                    {root.is_anonymous && !isOfficer ? (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-300 flex items-center justify-center shrink-0 border border-slate-700 shadow-2xs z-10">
                        <Lock size={13} />
                      </div>
                    ) : (
                      <div className="z-10 shrink-0">
                        <Avatar
                          src={root.author?.avatar_url}
                          name={root.author?.full_name || 'Member'}
                          size={32}
                        />
                      </div>
                    )}

                    {/* Content & Speech Bubble */}
                    <div className="flex-1 min-w-0">
                      <div className="bg-slate-100/90 hover:bg-slate-100 rounded-2xl px-3.5 py-2 inline-block max-w-full text-slate-800 transition-colors">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className="font-bold text-slate-900 text-xs">
                            {root.author?.full_name}
                          </span>
                          {root.author?.voice_part && (
                            <span className="text-[0.6rem] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded-full">
                              {root.author.voice_part}
                            </span>
                          )}
                          {root.is_anonymous && (
                            <span className="text-[0.6rem] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full inline-flex items-center gap-0.5">
                              <Lock size={8} /> Anon
                            </span>
                          )}
                        </div>

                        {/* Officer Anonymity Banner */}
                        {root.is_anonymous && isOfficer && (
                          <div className="text-[0.62rem] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 my-1 flex items-center gap-1 font-semibold">
                            <ShieldAlert size={10} />
                            <span>Author visible only to officers.</span>
                          </div>
                        )}

                        <p className="text-xs text-slate-800 font-normal leading-relaxed whitespace-pre-wrap break-words">
                          {root.content}
                        </p>

                        {/* Media */}
                        {root.media && root.media.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {root.media.map((m, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl overflow-hidden max-w-[200px] max-h-[160px] bg-slate-200 border border-slate-200 shrink-0"
                              >
                                <img
                                  src={m.url}
                                  alt="media"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action Line below bubble */}
                      <div className="flex items-center gap-3.5 px-2 mt-1 text-[0.68rem] text-slate-500 font-semibold">
                        <span>{formatCommentTime(root.created_at)}</span>
                        <button
                          type="button"
                          onClick={() => handleReplyClick(root)}
                          className="hover:text-primary transition-colors cursor-pointer"
                        >
                          Reply
                        </button>
                        {(isRootAuthor || isOfficer) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(root.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nested Replies Branch */}
                  {replies.length > 0 && (
                    <div className="space-y-3 mt-2.5">
                      {replies.map((reply) => {
                        const isReplyAuthor = reply.author_id === currentUserProfile.id;
                        return (
                          <div key={reply.id} className="ml-8 sm:ml-9 relative flex items-start gap-2 pt-1">
                            {/* Branch connector curve */}
                            <div className="absolute -left-[17px] top-3 w-4 h-3.5 border-l-2 border-b-2 border-slate-200 rounded-bl-xl pointer-events-none" />

                            {/* Reply Avatar */}
                            {reply.is_anonymous && !isOfficer ? (
                              <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-300 flex items-center justify-center shrink-0 border border-slate-700 shadow-2xs z-10">
                                <Lock size={10} />
                              </div>
                            ) : (
                              <div className="z-10 shrink-0">
                                <Avatar
                                  src={reply.author?.avatar_url}
                                  name={reply.author?.full_name || 'Member'}
                                  size={24}
                                />
                              </div>
                            )}

                            {/* Reply Bubble */}
                            <div className="flex-1 min-w-0">
                              <div className="bg-slate-100/80 hover:bg-slate-100 rounded-2xl px-3 py-1.5 inline-block max-w-full text-slate-800 transition-colors">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                  <span className="font-bold text-slate-900 text-xs">
                                    {reply.author?.full_name}
                                  </span>
                                  {reply.author?.voice_part && (
                                    <span className="text-[0.58rem] font-bold text-primary bg-primary/10 px-1.5 py-0.2 rounded-full">
                                      {reply.author.voice_part}
                                    </span>
                                  )}
                                  {reply.is_anonymous && (
                                    <span className="text-[0.58rem] font-bold px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full inline-flex items-center gap-0.5">
                                      <Lock size={7} /> Anon
                                    </span>
                                  )}
                                </div>

                                {reply.is_anonymous && isOfficer && (
                                  <div className="text-[0.6rem] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 my-0.5 flex items-center gap-1 font-semibold">
                                    <ShieldAlert size={9} />
                                    <span>Author visible only to officers.</span>
                                  </div>
                                )}

                                <p className="text-xs text-slate-800 font-normal leading-relaxed whitespace-pre-wrap break-words">
                                  {reply.content}
                                </p>

                                {reply.media && reply.media.length > 0 && (
                                  <div className="flex gap-2 mt-1.5 flex-wrap">
                                    {reply.media.map((m, idx) => (
                                      <div
                                        key={idx}
                                        className="rounded-xl overflow-hidden max-w-[160px] max-h-[120px] bg-slate-200 border border-slate-200 shrink-0"
                                      >
                                        <img
                                          src={m.url}
                                          alt="media"
                                          className="w-full h-full object-cover"
                                          loading="lazy"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Action Line below reply */}
                              <div className="flex items-center gap-3.5 px-2 mt-0.5 text-[0.65rem] text-slate-500 font-semibold">
                                <span>{formatCommentTime(reply.created_at)}</span>
                                <button
                                  type="button"
                                  onClick={() => handleReplyClick(root)}
                                  className="hover:text-primary transition-colors cursor-pointer"
                                >
                                  Reply
                                </button>
                                {(isReplyAuthor || isOfficer) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(reply.id)}
                                    className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Comment Compose Box Footer */}
        <div className="p-3 sm:p-3.5 border-t border-slate-100 bg-white shrink-0">
          {/* Replying To banner */}
          {replyingToComment && (
            <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 mb-2 text-xs text-primary font-semibold animate-in fade-in slide-in-from-bottom-1">
              <span className="flex items-center gap-1.5 truncate">
                <CornerDownRight size={12} className="shrink-0" />
                Replying to <strong>{replyingToComment.author?.full_name || 'Member'}</strong>
              </span>
              <button
                type="button"
                onClick={() => setReplyingToComment(null)}
                className="p-1 text-primary/70 hover:text-primary rounded-full hover:bg-primary/10 cursor-pointer ml-2"
                title="Cancel reply"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Media Attachment Preview */}
          {mediaList.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar py-1">
              {mediaList.map((m, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl overflow-hidden border border-slate-200 w-16 h-16 bg-slate-100 shrink-0"
                >
                  <img src={m.url} alt="attach" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setMediaList((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-white hover:bg-red-600 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleAddComment} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={
                  replyingToComment
                    ? `Reply to ${replyingToComment.author?.full_name || 'Member'}…`
                    : isAnonymous
                    ? 'Write an anonymous comment…'
                    : 'Write a comment…'
                }
                className="flex-1 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white focus:border-primary transition-all"
              />

              <button
                type="submit"
                disabled={submitting || (!newComment.trim() && mediaList.length === 0)}
                className="p-2 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors cursor-pointer shrink-0 shadow-2xs"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>

            {/* Toggles (Anonymous, Photo, GIF) */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Attach Photo"
                >
                  <ImageIcon size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => setShowGifModal(true)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Attach GIF"
                >
                  <Sparkles size={15} className="text-purple-600" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.68rem] font-bold transition-all cursor-pointer ${
                  isAnonymous
                    ? 'bg-slate-900 text-amber-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Lock size={10} />
                <span>{isAnonymous ? 'Anon Active' : 'Post as Yourself'}</span>
              </button>
            </div>
          </form>
        </div>

      </div>

      <GifPickerModal
        isOpen={showGifModal}
        onClose={() => setShowGifModal(false)}
        onSelectGif={(url) => setMediaList((prev) => [...prev, { media_type: 'gif', url }])}
      />
    </div>,
    document.body
  );
};

