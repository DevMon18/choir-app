'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { logout } from '../actions';
import { Navbar } from '@/components/Navbar';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Song {
  id: string;
  title: string;
  composer: string | null;
  category: string | null;
  lyrics: string | null;
}

interface RepertoireClientProps {
  currentUserProfile: Profile;
  songs: Song[];
  query: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  SATB: '#0b4d24',
  Gospel: '#7c3aed',
  Contemporary: '#059669',
  Traditional: '#b45309',
  Liturgical: '#dc2626',
  Advent: '#6366f1',
  Easter: '#0ea5e9',
  Christmas: '#dc2626',
};

export const RepertoireClient = ({ currentUserProfile, songs, query: initialQuery }: RepertoireClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.content-anim-item', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Debounced URL sync
  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) params.set('q', searchValue);
        router.replace(`/repertoire${searchValue ? `?${params}` : ''}`);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchValue]);

  const isAdmin = ['super_admin', 'director', 'secretary'].includes(currentUserProfile.role);

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, padding: '48px 20px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Page header */}
        <div className="content-anim-item" style={{ opacity: 0, marginBottom: '36px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
            Song Repertoire
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
            Browse and search the choir's full song library
          </p>
        </div>

        {/* Search */}
        <div className="content-anim-item" style={{ opacity: 0, marginBottom: '28px', position: 'relative', maxWidth: '480px' }}>
          <svg
            width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="var(--muted)" strokeWidth="2"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="9" cy="9" r="7" /><path strokeLinecap="round" d="m15 15 4 4" />
          </svg>
          <input
            type="search"
            className="input-field"
            placeholder="Search songs, composers, lyrics…"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            style={{ paddingLeft: '42px', opacity: isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}
            aria-label="Search songs"
          />
        </div>

        {/* Song grid */}
        {songs.length === 0 ? (
          <div className="glass-container content-anim-item" style={{ textAlign: 'center', padding: '60px 20px', opacity: 0 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3" />
            </svg>
            <p style={{ color: 'var(--muted)', fontSize: '1.05rem' }}>
              {initialQuery ? `No songs found for "${initialQuery}"` : 'No songs in the repertoire yet.'}
            </p>
            {isAdmin && !initialQuery && (
              <Link href="/admin/songs" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>
                Add the first song
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {songs.map((song, i) => {
              const color = CATEGORY_COLORS[song.category ?? ''] ?? 'var(--primary)';
              return (
                <Link
                  key={song.id}
                  href={`/repertoire/${song.id}`}
                  className="glass-container content-anim-item"
                  style={{
                    opacity: 0,
                    padding: '24px',
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    animationDelay: `${i * 0.04}s`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = 'var(--hover-shadow)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                  }}
                >
                  {song.category && (
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color,
                      background: `${color}12`,
                      padding: '3px 8px',
                      borderRadius: '99px',
                      marginBottom: '10px',
                      border: `1px solid ${color}30`,
                    }}>
                      {song.category}
                    </span>
                  )}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '6px', lineHeight: 1.3 }}>
                    {song.title}
                  </h3>
                  {song.composer && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{song.composer}</p>
                  )}
                  <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: 600 }}>
                    {song.lyrics ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        ChordPro lyrics
                      </>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>No lyrics yet</span>
                    )}
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

export default RepertoireClient;
