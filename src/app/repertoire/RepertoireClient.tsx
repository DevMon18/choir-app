'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SongCategory } from '@/app/admin/songs/SongForm';
import { CategoryItem } from '@/app/admin/categories/actions';
import { Tag } from 'lucide-react';
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
  categories?: SongCategory[];
  lyrics: string | null;
}

interface RepertoireClientProps {
  currentUserProfile: Profile;
  songs: Song[];
  availableCategories: CategoryItem[];
  query: string;
  categoriesParam?: string;
}

export const RepertoireClient = ({
  currentUserProfile,
  songs,
  availableCategories = [],
  query: initialQuery,
  categoriesParam = '',
}: RepertoireClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState(initialQuery);

  // Selected category IDs for filtering
  const initialSelectedCats = categoriesParam ? categoriesParam.split(',').filter(Boolean) : [];
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>(initialSelectedCats);

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.content-anim-item', { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.06 });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  // Debounced URL sync for text search and category filter params
  useEffect(() => {
    const t = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (searchValue) params.set('q', searchValue);
        if (selectedCatIds.length > 0) params.set('categories', selectedCatIds.join(','));

        const queryString = params.toString();
        router.replace(`/repertoire${queryString ? `?${queryString}` : ''}`);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [searchValue, selectedCatIds]);

  const toggleCategoryFilter = (catId: string) => {
    setSelectedCatIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const isAdmin = ['super_admin', 'director', 'secretary'].includes(currentUserProfile.role);

  // Filter songs by selected categories
  const filteredSongs = songs.filter((song) => {
    if (selectedCatIds.length === 0) return true;
    const songCatIds = (song.categories || []).map((c) => c.id);
    // Song must match ALL selected categories (or at least one if user clicked multiple)
    return selectedCatIds.some((selectedId) => songCatIds.includes(selectedId));
  });

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, padding: '48px 20px', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
        {/* Page header */}
        <div className="content-anim-item" style={{ opacity: 0, marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>
            Song Repertoire
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>
            Browse and search the choir's full song library
          </p>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="content-anim-item" style={{ opacity: 0, marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', maxWidth: '480px' }}>
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

          {/* Category Tags Filter Row */}
          {availableCategories.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                <Tag size={14} />
                <span>Filter by tag:</span>
              </span>

              <button
                type="button"
                onClick={() => setSelectedCatIds([])}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: selectedCatIds.length === 0 ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: selectedCatIds.length === 0 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.7)',
                  color: selectedCatIds.length === 0 ? '#ffffff' : 'var(--foreground)',
                  transition: 'all 0.15s ease',
                }}
              >
                All
              </button>

              {availableCategories.map((cat) => {
                const selected = selectedCatIds.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategoryFilter(cat.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: selected ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                      background: selected ? 'rgba(30, 58, 138, 0.12)' : 'rgba(255, 255, 255, 0.7)',
                      color: selected ? 'var(--primary)' : 'var(--foreground)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Song grid */}
        {filteredSongs.length === 0 ? (
          <div className="glass-container content-anim-item" style={{ textAlign: 'center', padding: '60px 20px', opacity: 0 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zm12-3c0 1.1-1.34 2-3 2s-3-.9-3-2 1.34-2 3-2 3 .9 3 2zM9 10l12-3" />
            </svg>
            <p style={{ color: 'var(--muted)', fontSize: '1.05rem' }}>
              {searchValue || selectedCatIds.length > 0
                ? 'No songs match your search and tag filters.'
                : 'No songs in the repertoire yet.'}
            </p>
            {isAdmin && !searchValue && (
              <Link href="/admin/songs" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-block' }}>
                Add the first song
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {filteredSongs.map((song, i) => {
              const tags = song.categories && song.categories.length > 0
                ? song.categories
                : song.category
                ? [{ id: song.category, name: song.category }]
                : [];

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
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                      {tags.map((tag) => (
                        <span
                          key={tag.id}
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--primary)',
                            background: 'rgba(30,58,138,0.08)',
                            padding: '3px 9px',
                            borderRadius: '99px',
                            border: '1px solid rgba(30,58,138,0.15)',
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
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
