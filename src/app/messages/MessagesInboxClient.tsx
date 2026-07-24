'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ConversationItem, deleteConversation } from './actions';
import { useToast } from '@/components/Toast';
import { MessageSquare, Plus, Trash2, AlertCircle } from 'lucide-react';

interface Props {
  currentUserProfile: { id: string; full_name: string; role: string };
  conversations: ConversationItem[];
}

export const MessagesInboxClient: React.FC<Props> = ({
  currentUserProfile,
  conversations: initialConversations,
}) => {
  const router = useRouter();
  const { addToast } = useToast();

  const [convs, setConvs] = useState<ConversationItem[]>(initialConversations);
  const [deleteTarget, setDeleteTarget] = useState<ConversationItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Long press timer ref for mobile touch events
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (c: ConversationItem) => {
    longPressTimer.current = setTimeout(() => {
      setDeleteTarget(c);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500); // 500ms long press duration
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      const res = await deleteConversation(deleteTarget.id);
      if (res.error) {
        addToast({ type: 'error', title: 'Delete Failed', message: res.error });
      } else {
        setConvs((prev) => prev.filter((item) => item.id !== deleteTarget.id));
        addToast({ type: 'success', title: 'Conversation Deleted', message: 'Conversation removed successfully.' });
        router.refresh();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete conversation' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

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
              Private 1-on-1 conversations. Press & hold on mobile to delete.
            </p>
          </div>
          <Link href="/directory" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} />
            New Message
          </Link>
        </div>

        {/* Conversation List */}
        {convs.length === 0 ? (
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
            {convs.map((c) => {
              const u = c.otherUser;
              return (
                <div
                  key={c.id}
                  onTouchStart={() => handleTouchStart(c)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                  className="glass-container"
                  style={{
                    padding: '12px 16px',
                    minHeight: '64px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    borderRadius: '12px',
                    background: c.unreadCount > 0 ? 'rgba(11, 77, 36, 0.06)' : 'rgba(255,255,255,0.7)',
                    border: c.unreadCount > 0 ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  {/* Avatar */}
                  <Link href={`/messages/${c.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: u.avatar_url ? 'none' : u.isDeletedUser ? 'linear-gradient(135deg, #64748b, #334155)' : 'linear-gradient(135deg, var(--primary), #1e3a8a)',
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
                      ) : u.isDeletedUser ? (
                        <AlertCircle size={18} />
                      ) : (
                        u.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                  </Link>

                  {/* Main Link Content */}
                  <Link href={`/messages/${c.id}`} style={{ textDecoration: 'none', flex: 1, overflow: 'hidden' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          <strong style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.full_name}
                          </strong>
                          {u.isDeletedUser && (
                            <span style={{ fontSize: '0.72rem', background: 'rgba(100,116,139,0.12)', color: '#475569', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }}>
                              Account Removed
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>
                          {new Date(c.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: c.unreadCount > 0 ? 'var(--foreground)' : 'var(--muted)', fontWeight: c.unreadCount > 0 ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
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
                  </Link>

                  {/* Delete Button (Web & Quick Action) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDeleteTarget(c);
                    }}
                    title="Delete Conversation"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--muted)',
                      padding: '6px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
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
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal (Action Sheet) */}
      {deleteTarget && (
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
            if (e.target === e.currentTarget) setDeleteTarget(null);
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
                  {deleteTarget.otherUser.full_name}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '24px' }}>
              Are you sure you want to delete this conversation with <strong>{deleteTarget.otherUser.full_name}</strong>? All message history will be permanently deleted for you.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{ padding: '8px 16px', fontSize: '0.88rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  background: 'var(--error)',
                  borderColor: 'var(--error)',
                  padding: '8px 18px',
                  fontSize: '0.88rem',
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Conversation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
