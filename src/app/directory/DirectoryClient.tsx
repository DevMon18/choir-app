'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { logout } from '../actions';
import { Navbar } from '@/components/Navbar';
import { getOrCreateConversation } from '@/app/messages/actions';
import { useToast } from '@/components/Toast';
import { MessageSquare } from 'lucide-react';
import gsap from 'gsap';

import { useDebounce } from '@/hooks/useDebounce';

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

export const DirectoryClient = ({ profile, members }: Props) => {
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
      tl.fromTo('.anim-header', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.5 });
      tl.fromTo('.member-card', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 }, '-=0.2');
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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={profile} />

      <main style={{ flex: 1, padding: '40px 16px 120px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div className="anim-header" style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
            Member Directory
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
            {members.length} members · Private contact info is hidden per member preference
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="9" cy="9" r="7" /><path strokeLinecap="round" d="m15 15 4 4" />
            </svg>
            <input
              type="search"
              className="input-field"
              placeholder="Search by name or voice part…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', width: '100%' }}
              aria-label="Search members"
            />
          </div>
          {voices.length > 0 && (
            <select
              className="input-field"
              value={voiceFilter}
              onChange={e => setVoiceFilter(e.target.value)}
              style={{ flex: '0 1 180px' }}
              aria-label="Filter by voice part"
            >
              <option value="">All Voice Parts</option>
              {voices.map(v => <option key={v} value={v!}>{v}</option>)}
            </select>
          )}
        </div>

        {/* Directory grid */}
        {filtered.length === 0 ? (
          <div className="glass-container" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>👤</div>
            <p style={{ color: 'var(--muted)' }}>{search ? `No members match "${search}"` : 'No members found.'}</p>
          </div>
        ) : (
          <div
            className="directory-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}
          >
            {filtered.map((m) => {
              const voiceColor = VOICE_COLORS[m.voice_part ?? ''] ?? 'var(--primary)';
              return (
                <div
                  key={m.id}
                  className="member-card glass-container"
                  style={{ padding: '16px 20px', opacity: 0, transition: 'transform 0.2s, box-shadow 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                >
                  {/* Avatar rendering — 40px circle matching IG/FB list standards */}
                  <Link href={`/directory/${m.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: m.avatar_url ? 'none' : `linear-gradient(135deg, ${voiceColor}, ${voiceColor}99)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 600, fontSize: '0.95rem', flexShrink: 0,
                      overflow: 'hidden',
                      border: m.avatar_url ? '1px solid var(--glass-border)' : 'none'
                    }}>
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt={m.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        m.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.full_name}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', textTransform: 'capitalize' }}>
                        {ROLE_LABELS[m.role] ?? m.role}
                      </div>
                    </div>
                  </Link>

                  {/* Voice part */}
                  {m.voice_part && (
                    <span style={{
                      display: 'inline-block', fontSize: '11px', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: voiceColor, background: `${voiceColor}12`,
                      padding: '2px 8px', borderRadius: '99px', marginBottom: '10px',
                      border: `1px solid ${voiceColor}30`,
                    }}>
                      {m.voice_part}
                    </span>
                  )}

                  {/* Contact info (if not private) */}
                  <div style={{ fontSize: '13px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {m.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>📞</span>
                        <a href={`tel:${m.phone}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{m.phone}</a>
                      </div>
                    )}
                    {m.join_date && (
                      <div style={{ color: 'var(--muted)' }}>
                        Joined {new Date(m.join_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {/* Direct Message Action Button */}
                  {m.id !== profile.id && (
                    <button
                      onClick={() => handleOpenConversation(m.id)}
                      disabled={messagingId === m.id}
                      className="btn btn-secondary"
                      style={{
                        marginTop: '12px',
                        width: '100%',
                        padding: '6px 12px',
                        fontSize: '0.82rem',
                        borderRadius: '8px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <MessageSquare size={14} />
                      {messagingId === m.id ? 'Opening…' : 'Message'}
                    </button>
                  )}

                  {/* Admin actions */}
                  {isAdmin && (
                    <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)' }}>
                      <Link href={`/admin/roster`} style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
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
