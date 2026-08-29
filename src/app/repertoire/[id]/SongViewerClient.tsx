'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChordProRenderer, ChordProControls, usePersistedFontSize, usePersistedFontWeight } from '@/components/ChordProRenderer';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { SongCategory } from '@/app/admin/songs/SongForm';
import { PracticeRecordings } from './PracticeRecordings';
import { PracticeRecordingItem } from './recordings-actions';
import gsap from 'gsap';

interface Profile {
  id: string;
  full_name: string;
  role: string;
  voice_part?: string | null;
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
  initialRecordings?: PracticeRecordingItem[];
}

export const SongViewerClient = ({ currentUserProfile, song, initialRecordings = [] }: SongViewerClientProps) => {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Custom states for rendering customization
  const [semitones, setSemitones] = useState(0);
  const [fontSize, setFontSize] = usePersistedFontSize('choir_chordpro_fontsize', 16);
  const [fontWeight, setFontWeight] = usePersistedFontWeight('choir_chordpro_fontweight', 500);
  const [showChords, setShowChords] = useState(true);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.anim-header', { opacity: 0, y: -15, duration: 0.6 });
      tl.from('.anim-controls', { opacity: 0, y: 15, duration: 0.5 }, '-=0.3');
      tl.from('.anim-lyrics', { opacity: 0, duration: 0.8 }, '-=0.2');
      tl.from('.anim-recordings', { opacity: 0, y: 15, duration: 0.6 }, '-=0.4');
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const tags = song.categories && song.categories.length > 0
    ? song.categories
    : song.category
    ? [{ id: song.category, name: song.category }]
    : [];

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen relative">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      <Navbar profile={currentUserProfile} />

      <main className="flex-1 py-10 px-5 max-w-[800px] mx-auto w-full">
        {/* Back navigation with Next.js prefetching */}
        <Link
          href="/repertoire"
          className="bg-transparent border-0 text-primary font-semibold text-sm no-underline inline-flex items-center gap-1.5 mb-6 py-1 hover:underline"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Repertoire
        </Link>

        {/* Header card info */}
        <div className="glass-container anim-header !p-7 mb-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {tags.map((t) => (
                    <span
                      key={t.id}
                      className="inline-block text-[0.72rem] font-bold uppercase tracking-wider text-accent bg-[#b45309]/6 py-0.5 px-2.5 rounded-full border border-[#b45309]/20"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="text-3xl font-bold text-primary leading-tight m-0">
                {song.title}
              </h1>
              
              <div className="flex gap-4 mt-2 flex-wrap">
                {song.composer && (
                  <p className="text-sm text-muted m-0">
                    Composer: <strong className="text-foreground">{song.composer}</strong>
                  </p>
                )}
                {song.arranger && (
                  <p className="text-sm text-muted m-0">
                    Arranger: <strong className="text-foreground">{song.arranger}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* View Customizer Controls */}
        <div className="anim-controls">
          <ChordProControls
            semitones={semitones}
            onSemitonesChange={setSemitones}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            fontWeight={fontWeight}
            onFontWeightChange={setFontWeight}
            showChords={showChords}
            onShowChordsChange={setShowChords}
          />
        </div>

        {/* Practice Recordings Panel (AT THE TOP, ABOVE LYRICS) */}
        <div className="anim-recordings">
          <PracticeRecordings
            songId={song.id}
            currentUserProfile={currentUserProfile}
            initialRecordings={initialRecordings}
          />
        </div>

        {/* Song Lyrics Pane */}
        <div className="glass-container anim-lyrics !p-10 overflow-x-auto">
          {song.lyrics ? (
            <ChordProRenderer
              lyrics={song.lyrics}
              semitones={semitones}
              fontSize={fontSize}
              fontWeight={fontWeight}
              showChords={showChords}
            />
          ) : (
            <div className="text-center text-muted py-10">
              No lyrics or ChordPro formatting has been entered for this song yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SongViewerClient;


