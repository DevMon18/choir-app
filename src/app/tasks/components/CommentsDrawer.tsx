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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          maxHeight: '88vh',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(11, 77, 36, 0.16)',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(11, 77, 36, 0.1)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #fbfaf6 0%, #f4efe4 100%)',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(11, 77, 36, 0.2)',
                flexShrink: 0,
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--primary)',
                    background: 'rgba(11, 77, 36, 0.08)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  Task: {taskTitle}
                </span>
              </div>
              <h3
                style={{
                  fontSize: '1.12rem',
                  fontWeight: 800,
                  margin: 0,
                  color: '#111c14',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {responsibility}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: '50%',
              minHeight: 'auto',
              border: '1px solid rgba(11, 77, 36, 0.12)',
              background: '#ffffff',
              color: '#5c675e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Toggle Segmented Bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(11, 77, 36, 0.08)',
            padding: '10px 20px',
            background: '#faf8f3',
            gap: '8px',
          }}
        >
          <button
            onClick={() => setActiveTab('comments')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === 'comments' ? 'var(--primary)' : 'rgba(11, 77, 36, 0.1)',
              background: activeTab === 'comments' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'comments' ? '#ffffff' : '#5c675e',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'comments' ? '0 3px 10px rgba(11, 77, 36, 0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <MessageSquare size={15} /> Discussion ({comments.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: activeTab === 'history' ? 'var(--primary)' : 'rgba(11, 77, 36, 0.1)',
              background: activeTab === 'history' ? 'var(--primary)' : '#ffffff',
              color: activeTab === 'history' ? '#ffffff' : '#5c675e',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxShadow: activeTab === 'history' ? '0 3px 10px rgba(11, 77, 36, 0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <History size={15} /> Audit Trail ({history.length})
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            background: '#ffffff',
          }}
        >
          {activeTab === 'comments' ? (
            comments.length === 0 ? (
              <div
                style={{
                  margin: 'auto 0',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: '#faf8f3',
                  borderRadius: '18px',
                  border: '1px dashed rgba(11, 77, 36, 0.16)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(11, 77, 36, 0.08)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <MessageSquare size={22} />
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#111c14', margin: '0 0 4px' }}>
                  No messages yet
                </h4>
                <p style={{ fontSize: '0.84rem', color: '#5c675e', maxWidth: '320px', margin: '0 auto' }}>
                  Ask questions, post updates, or clarify details with the Choir Director.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {comments.map((c) => {
                  const isMe = c.author_id === currentUserId;
                  const isDirector = ['super_admin', 'director'].includes(c.author?.role || '');

                  return (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'flex-start',
                        flexDirection: isMe ? 'row-reverse' : 'row',
                      }}
                    >
                      <Avatar
                        src={c.author?.avatar_url}
                        name={c.author?.full_name}
                        size="sm"
                        border
                      />
                      <div
                        style={{
                          maxWidth: '82%',
                          background: isMe
                            ? 'linear-gradient(135deg, var(--primary) 0%, #15803d 100%)'
                            : '#faf8f3',
                          color: isMe ? '#ffffff' : '#111c14',
                          padding: '12px 14px',
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          border: isMe ? 'none' : '1px solid rgba(11, 77, 36, 0.1)',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '4px',
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <strong style={{ fontSize: '0.82rem', color: isMe ? '#ffffff' : '#111c14' }}>
                            {isMe ? 'You' : c.author?.full_name || 'Member'}
                          </strong>
                          {isDirector && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(197, 160, 89, 0.2)',
                                color: isMe ? '#ffffff' : 'var(--accent)',
                                fontWeight: 700,
                              }}
                            >
                              Director
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: isMe ? 'rgba(255,255,255,0.75)' : '#5c675e',
                            }}
                          >
                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.88rem',
                            wordBreak: 'break-word',
                            lineHeight: 1.45,
                            color: isMe ? '#ffffff' : '#111c14',
                          }}
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
              <div
                style={{
                  margin: 'auto 0',
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: '#faf8f3',
                  borderRadius: '18px',
                  border: '1px dashed rgba(11, 77, 36, 0.16)',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(11, 77, 36, 0.08)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <Clock size={22} />
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#111c14', margin: '0 0 4px' }}>
                  No history records yet
                </h4>
                <p style={{ fontSize: '0.84rem', color: '#5c675e', margin: 0 }}>
                  Actions and status updates will be timestamped here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: '#faf8f3',
                      border: '1px solid rgba(11, 77, 36, 0.1)',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: 'rgba(11, 77, 36, 0.08)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    >
                      <History size={15} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#111c14' }}>
                        {h.action}
                      </div>
                      {h.note && (
                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: '#5c675e',
                            marginTop: '2px',
                            fontStyle: 'italic',
                          }}
                        >
                          &ldquo;{h.note}&rdquo;
                        </div>
                      )}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#5c675e',
                          marginTop: '4px',
                          display: 'block',
                          fontWeight: 500,
                        }}
                      >
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
            style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(11, 77, 36, 0.1)',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              background: 'linear-gradient(135deg, #fbfaf6 0%, #f4efe4 100%)',
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="Write a message or update..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              style={{
                flex: 1,
                padding: '11px 16px',
                borderRadius: '24px',
                fontSize: '0.9rem',
                background: '#ffffff',
                border: '1.5px solid rgba(11, 77, 36, 0.18)',
                color: '#111c14',
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !newComment.trim()}
              style={{
                padding: '0 20px',
                borderRadius: '24px',
                minHeight: '44px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(11, 77, 36, 0.25)',
              }}
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
