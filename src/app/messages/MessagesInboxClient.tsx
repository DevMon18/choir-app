'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { ConversationItem } from './actions';
import { MessageSquare, Plus } from 'lucide-react';

interface Props {
  currentUserProfile: { id: string; full_name: string; role: string };
  conversations: ConversationItem[];
}

export const MessagesInboxClient: React.FC<Props> = ({
  currentUserProfile,
  conversations,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" style={{ width: '450px', height: '450px' }} />
      <div className="bg-orb bg-orb-2" style={{ width: '400px', height: '400px' }} />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, padding: '24px 16px 120px', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={22} />
              Direct Messages
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '4px 0 0 0' }}>
              Private 1-on-1 conversations with choir members.
            </p>
          </div>
          <Link href="/directory" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            New Message
          </Link>
        </div>

        {/* Conversation List */}
        {conversations.length === 0 ? (
          <div className="glass-container" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💬</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--primary)', margin: '0 0 4px 0' }}>
              No messages yet
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '16px' }}>
              Start a private conversation from any member profile in the Directory.
            </p>
            <Link href="/directory" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '14px' }}>
              Browse Member Directory →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {conversations.map((c) => {
              const u = c.otherUser;
              return (
                <Link
                  key={c.id}
                  href={`/messages/${c.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div
                    className="glass-container"
                    style={{
                      padding: '12px 16px',
                      minHeight: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      borderRadius: '12px',
                      background: c.unreadCount > 0 ? 'rgba(11, 77, 36, 0.06)' : 'rgba(255,255,255,0.7)',
                      border: c.unreadCount > 0 ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    {/* 38px Avatar */}
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        background: u.avatar_url ? 'none' : 'linear-gradient(135deg, var(--primary), #1e3a8a)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        flexShrink: 0,
                        overflow: 'hidden',
                        border: '1px solid var(--glass-border)',
                      }}
                    >
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt={u.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        u.full_name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <strong style={{ fontSize: '15px', fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {u.full_name}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>
                          {new Date(c.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: c.unreadCount > 0 ? 'var(--foreground)' : 'var(--muted)', fontWeight: c.unreadCount > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                          {c.lastMessage ? c.lastMessage.body : 'Start chatting…'}
                        </p>
                        {c.unreadCount > 0 && (
                          <span
                            style={{
                              background: 'var(--primary)',
                              color: '#fff',
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: '99px',
                            }}
                          >
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
