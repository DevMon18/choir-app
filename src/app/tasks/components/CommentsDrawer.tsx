'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, MessageSquare, Clock, History, Shield, User, Sparkles } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { addAssignmentComment, getAssignmentComments, getAssignmentHistory } from '../actions';
import { useToast } from '@/components/Toast';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import type { TaskCommentItem, TaskAssignmentHistoryItem } from '../types';

interface CommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  taskTitle: string;
  responsibility: string;
  initialComments: TaskCommentItem[];
  initialHistory: TaskAssignmentHistoryItem[];
  currentUserId: string;
}

export const CommentsDrawer: React.FC<CommentsDrawerProps> = ({
  isOpen,
  onClose,
  assignmentId,
  taskTitle,
  responsibility,
  initialComments,
  initialHistory,
  currentUserId,
}) => {
  const [mounted, setMounted] = useState(false);
  const [comments, setComments] = useState<TaskCommentItem[]>(initialComments || []);
  const [history, setHistory] = useState<TaskAssignmentHistoryItem[]>(initialHistory || []);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>('comments');
  const { addToast } = useToast();
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setComments(initialComments || []);
  }, [initialComments]);

  useEffect(() => {
    setHistory(initialHistory || []);
  }, [initialHistory]);

  const refreshDrawerData = async () => {
    const [freshComments, freshHistory] = await Promise.all([
      getAssignmentComments(assignmentId),
      getAssignmentHistory(assignmentId),
    ]);
    setComments(freshComments);
    setHistory(freshHistory);
  };

  // Realtime subscription for this task assignment's comments & history
  useRealtimeSync({
    channelName: `comments-sync-${assignmentId}`,
    enabled: isOpen,
    tables: [
      { table: 'task_comments' },
      { table: 'task_assignment_history' },
      { table: 'task_assignments' },
    ],
    onEvent: () => {
      refreshDrawerData();
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Push history state for back-gesture handling
    window.history.pushState({ modalOpen: 'comments' }, '');
    const handlePopState = () => {
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (activeTab === 'comments' && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, activeTab]);

  if (!isOpen || !mounted) return null;

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    const res = await addAssignmentComment(assignmentId, newComment.trim());
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Failed to comment', message: res.error });
    } else if (res.comment) {
      setComments((prev) => [...prev, res.comment!]);
      setNewComment('');
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] h-full max-h-[88vh] bg-white rounded-3xl border border-primary/16 shadow-2xl flex flex-col overflow-hidden animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-4.5 px-6 border-b border-primary/10 flex items-start justify-between bg-gradient-to-br from-amber-50/40 to-amber-100/30 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10.5 h-10.5 rounded-xl bg-gradient-to-br from-primary to-emerald-700 text-white flex items-center justify-center shadow-md flex-shrink-0">
              <MessageSquare size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[0.72rem] font-bold uppercase tracking-wider text-primary bg-primary/8 py-0.5 px-1.5 rounded">
                  Task: {taskTitle}
                </span>
              </div>
              <h3 className="text-lg font-extrabold m-0 text-foreground truncate">
                {responsibility}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-8.5 !h-8.5 !p-0 !rounded-full !min-h-0 border border-primary/12 bg-white text-muted flex items-center justify-center cursor-pointer flex-shrink-0"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle Segmented Bar */}
        <div className="flex border-b border-primary/8 py-2.5 px-5 bg-amber-50/30 gap-2">
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold cursor-pointer border inline-flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'comments'
                ? 'border-primary bg-primary text-white shadow-md'
                : 'border-primary/10 bg-white text-muted hover:bg-black/5'
            }`}
          >
            <MessageSquare size={15} /> Discussion ({comments.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold cursor-pointer border inline-flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'border-primary bg-primary text-white shadow-md'
                : 'border-primary/10 bg-white text-muted hover:bg-black/5'
            }`}
          >
            <History size={15} /> Audit Trail ({history.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-3 bg-white">
          {activeTab === 'comments' ? (
            comments.length === 0 ? (
              <div className="my-auto py-9 px-5 text-center bg-amber-50/30 rounded-2xl border border-dashed border-primary/16">
                <div className="w-12 h-12 rounded-full bg-primary/8 text-primary flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={22} />
                </div>
                <h4 className="text-base font-extrabold text-foreground m-0 mb-1">
                  No messages yet
                </h4>
                <p className="text-sm text-muted max-w-[320px] mx-auto">
                  Ask questions, post updates, or clarify details with the Choir Director.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {comments.map((c) => {
                  const isMe = c.author_id === currentUserId;
                  const isDirector = ['super_admin', 'director'].includes(c.author?.role || '');

                  return (
                    <div
                      key={c.id}
                      className={`flex gap-2.5 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <Avatar
                        src={c.author?.avatar_url}
                        name={c.author?.full_name}
                        size="sm"
                        border
                      />
                      <div
                        className={`max-w-[82%] p-3 sm:py-3 sm:px-3.5 ${
                          isMe
                            ? 'bg-gradient-to-br from-primary to-emerald-700 text-white rounded-2xl rounded-br-sm shadow-sm'
                            : 'bg-amber-50/40 text-foreground rounded-2xl rounded-bl-sm border border-primary/10 shadow-xs'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 mb-1 ${isMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <strong className={`text-xs ${isMe ? 'text-white' : 'text-foreground'}`}>
                            {isMe ? 'You' : c.author?.full_name || 'Member'}
                          </strong>
                          {isDirector && (
                            <span
                              className={`text-[0.68rem] py-0.25 px-1.25 rounded font-bold ${
                                isMe ? 'bg-white/20 text-white' : 'bg-accent/20 text-accent'
                              }`}
                            >
                              Director
                            </span>
                          )}
                          <span
                            className={`text-[0.7rem] ${isMe ? 'text-white/75' : 'text-muted'}`}
                          >
                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p
                          className={`m-0 text-sm break-words leading-relaxed ${isMe ? 'text-white' : 'text-foreground'}`}
                        >
                          {c.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={commentsEndRef} />
              </div>
            )
          ) : (
            history.length === 0 ? (
              <div className="my-auto py-9 px-5 text-center bg-amber-50/30 rounded-2xl border border-dashed border-primary/16">
                <div className="w-12 h-12 rounded-full bg-primary/8 text-primary flex items-center justify-center mx-auto mb-3">
                  <Clock size={22} />
                </div>
                <h4 className="text-base font-extrabold text-foreground m-0 mb-1">
                  No history records yet
                </h4>
                <p className="text-sm text-muted m-0">
                  Actions and status updates will be timestamped here.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="flex gap-3 py-3 px-3.5 rounded-xl bg-amber-50/30 border border-primary/10 items-start"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/8 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <History size={15} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-foreground">
                        {h.action}
                      </div>
                      {h.note && (
                        <div className="text-xs text-muted mt-0.5 italic">
                          &ldquo;{h.note}&rdquo;
                        </div>
                      )}
                      <span className="text-xs text-muted mt-1 block font-medium">
                        {new Date(h.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Comment Input Footer */}
        {activeTab === 'comments' && (
          <form
            onSubmit={handleSendComment}
            className="py-3.5 px-5 border-t border-primary/10 flex gap-2.5 items-center bg-gradient-to-br from-amber-50/40 to-amber-100/30"
          >
            <input
              type="text"
              className="input-field flex-1 py-2.75 px-4 rounded-full text-sm bg-white border-[1.5px] border-primary/18 text-foreground"
              placeholder="Write a message or update..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary !px-5 !rounded-full !min-h-[44px] inline-flex items-center justify-center gap-1.5 font-bold shadow-md"
              disabled={loading || !newComment.trim()}
              aria-label="Send comment"
            >
              <Send size={15} />
              <span>Send</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
