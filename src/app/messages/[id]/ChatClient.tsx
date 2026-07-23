'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { MessageItem, sendMessage, markMessagesAsRead } from '../actions';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

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
            if (prev.some((m) => m.id === newMsg.id)) return prev;
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
    if (!inputText.trim() || sending) return;

    const body = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic message append
    const tempId = `temp-${Date.now()}`;
    const tempMsg: MessageItem = {
      id: tempId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };

    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await sendMessage(conversationId, body);
      if (res.error) {
        // Roll back optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        addToast({ type: 'error', title: 'Send Failed', message: res.error });
      } else if (res.message) {
        // Replace temp message with server returned record
        setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message! : m)));
      }
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to send' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}>
      <Navbar profile={currentUserProfile} />

      {/* Top Chat Header Bar */}
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(255, 254, 252, 0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 10,
        }}
      >
        <Link href="/messages" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '13px' }}>
          ← Inbox
        </Link>

        <Link
          href={`/directory/${otherUser.id}`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flex: 1, overflow: 'hidden' }}
        >
          {/* 36px Header Avatar */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: otherUser.avatar_url ? 'none' : 'linear-gradient(135deg, var(--primary), #1e3a8a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.85rem',
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
            <strong style={{ fontSize: '15px', fontWeight: 600, color: 'var(--foreground)', display: 'block', lineHeight: 1.2 }}>
              {otherUser.full_name}
            </strong>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
              {otherUser.voice_part ? `${otherUser.voice_part} · ` : ''}View Profile
            </span>
          </div>
        </Link>

        {!isConnected && (
          <span style={{ fontSize: '11px', color: '#b91c1c', background: '#fee2e2', padding: '2px 8px', borderRadius: '99px' }}>
            Reconnecting…
          </span>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
            Say hi to {otherUser.full_name}! 👋
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
                    padding: '10px 14px',
                    borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMe ? 'var(--primary)' : 'rgba(255, 255, 255, 0.88)',
                    color: isMe ? '#fff' : 'var(--foreground)',
                    border: isMe ? 'none' : '1px solid var(--glass-border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {m.body}
                  </p>
                  <div
                    style={{
                      fontSize: '11px',
                      opacity: 0.7,
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
          padding: '12px 16px 32px',
          background: 'rgba(255, 254, 252, 0.95)',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          gap: '8px',
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
          style={{ flex: 1, borderRadius: '24px', padding: '10px 16px', fontSize: '14px' }}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || sending}
          className="btn btn-primary"
          style={{
            minWidth: '48px',
            minHeight: '44px',
            borderRadius: '22px',
            padding: '0 16px',
            fontSize: '14px',
          }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
};
