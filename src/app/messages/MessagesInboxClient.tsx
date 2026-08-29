'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import { ConversationItem, deleteConversation } from './actions';
import { useToast } from '@/components/Toast';
import { MessageSquare, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useClientCache } from '@/context/ClientCacheContext';

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

  const { data: convs, updateData: setConvs } = useClientCache('messages_conversations', initialConversations);
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
    <div className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1 w-[450px] h-[450px]" />
      <div className="bg-orb bg-orb-2 w-[400px] h-[400px]" />

      <Navbar profile={currentUserProfile} />

      <main className="messages-inbox-container max-w-[800px] mx-auto w-full py-6 px-4 pb-[120px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-primary m-0 flex items-center gap-2">
              <MessageSquare size={22} />
              <span>Direct Messages</span>
            </h1>
            <p className="text-muted text-xs sm:text-sm mt-1 m-0">
              Private 1-on-1 conversations. Press & hold on mobile to delete.
            </p>
          </div>
          <Link href="/directory" className="btn btn-secondary !py-2 !px-3.5 text-xs sm:text-sm inline-flex items-center gap-1.5">
            <Plus size={16} />
            <span>New Message</span>
          </Link>
        </div>

        {/* Conversation List */}
        {convs.length === 0 ? (
          <div className="glass-container p-10 text-center">
            <div className="text-4xl mb-3">💬</div>
            <h3 className="text-base font-semibold text-primary m-0 mb-1">
              No messages yet
            </h3>
            <p className="text-muted text-xs sm:text-sm mb-4">
              Start a private conversation from any member profile in the Directory.
            </p>
            <Link href="/directory" className="btn btn-primary !py-2 !px-4 text-sm">
              Browse Member Directory →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {convs.map((c) => {
              const u = c.otherUser;
              return (
                <div
                  key={c.id}
                  onTouchStart={() => handleTouchStart(c)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchEnd}
                  className={`glass-container p-3 sm:py-3 sm:px-4 min-h-[64px] flex items-center gap-3 rounded-xl transition-all duration-150 relative ${
                    c.unreadCount > 0
                      ? 'bg-primary/6 border border-primary'
                      : 'bg-white/70 border border-glass-border'
                  }`}
                >
                  {/* Avatar Icon */}
                  <Link href={`/directory/${u.id}`} className="no-underline flex items-center">
                    <Avatar
                      src={u.avatar_url}
                      name={u.full_name}
                      size={40}
                      border
                    />
                  </Link>

                  {/* Main Link Content */}
                  <Link href={`/messages/${c.id}`} className="no-underline flex-1 overflow-hidden">
                    <div>
                      <div className="flex justify-between items-center mb-0.5">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <strong className="text-xs sm:text-sm font-semibold text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                            {u.full_name}
                          </strong>
                          {u.isDeletedUser && (
                            <span className="text-[0.72rem] bg-slate-500/12 text-slate-600 py-0.5 px-1.5 rounded font-medium">
                              Account Removed
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted shrink-0">
                          {new Date(c.last_message_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <p className={`m-0 text-xs sm:text-[0.85rem] whitespace-nowrap overflow-hidden text-ellipsis max-w-[85%] ${
                          c.unreadCount > 0 ? 'text-foreground font-semibold' : 'text-muted font-normal'
                        }`}>
                          {c.lastMessage ? c.lastMessage.body : 'Start chatting…'}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="bg-primary text-white text-[11px] font-bold py-0.5 px-2 rounded-full">
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
                    className="bg-transparent border-none text-muted p-1.5 rounded-lg cursor-pointer flex items-center justify-center transition-colors shrink-0 hover:bg-red-500/8 hover:text-error"
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
          className="fixed inset-0 z-[99999] bg-black/55 backdrop-blur-sm flex items-center justify-center p-5 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="glass-container max-w-[420px] w-full p-6 bg-white rounded-2xl shadow-2xl animate-slideUpModal">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9.5 h-9.5 rounded-full bg-red-500/10 flex items-center justify-center text-error">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground m-0">
                  Delete Conversation?
                </h3>
                <span className="text-xs text-muted">
                  {deleteTarget.otherUser.full_name}
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-muted leading-relaxed mb-6">
              Are you sure you want to delete this conversation with <strong>{deleteTarget.otherUser.full_name}</strong>? All message history will be permanently deleted for you.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary !bg-error !border-error !py-2 !px-4 text-xs sm:text-sm"
                onClick={handleConfirmDelete}
                disabled={deleting}
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
