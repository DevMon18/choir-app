'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
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
  ChevronDown,
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
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);

  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);

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
    if (messagesAreaRef.current) {
      messagesAreaRef.current.scrollTo({
        top: messagesAreaRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
    setShowScrollToBottom(false);
    setUnreadWhileScrolled(0);
  };

  const handleScroll = () => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 100;
    setShowScrollToBottom(!isNearBottom);
    if (isNearBottom) {
      setUnreadWhileScrolled(0);
    }
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
    if (isInitialMount.current) {
      scrollToBottom(false);
      isInitialMount.current = false;
    } else {
      const el = messagesAreaRef.current;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 160) {
        scrollToBottom(true);
      } else {
        setUnreadWhileScrolled((prev) => prev + 1);
      }
    }
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
    <div className="chat-page-wrapper h-[100dvh] max-h-[100dvh] w-full flex flex-col overflow-hidden relative bg-[#f8f6f0]">
      <div className="shrink-0 z-30">
        <Navbar profile={currentUserProfile} />
      </div>

      <main className="chat-main-container flex-1 min-h-0 max-w-[920px] mx-auto w-full p-2 sm:p-4 flex flex-col">
        <div className="glass-container chat-glass-card flex-1 min-h-0 flex flex-col overflow-hidden !p-0 rounded-2xl bg-white border border-glass-border shadow-xl relative">
          {/* Pinned Chat Header Bar */}
          <div className="chat-header-bar shrink-0 p-3 sm:py-3.5 sm:px-5 border-b border-glass-border flex items-center justify-between gap-3 bg-white z-10">
            <Link
              href="/messages"
              className="btn btn-secondary !py-1.5 !px-3 text-xs sm:text-[0.85rem] inline-flex items-center gap-1.5 rounded-lg shrink-0"
            >
              <ArrowLeft size={16} />
              Inbox
            </Link>

            {otherUser.isDeletedUser ? (
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <strong className="text-sm sm:text-[1.02rem] font-semibold text-foreground block leading-tight">
                    Removed Account
                  </strong>
                  <span className="text-xs text-muted">
                    User profile no longer exists
                  </span>
                </div>
              </div>
            ) : (
              <Link
                href={`/directory/${otherUser.id}`}
                className="flex items-center gap-3 no-underline flex-1 overflow-hidden"
              >
                <Avatar
                  src={otherUser.avatar_url}
                  name={otherUser.full_name}
                  size={40}
                  border
                />

                <div>
                  <strong className="text-sm sm:text-[1.02rem] font-semibold text-primary block leading-tight">
                    {otherUser.full_name}
                  </strong>
                  <span className="text-xs text-muted">
                    {otherUser.voice_part ? `${otherUser.voice_part} · ` : ''}View Profile →
                  </span>
                </div>
              </Link>
            )}

            {!isConnected && (
              <span className="text-[11px] text-red-700 bg-red-100 py-1 px-2.5 rounded-full font-medium">
                Reconnecting…
              </span>
            )}

            <button
              onClick={() => setShowDeleteModal(true)}
              title="Delete Conversation"
              className="bg-transparent border-none text-muted p-2 rounded-lg cursor-pointer flex items-center justify-center transition-colors hover:bg-red-500/8 hover:text-error"
            >
              <Trash2 size={18} />
            </button>
          </div>

          {/* Dedicated Scrollable Messages Viewport (ONLY THIS SCROLLS) */}
          <div
            ref={messagesAreaRef}
            onScroll={handleScroll}
            className="chat-messages-area flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 flex flex-col gap-2 bg-[#fdfcf9]"
          >
            {messages.length === 0 ? (
              <div className="m-auto text-center text-muted py-10 px-5">
                <div className="text-4xl mb-2">💬</div>
                <h4 className="text-base font-semibold text-primary mb-1">
                  No messages yet
                </h4>
                <p className="text-xs sm:text-sm m-0">
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
                      <div className="chat-date-separator text-center my-3">
                        <span className="text-[11px] font-semibold text-muted bg-black/5 py-1 px-3 rounded-full">{currentDateLabel}</span>
                      </div>
                    )}
                    <div
                      id={`msg-${m.id}`}
                      className={`message-row ${isMe ? 'message-row-me' : 'message-row-other'} ${highlightedMessageId === m.id ? 'highlighted' : ''} flex items-center gap-1.5 mb-1 relative ${isMe ? 'justify-end' : 'justify-start'}`}
                      style={{
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
                        <div className="msg-action-bar flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenReactionMenuId(openReactionMenuId === m.id ? null : m.id);
                              setOpenMoreMenuId(null);
                            }}
                            className="msg-action-btn p-1 text-muted hover:text-foreground rounded"
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
                            className="msg-action-btn p-1 text-muted hover:text-foreground rounded"
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
                            className="msg-action-btn p-1 text-muted hover:text-foreground rounded"
                            title="More"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {openMoreMenuId === m.id && (
                            <div
                              className="absolute bottom-[calc(100%+6px)] right-0 bg-white rounded-xl p-1 shadow-xl border border-glass-border z-[110] flex flex-col gap-0.5 min-w-[130px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleCopyText(m.body);
                                  setOpenMoreMenuId(null);
                                }}
                                className="flex items-center gap-2 p-1.5 px-2.5 bg-transparent border-none text-xs text-foreground cursor-pointer rounded-lg text-left hover:bg-slate-100"
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
                                  className="flex items-center gap-2 p-1.5 px-2.5 bg-transparent border-none text-xs text-error cursor-pointer rounded-lg text-left hover:bg-red-50"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="relative max-w-[75%]">
                        {openReactionMenuId === m.id && (
                          <div
                            className="reaction-picker-popover absolute bottom-[calc(100%+6px)] bg-white rounded-full p-1.5 px-2 shadow-xl border border-glass-border z-[110] flex gap-1 animate-scaleIn"
                            style={{
                              [isMe ? 'right' : 'left']: 0,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {REACTION_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="reaction-picker-emoji bg-transparent border-none text-base cursor-pointer hover:scale-125 transition-transform p-1"
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
                          className={`p-2.5 px-3.5 break-words ${
                            isMe
                              ? 'rounded-[18px_18px_4px_18px] bg-primary text-white shadow-[0_3px_12px_rgba(11,77,36,0.22)]'
                              : 'rounded-[18px_18px_18px_4px] bg-white/95 text-foreground border border-glass-border shadow-sm'
                          }`}
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
                              className="quoted-bubble-snippet mb-1.5 p-1.5 px-2.5 rounded-lg bg-black/10 text-xs cursor-pointer"
                              onClick={() => scrollToMessage(bubbleReply.id)}
                              title="Click to jump to original message"
                            >
                              <div className="quoted-bubble-author font-bold opacity-80">
                                ↩️ {bubbleReply.sender_name}
                              </div>
                              <div className="quoted-bubble-text opacity-90 truncate">
                                {bubbleReply.body}
                              </div>
                            </div>
                          );
                        })()}

                          <p className="m-0 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                            {m.body}
                          </p>

                          <div className={`flex items-center justify-end gap-1 mt-1 text-[0.68rem] select-none ${
                            isMe ? 'text-white/75' : 'text-muted'
                          }`}>
                            <span title={new Date(m.created_at).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}>
                              {formatMessageTimestamp(m.created_at)}
                            </span>
                            {isMe && (
                              isTemp ? (
                                <span className="text-[0.65rem] opacity-70">· sending…</span>
                              ) : isRead ? (
                                <span title={`Seen at ${formatMessageTimestamp(m.read_at!)} (${new Date(m.read_at!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`} className="inline-flex items-center">
                                  <CheckCheck size={14} className="text-green-300 shrink-0" />
                                </span>
                              ) : (
                                <span title="Sent" className="inline-flex items-center">
                                  <Check size={13} className="text-white/65 shrink-0" />
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        {Object.keys(reactionGroups).length > 0 && (
                          <div className={`reaction-pill-container flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(reactionGroups).map(([emoji, group]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleToggleReaction(m.id, emoji)}
                                className={`reaction-pill inline-flex items-center gap-1 text-xs py-0.5 px-2 rounded-full border cursor-pointer transition-all ${
                                  group.userReacted
                                    ? 'bg-primary/10 border-primary text-primary font-bold'
                                    : 'bg-white/80 border-glass-border text-foreground hover:bg-white'
                                }`}
                                title={group.userReacted ? 'Click to remove reaction' : 'Click to react'}
                              >
                                <span>{emoji}</span>
                                {group.count > 1 && <span className="text-[11px]">{group.count}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isMe && (
                        <div className="msg-action-bar flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenReactionMenuId(openReactionMenuId === m.id ? null : m.id);
                              setOpenMoreMenuId(null);
                            }}
                            className="msg-action-btn p-1 text-muted hover:text-foreground rounded"
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
                            className="msg-action-btn p-1 text-muted hover:text-foreground rounded"
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
                            className="msg-action-btn p-1 text-muted hover:text-foreground rounded"
                            title="More"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {openMoreMenuId === m.id && (
                            <div
                              className="absolute bottom-[calc(100%+6px)] left-0 bg-white rounded-xl p-1 shadow-xl border border-glass-border z-[110] flex flex-col gap-0.5 min-w-[130px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  handleCopyText(m.body);
                                  setOpenMoreMenuId(null);
                                }}
                                className="flex items-center gap-2 p-1.5 px-2.5 bg-transparent border-none text-xs text-foreground cursor-pointer rounded-lg text-left hover:bg-slate-100"
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

          {/* Floating Scroll-to-Bottom Quick Button */}
          {showScrollToBottom && (
            <button
              type="button"
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-20 right-5 z-30 bg-primary text-white py-2 px-3.5 rounded-full shadow-xl hover:bg-primary-hover active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold border border-white/20 animate-in fade-in zoom-in duration-150 cursor-pointer"
              title="Scroll to latest messages"
            >
              <ChevronDown size={16} />
              <span>Latest</span>
              {unreadWhileScrolled > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {unreadWhileScrolled}
                </span>
              )}
            </button>
          )}

          {/* Active Reply Banner */}
          {activeReply && (
            <div className="active-reply-banner shrink-0 p-2.5 px-4 bg-primary/6 border-t border-primary/15 flex items-center justify-between gap-3">
              <div className="active-reply-content flex-1 overflow-hidden">
                <div className="active-reply-header flex items-center gap-1.5 text-xs text-primary font-semibold mb-0.5">
                  <Reply size={13} />
                  <span>Replying to <strong>{activeReply.sender_name}</strong></span>
                </div>
                <p className="active-reply-body text-xs text-muted m-0 truncate">{activeReply.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveReply(null)}
                className="active-reply-close bg-transparent border-none text-muted hover:text-foreground p-1 rounded cursor-pointer"
                title="Cancel Reply"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Pinned Input Bar */}
          <form onSubmit={handleSend} className="chat-input-bar shrink-0 p-2.5 sm:py-3 sm:px-4 border-t border-glass-border flex items-center gap-2 bg-white">
            <input
              ref={inputRef}
              type="text"
              className="input-field flex-1 !rounded-full !py-2.5 !px-4.5 text-xs sm:text-sm"
              placeholder={activeReply ? `Reply to ${activeReply.sender_name}…` : `Message ${otherUser.full_name}…`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && activeReply) {
                  setActiveReply(null);
                }
              }}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || sending}
              className="btn btn-primary !min-w-[48px] !h-[42px] !rounded-full !px-4 text-xs sm:text-sm inline-flex items-center justify-center gap-1.5"
            >
              <Send size={15} />
              <span>{sending ? '…' : 'Send'}</span>
            </button>
          </form>
        </div>
      </main>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[99999] bg-black/55 backdrop-blur-sm flex items-center justify-center p-5 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div className="glass-container max-w-[420px] w-full p-6 bg-white rounded-2xl shadow-2xl animate-slideUpModal">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9.5 h-9.5 rounded-full bg-red-500/10 flex items-center justify-center text-error">
                <Trash2 size={20} />
              </div>
              <h3 className="m-0 text-base sm:text-lg font-bold text-foreground">
                Delete Conversation?
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-muted leading-relaxed m-0 mb-5">
              This will permanently delete all messages in this conversation for both participants. This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm"
                disabled={deletingConv}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteConv}
                className="btn btn-primary !bg-error !border-error !py-2 !px-4 text-xs sm:text-sm"
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
