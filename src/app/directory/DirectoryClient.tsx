'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../actions';
import { Navbar } from '@/components/Navbar';
import { Avatar } from '@/components/Avatar';
import { getOrCreateConversation } from '@/app/messages/actions';
import { useToast } from '@/components/Toast';
import { MessageSquare } from 'lucide-react';
import gsap from 'gsap';

import { useDebounce } from '@/hooks/useDebounce';
import { useClientCache } from '@/context/ClientCacheContext';
import { useDirectory } from '@/hooks/useDirectory';

interface DirectoryMember {
  id: string;
  full_name: string;
  role: string;
  voice_part: string | null;
  join_date: string | null;
  phone: string | null;       // null if private
  address: string | null;     // null if private
  avatar_url?: string | null;
}

interface Props {
  profile: { id: string; full_name: string; role: string };
  members: DirectoryMember[];
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  director: 'Director',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  member: 'Member',
};

const VOICE_COLORS: Record<string, string> = {
  Soprano: '#6366f1',
  Alto: '#7c3aed',
  Tenor: '#0ea5e9',
  Bass: '#0b4d24',
};

export const DirectoryClient = ({ profile, members: initialMembers }: Props) => {
  const { allMembers: members } = useDirectory({
    initialMembers: initialMembers as any,
  });
  const router = useRouter();
  const { addToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState('');
  const [messagingId, setMessagingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 250);

  const handleOpenConversation = async (targetId: string) => {
    if (targetId === profile.id) return;
    setMessagingId(targetId);
    try {
      const res = await getOrCreateConversation(targetId);
      if (res.error || !res.conversationId) {
        addToast({ type: 'error', title: 'Chat Error', message: res.error || 'Failed to open conversation.' });
      } else {
        router.push(`/messages/${res.conversationId}`);
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Server error' });
    } finally {
      setMessagingId(null);
    }
  };

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.anim-header', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35 });
      tl.from('.member-card', { opacity: 0, y: 14, duration: 0.35, stagger: 0.03 }, '-=0.15');
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const filtered = members.filter(m => {
    const q = debouncedSearch.toLowerCase();
    const matchSearch = !q || m.full_name.toLowerCase().includes(q) || (m.voice_part ?? '').toLowerCase().includes(q);
    const matchVoice = !voiceFilter || m.voice_part === voiceFilter;
    return matchSearch && matchVoice;
  });

  const voices = [...new Set(members.map(m => m.voice_part).filter(Boolean))];
  const isAdmin = ['super_admin', 'director', 'secretary'].includes(profile.role);

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={profile} />

      <main className="flex-1 py-10 px-4 pb-[120px] max-w-[1100px] mx-auto w-full">
        {/* Header */}
        <div className="anim-header mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-2">
            Member Directory
          </h1>
          <p className="text-muted text-sm sm:text-base">
            {members.length} members · Private contact info is hidden per member preference
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-7 flex-wrap">
          <div className="relative flex-[1_1_240px] min-w-[200px]">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="9" cy="9" r="7" /><path strokeLinecap="round" d="m15 15 4 4" />
            </svg>
            <input
              type="search"
              className="input-field pl-9 w-full"
              placeholder="Search by name or voice part…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search members"
            />
          </div>
          {voices.length > 0 && (
            <select
              className="input-field flex-[0_1_180px]"
              value={voiceFilter}
              onChange={e => setVoiceFilter(e.target.value)}
              aria-label="Filter by voice part"
            >
              <option value="">All Voice Parts</option>
              {voices.map(v => <option key={v} value={v!}>{v}</option>)}
            </select>
          )}
        </div>

        {/* Directory grid */}
        {filtered.length === 0 ? (
          <div className="glass-container text-center py-15 px-5">
            <div className="text-4xl mb-3">👤</div>
            <p className="text-muted">{search ? `No members match "${search}"` : 'No members found.'}</p>
          </div>
        ) : (
          <div className="directory-grid grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {filtered.map((m) => {
              const voiceColor = VOICE_COLORS[m.voice_part ?? ''] ?? 'var(--primary)';
              return (
                <div
                  key={m.id}
                  className="member-card glass-container p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Avatar rendering — 40px circle matching IG/FB list standards */}
                  <Link href={`/directory/${m.id}`} className="no-underline flex items-center gap-3 mb-3">
                    <Avatar
                      src={m.avatar_url}
                      name={m.full_name}
                      size={40}
                      border
                    />
                    <div className="overflow-hidden">
                      <div className="font-semibold text-primary text-[15px] whitespace-nowrap overflow-hidden text-ellipsis">
                        {m.full_name}
                      </div>
                      <div className="text-[13px] text-muted capitalize">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </div>
                    </div>
                  </Link>

                  {/* Voice part */}
                  {m.voice_part && (
                    <span
                      className="inline-block text-[11px] font-bold uppercase tracking-wider py-0.5 px-2 rounded-full mb-2.5"
                      style={{
                        color: voiceColor,
                        backgroundColor: `${voiceColor}12`,
                        border: `1px solid ${voiceColor}30`,
                      }}
                    >
                      {m.voice_part}
                    </span>
                  )}

                  {/* Contact info (if not private) */}
                  <div className="text-[13px] text-muted flex flex-col gap-1">
                    {m.phone && (
                      <div className="flex items-center gap-1.5">
                        <span>📞</span>
                        <a href={`tel:${m.phone}`} className="text-primary no-underline font-medium">{m.phone}</a>
                      </div>
                    )}
                    {m.join_date && (
                      <div className="text-muted">
                        Joined {new Date(m.join_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {/* Direct Message Action Button */}
                  {m.id !== profile.id && (
                    <button
                      onClick={() => handleOpenConversation(m.id)}
                      disabled={messagingId !== null}
                      className="btn btn-secondary mt-3 w-full !py-1.5 !px-3 text-xs sm:text-[0.82rem] rounded-lg inline-flex items-center justify-center gap-1.5"
                    >
                      <MessageSquare size={14} />
                      {messagingId === m.id ? 'Opening…' : 'Message'}
                    </button>
                  )}

                  {/* Admin actions */}
                  {isAdmin && (
                    <div className="mt-3 pt-2.5 border-t border-glass-border">
                      <Link href={`/admin/roster`} className="text-[13px] text-primary font-semibold no-underline">
                        Manage in Roster →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default DirectoryClient;
