'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { MessageItem, sendMessage, markMessagesAsRead } from '../actions';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';
import { ArrowLeft, Send } from 'lucide-react';

interface OtherUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  voice_part: string | null;
  role: string;
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
  const { addToast } = useToast();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<MessageItem[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

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
            // 1. If exact message ID already exists, ignore
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            // 2. If matching temp message exists (same sender and body), replace it
            const tempIndex = prev.findIndex(
              (m) => m.id.startsWith('temp-') && m.sender_id === newMsg.sender_id && m.body === newMsg.body
            );

            if (tempIndex !== -1) {
              const updated = [...prev];
              updated[tempIndex] = newMsg;
              return updated;
            }

            // 3. Otherwise append new message
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
  }, [conversationId, currentUserId, supabase]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setInputText('');
    setSending(true);

    // Optimistic UI insert
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

            <Link
              href={`/directory/${otherUser.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', flex: 1, overflow: 'hidden' }}
            >
              {/* Avatar */}
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

            {!isConnected && (
              <span style={{ fontSize: '11px', color: '#b91c1c', background: '#fee2e2', padding: '3px 10px', borderRadius: '99px', fontWeight: 500 }}>
                Reconnecting…
              </span>
            )}
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
                    style={{
                      display: 'flex',
                      justifyContent: isMe ? 'flex-end' : 'flex-start',
                      marginBottom: '2px',
                    }}
                  >
                    {/* IG/FB Compact DM Chat Bubble */}
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
    </div>
  );
};
