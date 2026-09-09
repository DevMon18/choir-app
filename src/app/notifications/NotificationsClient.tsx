'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import {
  InAppNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearReadNotifications,
} from './actions';
import {
  Bell,
  CheckCheck,
  Trash2,
  Search,
  ArrowLeft,
  Heart,
  MessageSquare,
  Megaphone,
  FileText,
  DollarSign,
  ListTodo,
  Sparkles,
  ExternalLink,
  Filter,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

interface NotificationsClientProps {
  profile: {
    id: string;
    role: string;
    full_name: string;
    avatar_url?: string | null;
  };
  initialNotifications: InAppNotification[];
  initialUnreadCount: number;
  initialTotalCount: number;
}

export const NotificationsClient: React.FC<NotificationsClientProps> = ({
  profile,
  initialNotifications = [],
  initialUnreadCount = 0,
  initialTotalCount = 0,
}) => {
  const router = useRouter();
  const { addToast } = useToast();

  const [notifications, setNotifications] = useState<InAppNotification[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [activeCategory, setActiveCategory] = useState<'all' | 'unread' | 'social' | 'announcements' | 'tasks'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Format relative timestamp
  const formatTimestamp = useCallback((dateString: string) => {
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, []);

  // Handle clicking a notification
  const handleItemClick = async (notif: InAppNotification) => {
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationAsRead(notif.id).catch(console.error);
    }

    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || actionLoading) return;
    setActionLoading(true);

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    const res = await markAllNotificationsAsRead();
    setActionLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Error', message: res.error });
    } else {
      addToast({ type: 'success', title: '✓ All Caught Up', message: 'All notifications marked as read.' });
    }
  };

  // Delete single notification
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);
    if (!target) return;

    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!target.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setTotalCount((prev) => Math.max(0, prev - 1));

    await deleteNotification(id);
  };

  // Clear read notifications
  const handleClearRead = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setNotifications((prev) => prev.filter((n) => !n.is_read));
    await clearReadNotifications();
    setActionLoading(false);
    addToast({ type: 'info', title: 'Cleared', message: 'Read notifications cleared.' });
  };

  // Filtered notifications list
  const filteredList = useMemo(() => {
    return notifications.filter((notif) => {
      // Category filter
      if (activeCategory === 'unread' && notif.is_read) return false;
      if (
        activeCategory === 'social' &&
        !['thread_reaction', 'thread_comment', 'comment_reply', 'comment_reaction', 'thread_mention'].includes(notif.type)
      ) {
        return false;
      }
      if (
        activeCategory === 'announcements' &&
        !['announcement', 'thread_acknowledgement_required', 'minutes'].includes(notif.type)
      ) {
        return false;
      }
      if (activeCategory === 'tasks' && notif.type !== 'task_assigned') return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = notif.title.toLowerCase().includes(q);
        const bodyMatch = notif.body.toLowerCase().includes(q);
        const actorMatch = notif.actor?.full_name?.toLowerCase().includes(q);
        if (!titleMatch && !bodyMatch && !actorMatch) return false;
      }

      return true;
    });
  }, [notifications, activeCategory, searchQuery]);

  // Type badge helper
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'thread_reaction':
      case 'comment_reaction':
        return (
          <span className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs border border-white">
            <Heart size={11} fill="currentColor" />
          </span>
        );
      case 'thread_comment':
      case 'comment_reply':
        return (
          <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs border border-white">
            <MessageSquare size={11} fill="currentColor" />
          </span>
        );
      case 'thread_acknowledgement_required':
      case 'minutes':
        return (
          <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs border border-white">
            <FileText size={11} />
          </span>
        );
      case 'announcement':
        return (
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white">
            <Megaphone size={11} />
          </span>
        );
      case 'task_assigned':
        return (
          <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-xs border border-white">
            <ListTodo size={11} />
          </span>
        );
      case 'dues_payment':
        return (
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs border border-white">
            <DollarSign size={11} />
          </span>
        );
      default:
        return (
          <span className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center shadow-xs border border-white">
            <Bell size={11} />
          </span>
        );
    }
  };

  return (
    <div className="page-shell">
      <Navbar profile={profile as any} />

      <main className="page-container !pt-3 sm:!pt-6 !pb-28 sm:!pb-16">
        <div className="max-w-[760px] mx-auto flex flex-col gap-4 sm:gap-5">

          {/* Top Header Card */}
          <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Back to feed"
              >
                <ArrowLeft size={18} />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                    Notifications
                  </h1>
                  {unreadCount > 0 && (
                    <span className="bg-rose-500/10 text-rose-700 font-extrabold text-xs px-2.5 py-0.5 rounded-full border border-rose-200/60">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Stay updated with choir feeds, replies, meeting minutes, and duty alerts.
                </p>
              </div>
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={actionLoading}
                  className="btn btn-secondary !py-2 !px-3 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs hover:bg-slate-100 cursor-pointer"
                >
                  <CheckCheck size={14} />
                  <span>Mark All Read</span>
                </button>
              )}

              {notifications.some((n) => n.is_read) && (
                <button
                  type="button"
                  onClick={handleClearRead}
                  disabled={actionLoading}
                  className="btn btn-ghost !py-2 !px-3 text-xs text-slate-500 hover:text-rose-600 font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Clear Read</span>
                </button>
              )}
            </div>
          </div>

          {/* Toolbar: Category Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200/70 pb-3">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto py-0.5">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  activeCategory === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All ({notifications.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('unread')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 inline-flex items-center gap-1.5 ${
                  activeCategory === 'unread'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className={`text-[0.65rem] px-1.5 py-0.2 rounded-full font-black ${
                    activeCategory === 'unread' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('social')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  activeCategory === 'social'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                💬 Feed &amp; Reactions
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('announcements')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  activeCategory === 'announcements'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                📢 Announcements &amp; Minutes
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('tasks')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  activeCategory === 'tasks'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                📋 Tasks
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search notifications…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Notifications Card Feed */}
          <div className="flex flex-col gap-2.5">
            {filteredList.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-2xs flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                  <Bell size={26} className="opacity-60" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No notifications found</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {searchQuery
                    ? `No notifications matched "${searchQuery}".`
                    : activeCategory === 'unread'
                    ? "You're all caught up! No unread notifications."
                    : 'You do not have any notifications in this category yet.'}
                </p>
              </div>
            ) : (
              filteredList.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleItemClick(notif)}
                  className={`group p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-3.5 relative shadow-2xs hover:shadow-xs hover:border-primary/30 ${
                    !notif.is_read
                      ? 'bg-emerald-50/30 border-emerald-200/80'
                      : 'bg-white border-slate-200/90'
                  }`}
                >
                  {/* Unread Glow Dot */}
                  {!notif.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-primary absolute left-2 top-5 shadow-[0_0_8px_rgba(11,77,36,0.6)]" />
                  )}

                  {/* Actor Avatar with Type Badge */}
                  <div className="relative shrink-0 mt-0.5 ml-1.5">
                    <Avatar
                      src={notif.actor?.avatar_url}
                      name={notif.actor?.full_name || notif.title}
                      size={44}
                      className="border border-slate-200"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      {getTypeBadge(notif.type)}
                    </div>
                  </div>

                  {/* Text Details */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-extrabold text-xs sm:text-sm text-slate-900 tracking-tight">
                        {notif.title}
                      </span>
                      <span className="text-[0.68rem] text-slate-400 font-medium whitespace-nowrap">
                        {formatTimestamp(notif.created_at)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-relaxed font-normal">
                      {notif.body}
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[0.68rem] text-primary font-bold inline-flex items-center gap-1 hover:underline">
                        <span>View detail</span>
                        <ExternalLink size={10} />
                      </span>
                      {!notif.is_read && (
                        <span className="text-[0.65rem] font-extrabold bg-primary/10 text-primary px-2 py-0.2 rounded-full">
                          Unread
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, notif.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0 cursor-pointer self-center"
                    title="Dismiss notification"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default NotificationsClient;
