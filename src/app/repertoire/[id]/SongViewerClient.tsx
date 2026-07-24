'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChordProRenderer, ChordProControls, usePersistedFontSize } from '@/components/ChordProRenderer';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SongCategory } from '@/app/admin/songs/SongForm';
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
  arranger: string | null;
  category: string | null;
  categories?: SongCategory[];
  lyrics: string | null;
}

interface SongViewerClientProps {
  currentUserProfile: Profile;
  song: Song;
}

export const SongViewerClient = ({ currentUserProfile, song }: SongViewerClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Custom states for rendering customization
  const [semitones, setSemitones] = useState(0);
  const [fontSize, setFontSize] = usePersistedFontSize('choir_chordpro_fontsize', 16);
  const [showChords, setShowChords] = useState(true);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.anim-header', { opacity: 0, y: -15 }, { opacity: 1, y: 0, duration: 0.6 });
      tl.fromTo('.anim-controls', { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3');
      tl.fromTo('.anim-lyrics', { opacity: 0 }, { opacity: 1, duration: 0.8 }, '-=0.2');
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const handleBack = () => {
    router.push('/repertoire');
  };

  const tags = song.categories && song.categories.length > 0
    ? song.categories
    : song.category
    ? [{ id: song.category, name: song.category }]
    : [];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main style={{ flex: 1, padding: '40px 20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        {/* Back navigation */}
        <button
          onClick={handleBack}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '24px',
            padding: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Repertoire
        </button>

        {/* Header card info */}
        <div className="glass-container anim-header" style={{ padding: '30px', marginBottom: '24px', opacity: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                  {tags.map((t) => (
                    <span
                      key={t.id}
                      style={{
                        display: 'inline-block',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--accent)',
                        background: 'rgba(180,83,9,0.06)',
                        padding: '3px 10px',
                        borderRadius: '99px',
                        border: '1px solid rgba(180,83,9,0.2)',
                      }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}

              <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.2 }}>
                {song.title}
              </h1>
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                {song.composer && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                    Composer: <strong style={{ color: 'var(--foreground)' }}>{song.composer}</strong>
                  </p>
                )}
                {song.arranger && (
                  <p style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                    Arranger: <strong style={{ color: 'var(--foreground)' }}>{song.arranger}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* View Customizer Controls */}
        <div className="anim-controls" style={{ opacity: 0 }}>
          <ChordProControls
            semitones={semitones}
            onSemitonesChange={setSemitones}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            showChords={showChords}
            onShowChordsChange={setShowChords}
          />
        </div>

        {/* Song Lyrics Pane */}
        <div className="glass-container anim-lyrics" style={{ padding: '40px', opacity: 0, overflowX: 'auto' }}>
          {song.lyrics ? (
            <ChordProRenderer
              lyrics={song.lyrics}
              semitones={semitones}
              fontSize={fontSize}
              showChords={showChords}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>
              No lyrics or ChordPro formatting has been entered for this song yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SongViewerClient;
