'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { createClient } from '@/lib/supabase/client';
import {
  InAppNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearReadNotifications,
} from '@/app/notifications/actions';
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  MessageSquare,
  Heart,
  Megaphone,
  FileText,
  DollarSign,
  ListTodo,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

interface NotificationBellProps {
  currentUserId?: string;
  className?: string;
  isMobile?: boolean;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  currentUserId,
  className = '',
  isMobile = false,
}) => {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeUserId, setActiveUserId] = useState<string | null>(currentUserId || null);

  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Helper: Format relative timestamp with clean typography
  const formatTimeAgo = useCallback((dateString: string) => {
    try {
      const now = new Date();
      const date = new Date(dateString);
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return 'Just now';
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }, []);

  // Fetch notifications
  const fetchNotificationsList = useCallback(async (userId?: string) => {
    try {
      const res = await getNotifications({ limit: 40 });
      if (res.data) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
        setTotalCount(res.totalCount);
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }, []);

  // Initialize and get active user ID
  useEffect(() => {
    let isMounted = true;
    async function initUser() {
      if (currentUserId) {
        setActiveUserId(currentUserId);
        fetchNotificationsList(currentUserId);
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && isMounted) {
          setActiveUserId(user.id);
          fetchNotificationsList(user.id);
        }
      }
    }
    initUser();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, supabase, fetchNotificationsList]);

  // Realtime subscription for notifications
  useEffect(() => {
    if (!activeUserId) return;

    const channelTopic = `notifications-live-${activeUserId}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${activeUserId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new as InAppNotification;
            setNotifications((prev) => [newNotif, ...prev]);
            setUnreadCount((prev) => prev + 1);
            setTotalCount((prev) => prev + 1);

            // Trigger in-app toast banner
            addToast({
              type: 'info',
              title: newNotif.title || '🔔 New Notification',
              message: newNotif.body || 'You have a new update in Choir Collective.',
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as InAppNotification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
            );
            fetchNotificationsList(activeUserId);
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
            fetchNotificationsList(activeUserId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeUserId, supabase, addToast, fetchNotificationsList]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle clicking a notification item: mark as read and navigate
  const handleNotificationClick = async (notif: InAppNotification) => {
    // Optimistically mark as read
    if (!notif.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      markNotificationAsRead(notif.id).catch(console.error);
    }

    setIsOpen(false);

    if (notif.link_url) {
      router.push(notif.link_url);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || actionLoading) return;
    setActionLoading(true);

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);

    const res = await markAllNotificationsAsRead();
    setActionLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Error', message: res.error });
      fetchNotificationsList(activeUserId || undefined);
    } else {
      addToast({ type: 'success', title: '✓ All Caught Up', message: 'All notifications marked as read.' });
    }
  };

  // Delete single notification
  const handleDeleteNotification = async (e: React.MouseEvent, id: string) => {
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

  // Filtered & capped list (max 5 for premium compact dropdown)
  const filteredNotifications = useMemo(() => {
    const list = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;
    return list;
  }, [notifications, filter]);

  const displayedNotifications = useMemo(() => {
    return filteredNotifications.slice(0, 5);
  }, [filteredNotifications]);

  // Helper: Icon badge by notification type
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'thread_reaction':
      case 'comment_reaction':
        return (
          <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-xs border border-white">
            <Heart size={9} fill="currentColor" />
          </span>
        );
      case 'thread_comment':
      case 'comment_reply':
        return (
          <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-xs border border-white">
            <MessageSquare size={9} fill="currentColor" />
          </span>
        );
      case 'thread_acknowledgement_required':
      case 'minutes':
        return (
          <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs border border-white">
            <FileText size={9} />
          </span>
        );
      case 'announcement':
        return (
          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs border border-white">
            <Megaphone size={9} />
          </span>
        );
      case 'task_assigned':
        return (
          <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center shadow-xs border border-white">
            <ListTodo size={9} />
          </span>
        );
      case 'document_signature_required':
        return (
          <span className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-xs border border-white">
            <Sparkles size={9} />
          </span>
        );
      case 'dues_payment':
        return (
          <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs border border-white">
            <DollarSign size={9} />
          </span>
        );
      default:
        return (
          <span className="w-4 h-4 rounded-full bg-slate-600 text-white flex items-center justify-center shadow-xs border border-white">
            <Bell size={9} />
          </span>
        );
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* ── Bell Trigger Button with Premium Glow ── */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        className={`relative p-2 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-primary/15 text-primary scale-95 shadow-inner ring-2 ring-primary/25'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/90 active:scale-95'
        }`}
        style={{ minWidth: '38px', minHeight: '38px' }}
      >
        <Bell size={19} className={unreadCount > 0 ? 'animate-[wiggle_1.2s_ease-in-out_infinite]' : ''} />

        {/* Unread Pill Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 bg-gradient-to-r from-rose-600 to-red-500 text-white font-extrabold text-[0.62rem] rounded-full px-1.5 min-w-[17px] h-[17px] flex items-center justify-center border-2 border-white shadow-md leading-none"
            style={{ animation: 'bounce 1.2s infinite alternate' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Premium Dropdown Panel (Max 5 + See All) ── */}
      {isOpen && (
        <>
          {/* Subtle click-outside backdrop for mobile */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[1050] sm:hidden animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          <div
            ref={panelRef}
            className="absolute top-full right-0 mt-2.5 z-[1100] bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-[0_20px_45px_-10px_rgba(0,0,0,0.18)] rounded-2xl overflow-hidden flex flex-col transition-all w-[calc(100vw-32px)] max-w-[370px] sm:w-[370px] origin-top-right animate-in fade-in zoom-in-95 duration-200"
            style={{
              right: isMobile ? '-4px' : '0',
            }}
          >
            {/* Header: Title + Unread Count + Mark Read */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50/90 via-white to-slate-50/90">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900 tracking-tight">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-rose-500/10 text-rose-700 text-[0.68rem] font-black px-2 py-0.5 rounded-full border border-rose-200/50">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    disabled={actionLoading}
                    className="text-[0.7rem] text-primary hover:text-primary-hover font-bold px-2 py-1 rounded-lg hover:bg-primary/5 transition-colors inline-flex items-center gap-1 cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck size={13} />
                    <span>Mark all read</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Close notifications"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Filter Tabs: All / Unread */}
            <div className="px-3 py-1.5 border-b border-slate-100/80 bg-white/70 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filter === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                  filter === 'unread'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span>Unread</span>
                {unreadCount > 0 && (
                  <span className={`text-[0.62rem] px-1.5 py-0.2 rounded-full font-black ${
                    filter === 'unread' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Notification Items List (Max 5) */}
            <div className="overflow-y-auto overscroll-contain flex-1 divide-y divide-slate-100/80">
              {displayedNotifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shadow-inner">
                    <Bell size={20} className="opacity-60" />
                  </div>
                  <span className="font-bold text-xs text-slate-800">
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </span>
                  <p className="text-[0.7rem] text-slate-400 max-w-[210px] leading-relaxed">
                    {filter === 'unread'
                      ? "You're all caught up! Great job staying up to date."
                      : 'Reactions, comments, minutes, and tasks will appear here in real time.'}
                  </p>
                </div>
              ) : (
                displayedNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group px-3.5 py-2.5 transition-all duration-200 cursor-pointer flex items-start gap-3 relative hover:bg-emerald-50/40 ${
                      !notif.is_read
                        ? 'bg-emerald-50/30'
                        : 'bg-white/90 hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Unread Glowing Dot */}
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary absolute left-1.5 top-4 shadow-[0_0_8px_rgba(11,77,36,0.6)]" />
                    )}

                    {/* Actor Avatar with Type Badge Overlay */}
                    <div className="relative shrink-0 mt-0.5 ml-1">
                      <Avatar
                        src={notif.actor?.avatar_url}
                        name={notif.actor?.full_name || notif.title}
                        size={36}
                        className="border border-slate-200/80 shadow-2xs"
                      />
                      <div className="absolute -bottom-1 -right-1">
                        {getTypeBadge(notif.type)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="text-xs leading-snug">
                        <span className="font-extrabold text-slate-900 block mb-0.5 tracking-tight line-clamp-1">
                          {notif.title}
                        </span>
                        <span className="text-slate-600 line-clamp-2 text-[0.75rem] leading-relaxed font-normal">
                          {notif.body}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[0.66rem] text-slate-400 font-medium">
                        <span>{formatTimeAgo(notif.created_at)}</span>
                        {!notif.is_read && (
                          <>
                            <span>•</span>
                            <span className="text-primary font-extrabold">New</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete button on hover / touch */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNotification(e, notif.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0 cursor-pointer self-center"
                      title="Dismiss notification"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Premium Footer: "See All Notifications" Action Bar */}
            <div className="p-2 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between gap-2 px-3">
              <Link
                href="/notifications"
                onClick={() => setIsOpen(false)}
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-slate-100/90 border border-slate-200/80 text-primary font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] text-center"
              >
                <span>See all notifications</span>
                {totalCount > 0 && (
                  <span className="text-[0.68rem] text-slate-400 font-semibold">({totalCount})</span>
                )}
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
