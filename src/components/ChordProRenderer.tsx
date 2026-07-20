'use client';

import React, { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Music theory helpers
// ---------------------------------------------------------------------------

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const noteToIndex = (note: string): number => {
  let idx = SHARP_NOTES.indexOf(note);
  if (idx !== -1) return idx;
  idx = FLAT_NOTES.indexOf(note);
  return idx;
};

// Matches a root note + optional modifier (m, maj7, sus4, etc.)
const CHORD_REGEX = /^([A-G][#b]?)(.*)/;

const transposeChord = (chord: string, semitones: number): string => {
  const match = chord.match(CHORD_REGEX);
  if (!match) return chord;

  const [, root, suffix] = match;
  const idx = noteToIndex(root);
  if (idx === -1) return chord;

  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  // Prefer flats for negative transposition, sharps for positive
  const newRoot = semitones < 0 ? FLAT_NOTES[newIdx] : SHARP_NOTES[newIdx];
  return newRoot + suffix;
};

// ---------------------------------------------------------------------------
// ChordPro parser
// Each token on a line is either a { chord, lyric } pair or a plain lyric.
// ---------------------------------------------------------------------------

interface Token {
  chord: string;
  lyric: string;
}

const parseLine = (line: string): Token[] => {
  const tokens: Token[] = [];
  // Match [Chord]lyric pairs or trailing text
  const re = /\[([^\]]*)\]([^\[]*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Handle any text before the first chord
  const firstBracket = line.indexOf('[');
  if (firstBracket > 0) {
    tokens.push({ chord: '', lyric: line.slice(0, firstBracket) });
    lastIndex = firstBracket;
  }

  while ((match = re.exec(line)) !== null) {
    tokens.push({ chord: match[1], lyric: match[2] });
    lastIndex = re.lastIndex;
  }

  // Trailing text with no chord
  if (lastIndex < line.length && firstBracket === -1) {
    tokens.push({ chord: '', lyric: line.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ chord: '', lyric: line }];
};

const isChordLine = (tokens: Token[]): boolean =>
  tokens.some((t) => t.chord !== '');

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ChordProRendererProps {
  lyrics: string;
  semitones?: number;         // -6 to +6
  fontSize?: number;          // px
  showChords?: boolean;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export const ChordProRenderer = ({
  lyrics,
  semitones = 0,
  fontSize = 16,
  showChords = true,
}: ChordProRendererProps) => {
  const lines = lyrics.split('\n');

  return (
    <div
      style={{
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: `${fontSize}px`,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
      }}
    >
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Blank line — spacer
        if (trimmed === '') {
          return <div key={lineIdx} style={{ height: `${fontSize * 1.6}px` }} />;
        }

        // ChordPro directive lines like {comment: Verse 1} — render as section label
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const label = trimmed.slice(1, -1).replace(/^(comment|soc|eoc|start_of_chorus|end_of_chorus|verse):?\s*/i, '');
          return (
            <div
              key={lineIdx}
              style={{
                fontSize: `${fontSize * 0.8}px`,
                fontWeight: 700,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: `${fontSize}px`,
                marginBottom: `${fontSize * 0.25}px`,
                fontFamily: 'var(--font-sans)',
              }}
            >
              {label}
            </div>
          );
        }

        // Regular lyric/chord line
        const tokens = parseLine(line);
        const hasChords = isChordLine(tokens);

        return (
          <div key={lineIdx} style={{ marginBottom: hasChords && showChords ? 0 : 2 }}>
            {/* Chord row */}
            {hasChords && showChords && (
              <div style={{ display: 'flex', flexWrap: 'nowrap', color: 'var(--primary)', fontWeight: 700 }}>
                {tokens.map((token, i) => {
                  const chord = token.chord
                    ? transposeChord(token.chord, semitones)
                    : '';
                  // Width matches the lyric segment so chords align above text
                  const lyricWidth = token.lyric.length || 1;
                  return (
                    <span
                      key={i}
                      style={{
                        minWidth: `${Math.max(chord.length, lyricWidth) * 0.6}em`,
                        paddingRight: '0.3em',
                        display: 'inline-block',
                      }}
                    >
                      {chord}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Lyric row */}
            <div style={{ display: 'flex', flexWrap: 'nowrap', color: 'var(--foreground)' }}>
              {tokens.map((token, i) => {
                const chord = token.chord
                  ? transposeChord(token.chord, semitones)
                  : '';
                const lyricWidth = token.lyric.length || 1;
                return (
                  <span
                    key={i}
                    style={{
                      minWidth: showChords
                        ? `${Math.max(chord.length, lyricWidth) * 0.6}em`
                        : undefined,
                      paddingRight: '0.3em',
                      display: 'inline-block',
                    }}
                  >
                    {token.lyric || '\u00a0'}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Controls bar — transposition + font size (exported separately for reuse)
// ---------------------------------------------------------------------------

interface ChordProControlsProps {
  semitones: number;
  onSemitonesChange: (s: number) => void;
  fontSize: number;
  onFontSizeChange: (s: number) => void;
  showChords: boolean;
  onShowChordsChange: (v: boolean) => void;
  storageKey?: string;
}

export const ChordProControls = ({
  semitones,
  onSemitonesChange,
  fontSize,
  onFontSizeChange,
  showChords,
  onShowChordsChange,
}: ChordProControlsProps) => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const baseKey = NOTE_NAMES[0]; // display relative shift

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
        padding: '12px 20px',
        background: 'rgba(255,255,255,0.7)',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(8px)',
        marginBottom: '24px',
      }}
    >
      {/* Transpose */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          KEY
        </span>
        <button
          onClick={() => onSemitonesChange(Math.max(-6, semitones - 1))}
          style={controlBtnStyle}
          aria-label="Transpose down one semitone"
        >
          ♭−
        </button>
        <span
          style={{
            minWidth: '32px',
            textAlign: 'center',
            fontWeight: 700,
            color: 'var(--primary)',
            fontSize: '0.95rem',
          }}
        >
          {semitones === 0 ? 'Original' : semitones > 0 ? `+${semitones}` : semitones}
        </span>
        <button
          onClick={() => onSemitonesChange(Math.min(6, semitones + 1))}
          style={controlBtnStyle}
          aria-label="Transpose up one semitone"
        >
          ♯+
        </button>
        {semitones !== 0 && (
          <button
            onClick={() => onSemitonesChange(0)}
            style={{ ...controlBtnStyle, color: 'var(--muted)', fontSize: '0.7rem' }}
            aria-label="Reset transposition"
          >
            Reset
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)' }} />

      {/* Font size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)' }}>SIZE</span>
        <button
          onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))}
          style={controlBtnStyle}
          aria-label="Decrease font size"
        >
          A−
        </button>
        <span style={{ minWidth: '32px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
          {fontSize}px
        </span>
        <button
          onClick={() => onFontSizeChange(Math.min(30, fontSize + 2))}
          style={controlBtnStyle}
          aria-label="Increase font size"
        >
          A+
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)' }} />

      {/* Chords toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={showChords}
          onChange={(e) => onShowChordsChange(e.target.checked)}
          style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted)' }}>Show Chords</span>
      </label>
    </div>
  );
};

const controlBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.8)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--primary)',
  transition: 'background 0.15s',
};

// ---------------------------------------------------------------------------
// Hook: persist font size in localStorage
// ---------------------------------------------------------------------------

export const usePersistedFontSize = (key: string, defaultSize = 16) => {
  const [fontSize, setFontSize] = useState(defaultSize);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 12 && n <= 30) setFontSize(n);
    }
  }, [key]);

  const updateFontSize = (size: number) => {
    setFontSize(size);
    localStorage.setItem(key, String(size));
  };

  return [fontSize, updateFontSize] as const;
};

export default ChordProRenderer;
