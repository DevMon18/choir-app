'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { MessageItem, sendMessage, markMessagesAsRead, deleteConversation, deleteMessage } from '../actions';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { ArrowLeft, Send, Trash2, AlertCircle } from 'lucide-react';

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

  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    scrollToBottom(false);
    markMessagesAsRead(conversationId);
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages]);

  // Per-conversation real-time subscription
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
          const newMsg = payload.new as MessageItem;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            const tempIndex = prev.findIndex(
              (m) => m.id.startsWith('temp-') && m.sender_id === newMsg.sender_id && m.body === newMsg.body
            );

            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = newMsg;
              return updated;
            }

            return [...prev, newMsg];
          });

          if (newMsg.sender_id !== currentUserId) {
            markMessagesAsRead(conversationId);
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
  }, [conversationId, currentUserId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: MessageItem = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await sendMessage(conversationId, text);
      if (res.error) {
        addToast({ type: 'error', title: 'Send Error', message: res.error });
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      } else if (res.message) {
        const realMsg = res.message;
        setMessages((prev) => {
          if (prev.some((m) => m.id === realMsg.id)) return prev.filter((m) => m.id !== tempId);
          return prev.map((m) => (m.id === tempId ? realMsg : m));
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <Navbar profile={currentUserProfile} />

      {/* Main Container */}
      <main style={{ flex: 1, padding: '16px 12px 100px', maxWidth: '860px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
        <div
          className="glass-container"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 160px)',
            minHeight: '480px',
            padding: 0,
            overflow: 'hidden',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          {/* Top Chat Header Bar */}
          <div
            style={{
              padding: '14px 20px',
              background: 'rgba(255, 254, 252, 0.95)',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              zIndex: 10,
            }}
          >
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
                    // eslint-disable-next-line @next/next/no-img-element
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

          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(255, 254, 252, 0.4)',
            }}
          >
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
              messages.map((m) => {
                const isMe = m.sender_id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className="message-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: '2px',
                    }}
                  >
                    {isMe && !m.id.startsWith('temp-') && (
                      <button
                        onClick={() => handleDeleteSingleMessage(m.id)}
                        title="Delete Message"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                          opacity: 0.4,
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          transition: 'opacity 0.2s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    {/* Chat Bubble */}
                    <div
                      style={{
                        maxWidth: '75%',
                        padding: '10px 16px',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMe ? 'var(--primary)' : 'rgba(255, 255, 255, 0.92)',
                        color: isMe ? '#fff' : 'var(--foreground)',
                        border: isMe ? 'none' : '1px solid var(--glass-border)',
                        boxShadow: isMe ? '0 2px 8px rgba(11, 77, 36, 0.2)' : '0 2px 6px rgba(0,0,0,0.04)',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.45, wordBreak: 'break-word' }}>
                        {m.body}
                      </p>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          opacity: 0.75,
                          textAlign: 'right',
                          marginTop: '4px',
                        }}
                      >
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Message Input Bar */}
          <form
            onSubmit={handleSend}
            style={{
              padding: '14px 18px',
              background: 'rgba(255, 254, 252, 0.98)',
              borderTop: '1px solid var(--glass-border)',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder={`Message ${otherUser.full_name}…`}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
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

      {/* Delete Conversation Modal */}
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
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                  Delete Conversation?
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                  {otherUser.full_name}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '24px' }}>
              Are you sure you want to delete this conversation with <strong>{otherUser.full_name}</strong>? All message history will be permanently deleted for you.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingConv}
                style={{ padding: '8px 16px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmDeleteConv}
                disabled={deletingConv}
                style={{
                  background: 'var(--error)',
                  borderColor: 'var(--error)',
                  padding: '8px 18px',
                  fontSize: '0.88rem',
                }}
              >
                {deletingConv ? 'Deleting...' : 'Delete Conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
