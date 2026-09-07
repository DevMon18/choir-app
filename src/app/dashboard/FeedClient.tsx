'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import { ThreadComposeBox } from './components/ThreadComposeBox';
import { ThreadPostCard } from './components/ThreadPostCard';
import { ThreadCommentsDrawer } from './components/ThreadCommentsDrawer';
import { ThreadAcknowledgementModal } from './components/ThreadAcknowledgementModal';
import { ThreadPostData, getThreadPosts, toggleAnnouncementAcknowledgement } from './actions';
import {
  Radio,
  Sparkles,
  Pin,
  Image as ImageIcon,
  Lock,
  RefreshCw,
  Search,
  User,
  Megaphone,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Users,
  Loader2,
} from 'lucide-react';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useToast } from '@/components/Toast';
import gsap from 'gsap';

interface MemberOption {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  voice_part?: string | null;
}

export interface AnnouncementFeedItem {
  id: string;
  title: string;
  body: string;
  priority: string;
  acknowledgements?: Array<{ id: string; member_id: string; acknowledged_at: string }>;
}

interface FeedClientProps {
  initialPosts: ThreadPostData[];
  currentUserProfile: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    voice_part?: string | null;
    avatar_url?: string | null;
    created_at?: string;
  };
  members: MemberOption[];
  announcements?: AnnouncementFeedItem[];
}

