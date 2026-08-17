'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import type { MessageItem, MessageReaction } from '../actions';
import {
  sendMessage,
  markMessagesAsRead,
  deleteConversation,
  deleteMessage,
  toggleReactionAction,
} from '../actions';
import {
  parseStoredMessage,
  formatMessageTimestamp,
  getDateSeparatorLabel,
  type ReplySnippet,
} from '../utils';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import {
  ArrowLeft,
  Send,
  Trash2,
  AlertCircle,
  Check,
  CheckCheck,
  Smile,
  Reply,
  MoreVertical,
  X,
  Copy,
} from 'lucide-react';

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

interface OtherUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  voice_part: string | null;
  role: string;
  isDeletedUser?: boolean;
}

interface Props {
  currentUserProfile: { id: string; full_name: string; role: string };
  conversationId: string;
  initialMessages: MessageItem[];
  otherUser: OtherUser;
  currentUserId: string;
}

export const ChatClient: React.FC<Props> = ({
  currentUserProfile,
  conversationId,
  initialMessages,
  otherUser,
  currentUserId,
}) => {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);

  const [activeReply, setActiveReply] = useState<ReplySnippet | null>(null);
  const [openReactionMenuId, setOpenReactionMenuId] = useState<string | null>(null);
  const [openMoreMenuId, setOpenMoreMenuId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwipingHorizontally = useRef<boolean>(false);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const scrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(msgId);
      setTimeout(() => setHighlightedMessageId(null), 1800);
    } else {
      addToast({ type: 'info', title: 'Original Message', message: 'The original message was earlier in history or removed.' });
    }
  };

  const markAsReadClient = useCallback(async () => {
    try {
      await markMessagesAsRead(conversationId);
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);
    } catch {
    }
  }, [conversationId, currentUserId, supabase]);

  useEffect(() => {
    scrollToBottom(false);
    markAsReadClient();

    const handleFocus = () => markAsReadClient();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [conversationId, markAsReadClient]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenReactionMenuId(null);
      setOpenMoreMenuId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    const channelName = `messages-${conversationId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const rawMsg = payload.new as any;
          const { cleanBody, replySnippet } = parseStoredMessage(rawMsg);
          const newMsg: MessageItem = {
            ...rawMsg,
            body: cleanBody,
            reply_snippet: replySnippet || rawMsg.reply_snippet || null,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            const tempIndex = prev.findIndex(
              (m) =>
                m.id.startsWith('temp-') &&
                m.sender_id === newMsg.sender_id &&
                m.body === newMsg.body
            );

            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = {
                ...newMsg,
                reply_to_id: newMsg.reply_to_id || updated[tempIndex].reply_to_id || null,
                reply_snippet: newMsg.reply_snippet || updated[tempIndex].reply_snippet || null,
                reactions: updated[tempIndex].reactions || [],
              };
              return updated;
            }

            // Lookup reply_snippet from existing messages if missing in realtime payload
            let enrichedNewMsg = { ...newMsg, reactions: [] };
            if (!enrichedNewMsg.reply_snippet && enrichedNewMsg.reply_to_id) {
              const parent = prev.find((x) => x.id === enrichedNewMsg.reply_to_id);
              if (parent) {
                enrichedNewMsg.reply_snippet = {
                  id: parent.id,
                  sender_name: parent.sender_id === currentUserId ? currentUserProfile.full_name : otherUser.full_name,
                  body: parent.body.length > 90 ? parent.body.substring(0, 90) + '…' : parent.body,
                };
              }
            }

            return [...prev, enrichedNewMsg];
          });

          if (newMsg.sender_id !== currentUserId) {
            markMessagesAsRead(conversationId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const rawMsg = payload.new as any;
          const { cleanBody, replySnippet } = parseStoredMessage(rawMsg);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === rawMsg.id
                ? {
                    ...m,
                    ...rawMsg,
                    body: cleanBody,
                    reply_snippet: replySnippet || m.reply_snippet || null,
                  }
                : m
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const newReaction = payload.new as MessageReaction;
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === newReaction.message_id) {
                const current = m.reactions || [];
                if (!current.some((r) => r.id === newReaction.id)) {
                  return { ...m, reactions: [...current, newReaction] };
                }
              }
              return m;
            })
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setMessages((prev) =>
              prev.map((m) => ({
                ...m,
                reactions: (m.reactions || []).filter((r) => r.id !== deletedId),
              }))
            );
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, supabase]);

  const handleSetReply = (msg: MessageItem, senderName: string) => {
    setActiveReply({
      id: msg.id,
      sender_name: senderName,
      body: msg.body.length > 90 ? msg.body.substring(0, 90) + '…' : msg.body,
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === messageId) {
          const current = m.reactions || [];
          const hasReacted = current.some((r) => r.user_id === currentUserId && r.emoji === emoji);
          let nextReactions: MessageReaction[];
          if (hasReacted) {
            nextReactions = current.filter((r) => !(r.user_id === currentUserId && r.emoji === emoji));
          } else {
            nextReactions = [
              ...current,
              {
                id: `temp-${Date.now()}`,
                message_id: messageId,
                user_id: currentUserId,
                emoji,
                created_at: new Date().toISOString(),
              },
            ];
          }
          return { ...m, reactions: nextReactions };
        }
        return m;
      })
    );

    await toggleReactionAction(messageId, emoji);
  };

  const handleTouchStart = (e: React.TouchEvent, msgId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingHorizontally.current = false;
    setSwipingId(msgId);
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent, msgId: string, isMe: boolean) => {
    if (swipingId !== msgId) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    if (!isSwipingHorizontally.current) {
      if (Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) {
        isSwipingHorizontally.current = true;
      }
    }

    if (isSwipingHorizontally.current) {
      if (isMe && deltaX < 0) {
        // Swipe LEFT on your own message (on the right)
        const clamped = Math.min(Math.abs(deltaX) * 0.75, 60);
        setSwipeOffset(-clamped);
      } else if (!isMe && deltaX > 0) {
        // Swipe RIGHT on other user's message (on the left)
        const clamped = Math.min(deltaX * 0.75, 60);
        setSwipeOffset(clamped);
      }
    }
  };

  const handleTouchEnd = (msg: MessageItem, senderName: string, isMe: boolean) => {
    if (swipingId === msg.id && Math.abs(swipeOffset) >= 35) {
      handleSetReply(msg, senderName);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    }
    setSwipingId(null);
    setSwipeOffset(0);
    isSwipingHorizontally.current = false;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    const replyingTo = activeReply;
    setInputText('');
    setActiveReply(null);
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: MessageItem = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
      reply_to_id: replyingTo ? replyingTo.id : null,
      reply_snippet: replyingTo,
      reactions: [],
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await sendMessage(
        conversationId,
        text,
        replyingTo ? replyingTo.id : null,
        replyingTo
      );
      if (res.error) {
        addToast({ type: 'error', title: 'Send Error', message: res.error });
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else if (res.message) {
        const realMsg = res.message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === realMsg.id)) return prev.filter((m) => m.id !== tempId);
          return prev.map((m) =>
            m.id === tempId
              ? {
                  ...realMsg,
                  reply_to_id: realMsg.reply_to_id || m.reply_to_id || null,
                  reply_snippet: realMsg.reply_snippet || m.reply_snippet || null,
                  reactions: [],
                }
              : m
          );
        });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to send' });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const handleDeleteSingleMessage = async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    const res = await deleteMessage(msgId);
    if (res.error) {
      addToast({ type: 'error', title: 'Delete Error', message: res.error });
    }
  };

  const handleCopyText = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      addToast({ type: 'info', title: 'Copied', message: 'Message copied to clipboard.' });
    }
  };

  const handleConfirmDeleteConv = async () => {
    if (deletingConv) return;
    setDeletingConv(true);
    try {
      const res = await deleteConversation(conversationId);
      if (res.error) {
        addToast({ type: 'error', title: 'Delete Failed', message: res.error });
      } else {
        addToast({ type: 'success', title: 'Conversation Deleted', message: 'Conversation removed successfully.' });
        router.push('/messages');
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete conversation' });
    } finally {
      setDeletingConv(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="chat-page-wrapper" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <Navbar profile={currentUserProfile} />

      <main className="chat-main-container">
        <div className="glass-container chat-glass-card">
          <div className="chat-header-bar">
            <Link
              href="/messages"
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                flexShrink: 0
              }}
            >
              <ArrowLeft size={16} />
              Inbox
            </Link>

            {otherUser.isDeletedUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #64748b, #334155)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  <AlertCircle size={20} />
                </div>
                <div>
                  <strong style={{ fontSize: '1.02rem', fontWeight: 600, color: 'var(--foreground)', display: 'block', lineHeight: 1.2 }}>
                    Removed Account
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    User profile no longer exists
                  </span>
                </div>
              </div>
            ) : (
              <Link
                href={`/directory/${otherUser.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', flex: 1, overflow: 'hidden' }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: otherUser.avatar_url ? 'none' : 'linear-gradient(135deg, var(--primary), #1e3a8a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  {otherUser.avatar_url ? (
                    <img src={otherUser.avatar_url} alt={otherUser.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    otherUser.full_name.charAt(0).toUpperCase()
                  )}
                </div>

                <div>
                  <strong style={{ fontSize: '1.02rem', fontWeight: 600, color: 'var(--primary)', display: 'block', lineHeight: 1.2 }}>
                    {otherUser.full_name}
                  </strong>
                  <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                    {otherUser.voice_part ? `${otherUser.voice_part} · ` : ''}View Profile →
                  </span>
                </div>
              </Link>
            )}

            {!isConnected && (
              <span style={{ fontSize: '11px', color: '#b91c1c', background: '#fee2e2', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>
                Reconnecting…
              </span>
            )}

            <button
              onClick={() => setShowDeleteModal(true)}
              title="Delete Conversation"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--muted)',
                padding: '8px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(159, 28, 28, 0.08)';
                e.currentTarget.style.color = 'var(--error)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--muted)';
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>

          <div className="chat-messages-area">
            {messages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', padding: '40px 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>💬</div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
                  No messages yet
                </h4>
                <p style={{ fontSize: '0.88rem', margin: 0 }}>
                  Say hi to {otherUser.full_name}! 👋
                </p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.sender_id === currentUserId;
                const isTemp = m.id.startsWith('temp-');
                const isRead = !!m.read_at;
                const senderName = isMe ? currentUserProfile.full_name : otherUser.full_name;
                const isSwiped = swipingId === m.id && Math.abs(swipeOffset) > 0;
                const swipeMagnitude = Math.abs(swipeOffset);

                // Date separator logic
                const currentDateLabel = getDateSeparatorLabel(m.created_at);
                const prevDateLabel = idx > 0 ? getDateSeparatorLabel(messages[idx - 1].created_at) : null;
                const showDateSeparator = idx === 0 || currentDateLabel !== prevDateLabel;

                const reactionGroups: { [emoji: string]: { count: number; userReacted: boolean } } = {};
                (m.reactions || []).forEach((r) => {
                  if (!reactionGroups[r.emoji]) {
                    reactionGroups[r.emoji] = { count: 0, userReacted: false };
                  }
                  reactionGroups[r.emoji].count += 1;
                  if (r.user_id === currentUserId) {
                    reactionGroups[r.emoji].userReacted = true;
                  }
                });

                return (
                  <React.Fragment key={m.id}>
                    {showDateSeparator && (
                      <div className="chat-date-separator">
                        <span>{currentDateLabel}</span>
                      </div>
                    )}
                    <div
                      id={`msg-${m.id}`}
                      className={`message-row ${isMe ? 'message-row-me' : 'message-row-other'} ${highlightedMessageId === m.id ? 'highlighted' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: '4px',
                      position: 'relative',
                      transform: isSwiped ? `translateX(${swipeOffset}px)` : undefined,
                      transition: isSwiped ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    onTouchStart={(e) => handleTouchStart(e, m.id)}
                    onTouchMove={(e) => handleTouchMove(e, m.id, isMe)}
                    onTouchEnd={() => handleTouchEnd(m, senderName, isMe)}
                  >
                    {/* Mobile Swipe Reply Indicator */}
                    {isSwiped && (
                      <div
                        className={`swipe-reply-icon ${isMe ? 'swipe-right' : 'swipe-left'}`}
                        style={{
                          opacity: Math.min(swipeMagnitude / 35, 1),
                          transform: `translateY(-50%) scale(${Math.min(0.85 + swipeMagnitude / 100, 1.1)})`,
                        }}
                      >
                        <Reply size={16} />
                      </div>
                    )}

                    {isMe && (
                      <div className="msg-action-bar">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenReactionMenuId(openReactionMenuId === m.id ? null : m.id);
                            setOpenMoreMenuId(null);
                          }}
                          className="msg-action-btn"
                          title="React"
                        >
                          <Smile size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetReply(m, senderName);
                          }}
                          className="msg-action-btn"
                          title="Reply"
                        >
                          <Reply size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMoreMenuId(openMoreMenuId === m.id ? null : m.id);
                            setOpenReactionMenuId(null);
                          }}
                          className="msg-action-btn"
                          title="More"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMoreMenuId === m.id && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 6px)',
                              right: 0,
                              background: '#ffffff',
                              borderRadius: '10px',
                              padding: '4px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                              border: '1px solid var(--glass-border)',
                              zIndex: 110,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              minWidth: '130px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleCopyText(m.body);
                                setOpenMoreMenuId(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.8rem',
                                color: 'var(--foreground)',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                textAlign: 'left',
                              }}
                            >
                              <Copy size={13} /> Copy Text
                            </button>
                            {!isTemp && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleDeleteSingleMessage(m.id);
                                  setOpenMoreMenuId(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 10px',
                                  background: 'none',
                                  border: 'none',
                                  fontSize: '0.8rem',
                                  color: 'var(--error)',
                                  cursor: 'pointer',
                                  borderRadius: '6px',
                                  textAlign: 'left',
                                }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ position: 'relative', maxWidth: '75%' }}>
                      {openReactionMenuId === m.id && (
                        <div
                          className="reaction-picker-popover"
                          style={{
                            [isMe ? 'right' : 'left']: 0,
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {REACTION_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="reaction-picker-emoji"
                              onClick={() => {
                                handleToggleReaction(m.id, emoji);
                                setOpenReactionMenuId(null);
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}

                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          background: isMe
                            ? 'var(--primary)'
                            : 'rgba(255, 255, 255, 0.95)',
                          color: isMe ? '#ffffff' : 'var(--foreground)',
                          border: isMe ? 'none' : '1px solid var(--glass-border)',
                          boxShadow: isMe
                            ? '0 3px 12px rgba(11, 77, 36, 0.22)'
                            : '0 2px 8px rgba(0, 0, 0, 0.04)',
                          wordBreak: 'break-word',
                        }}
                      >
                      {(() => {
                        const bubbleReply =
                          m.reply_snippet ||
                          (m.reply_to_id
                            ? (() => {
                                const parent = messages.find((x) => x.id === m.reply_to_id);
                                if (!parent) return null;
                                return {
                                  id: parent.id,
                                  sender_name:
                                    parent.sender_id === currentUserId
                                      ? currentUserProfile.full_name
                                      : otherUser.full_name,
                                  body:
                                    parent.body.length > 90
                                      ? parent.body.substring(0, 90) + '…'
                                      : parent.body,
                                };
                              })()
                            : null);

                        if (!bubbleReply) return null;

                        return (
                          <div
                            className="quoted-bubble-snippet"
                            onClick={() => scrollToMessage(bubbleReply.id)}
                            title="Click to jump to original message"
                          >
                            <div className="quoted-bubble-author">
                              ↩️ {bubbleReply.sender_name}
                            </div>
                            <div className="quoted-bubble-text">
                              {bubbleReply.body}
                            </div>
                          </div>
                        );
                      })()}

                        <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                          {m.body}
                        </p>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            marginTop: '4px',
                            fontSize: '0.68rem',
                            color: isMe ? 'rgba(255, 255, 255, 0.75)' : 'var(--muted)',
                            userSelect: 'none',
                          }}
                        >
                          <span title={new Date(m.created_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}>
                            {formatMessageTimestamp(m.created_at)}
                          </span>
                          {isMe && (
                            isTemp ? (
                              <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>· sending…</span>
                            ) : isRead ? (
                              <span title={`Seen at ${formatMessageTimestamp(m.read_at!)} (${new Date(m.read_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <CheckCheck size={14} style={{ color: '#86efac', flexShrink: 0 }} />
                              </span>
                            ) : (
                              <span title="Sent" style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <Check size={13} style={{ color: 'rgba(255, 255, 255, 0.65)', flexShrink: 0 }} />
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      {Object.keys(reactionGroups).length > 0 && (
                        <div
                          className="reaction-pill-container"
                          style={{
                            justifyContent: isMe ? 'flex-end' : 'flex-start',
                          }}
                        >
                          {Object.entries(reactionGroups).map(([emoji, group]) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => handleToggleReaction(m.id, emoji)}
                              className={`reaction-pill ${group.userReacted ? 'user-reacted' : ''}`}
                              title={group.userReacted ? 'Click to remove reaction' : 'Click to react'}
                            >
                              <span>{emoji}</span>
                              {group.count > 1 && <span>{group.count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!isMe && (
                      <div className="msg-action-bar">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenReactionMenuId(openReactionMenuId === m.id ? null : m.id);
                            setOpenMoreMenuId(null);
                          }}
                          className="msg-action-btn"
                          title="React"
                        >
                          <Smile size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetReply(m, senderName);
                          }}
                          className="msg-action-btn"
                          title="Reply"
                        >
                          <Reply size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMoreMenuId(openMoreMenuId === m.id ? null : m.id);
                            setOpenReactionMenuId(null);
                          }}
                          className="msg-action-btn"
                          title="More"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openMoreMenuId === m.id && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 6px)',
                              left: 0,
                              background: '#ffffff',
                              borderRadius: '10px',
                              padding: '4px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                              border: '1px solid var(--glass-border)',
                              zIndex: 110,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              minWidth: '130px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                handleCopyText(m.body);
                                setOpenMoreMenuId(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                background: 'none',
                                border: 'none',
                                fontSize: '0.8rem',
                                color: 'var(--foreground)',
                                cursor: 'pointer',
                                borderRadius: '6px',
                                textAlign: 'left',
                              }}
                            >
                              <Copy size={13} /> Copy Text
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {activeReply && (
            <div className="active-reply-banner">
              <div className="active-reply-content">
                <div className="active-reply-header">
                  <Reply size={13} />
                  <span>Replying to <strong>{activeReply.sender_name}</strong></span>
                </div>
                <p className="active-reply-body">{activeReply.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReply(null)}
                className="active-reply-close"
                title="Cancel Reply"
              >
                <X size={15} />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="chat-input-bar">
            <input
              ref={inputRef}
              type="text"
              className="input-field"
              placeholder={activeReply ? `Reply to ${activeReply.sender_name}…` : `Message ${otherUser.full_name}…`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && activeReply) {
                  setActiveReply(null);
                }
              }}
              disabled={sending}
              style={{ flex: 1, borderRadius: '24px', padding: '10px 18px', fontSize: '0.92rem' }}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="btn btn-primary"
              style={{
                minWidth: '48px',
                height: '42px',
                borderRadius: '21px',
                padding: '0 18px',
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Send size={15} />
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </main>

      {showDeleteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div
            className="glass-container"
            style={{
              maxWidth: '420px',
              width: '100%',
              padding: '24px',
              background: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(159, 28, 28, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}>
                <Trash2 size={20} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--foreground)' }}>
                Delete Conversation?
              </h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.4, margin: '0 0 20px' }}>
              This will permanently delete all messages in this conversation for both participants. This action cannot be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary"
                disabled={deletingConv}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteConv}
                className="btn btn-primary"
                style={{ background: 'var(--error)', borderColor: 'var(--error)' }}
                disabled={deletingConv}
              >
                {deletingConv ? 'Deleting…' : 'Delete for All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