export const FeedClient: React.FC<FeedClientProps> = ({
  initialPosts = [],
  currentUserProfile,
  members = [],
  announcements = [],
}) => {
  const [posts, setPosts] = useState<ThreadPostData[]>(initialPosts);
  const [announcementList, setAnnouncementList] = useState<AnnouncementFeedItem[]>(announcements);
  const [ackModalAnnouncementId, setAckModalAnnouncementId] = useState<string | null>(null);
  const [acknowledgingAnnouncementId, setAcknowledgingAnnouncementId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'minutes' | 'pinned' | 'media' | 'anonymous'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeCommentPost, setActiveCommentPost] = useState<ThreadPostData | null>(null);

  const { addToast } = useToast();
  const isOfficer = ['super_admin', 'director', 'secretary', 'treasurer'].includes(currentUserProfile.role);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Keep announcementList in sync when props change
  useEffect(() => {
    setAnnouncementList(announcements);
  }, [announcements]);

  const handleToggleAnnouncementAck = async (announcementId: string) => {
    if (acknowledgingAnnouncementId) return;
    setAcknowledgingAnnouncementId(announcementId);

    // Optimistic toggle
    setAnnouncementList((prev) =>
      prev.map((a) => {
        if (a.id !== announcementId) return a;
        const currentAcks = a.acknowledgements || [];
        const hasAcked = currentAcks.some((x) => x.member_id === currentUserProfile.id);
        const updatedAcks = hasAcked
          ? currentAcks.filter((x) => x.member_id !== currentUserProfile.id)
          : [
              ...currentAcks,
              {
                id: `temp-${Date.now()}`,
                member_id: currentUserProfile.id,
                acknowledged_at: new Date().toISOString(),
              },
            ];
        return { ...a, acknowledgements: updatedAcks };
      })
    );

    const res = await toggleAnnouncementAcknowledgement(announcementId);
    setAcknowledgingAnnouncementId(null);

    if (res?.error) {
      addToast({ type: 'error', title: 'Action Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: res?.action === 'acknowledged' ? '✓ Acknowledged' : 'Acknowledgement Removed',
        message:
          res?.action === 'acknowledged'
            ? 'You have acknowledged this announcement.'
            : 'Your acknowledgement was removed.',
      });
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        containerRef.current.querySelectorAll('.anim-feed-item'),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.35, stagger: 0.05, ease: 'power2.out' }
      );
    }
  }, [posts.length, filter]);

  const reloadFeed = async () => {
    setLoading(true);
    const res = await getThreadPosts({ filter: filter === 'all' ? undefined : filter });
    setLoading(false);
    if (!res.error && res.data) {
      setPosts(res.data);
    }
  };

  useEffect(() => {
    reloadFeed();
  }, [filter]);

  // Realtime subscription for thread posts & reactions
  useRealtimeSync({
    channelName: 'thread-feed-realtime',
    tables: [
      { table: 'thread_posts' },
      { table: 'thread_reactions' },
      { table: 'thread_acknowledgements' },
      { table: 'thread_comments' },
    ],
    onEvent: () => {
      reloadFeed();
    },
  });

  // Filter and search posts locally
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filter === 'minutes' && post.category !== 'minutes' && !post.content.toUpperCase().includes('MINUTES OF THE MEETING')) return false;
      if (filter === 'pinned' && !post.is_pinned) return false;
      if (filter === 'media' && (!post.media || post.media.length === 0)) return false;
      if (filter === 'anonymous' && !post.is_anonymous) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const contentMatch = post.content.toLowerCase().includes(q);
        const authorMatch = post.author?.full_name?.toLowerCase().includes(q);
        if (!contentMatch && !authorMatch) return false;
      }

      return true;
    });
  }, [posts, filter, searchQuery]);

  const handleCommentCountChange = (postId: string, newCount: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comments_count: newCount } : p))
    );
  };

  return (
    <div className="page-shell">
      <Navbar profile={currentUserProfile as any} />

      <main className="page-container !pt-3 sm:!pt-6 !pb-28 sm:!pb-16" ref={containerRef}>
        <div className="max-w-[720px] mx-auto flex flex-col gap-4 sm:gap-5">

          {/* Top Quick Profile & Announcement Strip */}
          <div className="flex items-center justify-between gap-3 bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar
                src={currentUserProfile.avatar_url}
                name={currentUserProfile.full_name}
                size={36}
                className="shrink-0"
              />
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                  Welcome, {currentUserProfile.full_name.split(' ')[0]}!
                </span>
                <span className="text-[0.68rem] text-slate-400 capitalize">
                  {currentUserProfile.voice_part || currentUserProfile.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            <Link
              href="/profile"
              className="btn btn-secondary !py-1.5 !px-3 text-xs font-bold inline-flex items-center gap-1.5 shrink-0 shadow-2xs hover:bg-slate-100 transition-colors"
            >
              <User size={13} />
              <span className="hidden sm:inline">My Profile &amp; Stats</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Announcements Banner if any */}
          {announcementList.length > 0 && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/90 shadow-2xs flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5 shadow-xs">
                  <Megaphone size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      📌 {announcementList[0].title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAckModalAnnouncementId(announcementList[0].id)}
                      className="text-[0.68rem] text-amber-800 hover:text-amber-950 font-extrabold underline underline-offset-2 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Users size={12} />
                      <span>
                        {(announcementList[0].acknowledgements || []).length} Acknowledged
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-amber-800/90 mt-1 leading-relaxed font-medium">
                    {announcementList[0].body}
                  </p>
                </div>
              </div>

              {/* Announcement Action Strip */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/70 flex-wrap">
                <span className="text-[0.68rem] text-amber-800/80 font-medium">
                  Please read and confirm that you have noted this notice.
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleAnnouncementAck(announcementList[0].id)}
                  disabled={acknowledgingAnnouncementId === announcementList[0].id}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    (announcementList[0].acknowledgements || []).some(
                      (a) => a.member_id === currentUserProfile.id
                    )
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {acknowledgingAnnouncementId === announcementList[0].id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  <span>
                    {(announcementList[0].acknowledgements || []).some(
                      (a) => a.member_id === currentUserProfile.id
                    )
                      ? 'Acknowledged ✓'
                      : 'Acknowledge'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Compose Thread Box */}
          <div className="anim-feed-item">
            <ThreadComposeBox
              currentUserProfile={currentUserProfile}
              members={members}
              onPostCreated={reloadFeed}
            />
          </div>

          {/* Toolbar: Filter Pills & Search */}
          <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap border-b border-slate-200/70 pb-3 pt-1">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  filter === 'all'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Sparkles size={13} />
                <span>All Feed</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('minutes')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  filter === 'minutes'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                }`}
              >
                <span>📋 Minutes</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('pinned')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  filter === 'pinned'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Pin size={13} />
                <span>Pinned</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('media')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  filter === 'media'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <ImageIcon size={13} />
                <span>Media &amp; GIFs</span>
              </button>

              <button
                type="button"
                onClick={() => setFilter('anonymous')}
                className={`py-1.5 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                  filter === 'anonymous'
                    ? 'bg-slate-900 text-amber-300 shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Lock size={13} />
                <span>Anonymous</span>
              </button>
            </div>

            {/* Right: Search & Refresh */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
              <div className="relative flex-1 sm:w-44">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search feed…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={reloadFeed}
                disabled={loading}
                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                title="Refresh feed"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
              </button>
            </div>
          </div>

          {/* Timeline Posts Feed */}
          <div className="flex flex-col gap-4">
            {filteredPosts.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-2xs flex flex-col items-center gap-3">
                <Radio size={36} className="text-slate-300 stroke-[1.5]" />
                <h3 className="text-sm font-bold text-slate-800">No threads found</h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {searchQuery
                    ? `No posts matched "${searchQuery}". Try different keywords.`
                    : 'Be the first to start a conversation, share a song inspiration, or drop a message!'}
                </p>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <div key={post.id} className="anim-feed-item">
                  <ThreadPostCard
                    post={post}
                    currentUserProfile={currentUserProfile}
                    onOpenComments={(p) => setActiveCommentPost(p)}
                    onPostUpdated={reloadFeed}
                  />
                </div>
              ))
            )}
          </div>

        </div>
      </main>

      {/* Thread Comments Bottom Sheet Drawer */}
      <ThreadCommentsDrawer
        isOpen={!!activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
        post={activeCommentPost}
        currentUserProfile={currentUserProfile}
        onCommentCountChange={handleCommentCountChange}
      />

      {/* Announcement Acknowledgement Roster Modal */}
      {ackModalAnnouncementId && (
        <ThreadAcknowledgementModal
          isOpen={!!ackModalAnnouncementId}
          announcementId={ackModalAnnouncementId}
          title="Announcement Acknowledgements"
          isOfficer={isOfficer}
          onClose={() => setAckModalAnnouncementId(null)}
        />
      )}
    </div>
  );
};

export default FeedClient;
