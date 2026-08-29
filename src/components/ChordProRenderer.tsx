'use client';

import React, { useEffect, useMemo, useState } from 'react';

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

// High-legibility modern monospace font stack with clear letterforms and thick stroke options
const MONOSPACE_FONT_FAMILY =
  'ui-monospace, "JetBrains Mono", "SF Mono", "Fira Code", "Roboto Mono", Consolas, "Courier New", monospace';

// ---------------------------------------------------------------------------
// ChordPro parser
// Converts a ChordPro line into an exact monospace chordLine and lyricLine
// without splitting words or inserting artificial spaces inside lyrics.
// ---------------------------------------------------------------------------

interface ParsedLine {
  chordLine: string;
  lyricLine: string;
  hasChords: boolean;
}

const processChordProLine = (line: string, semitones: number): ParsedLine => {
  let lyricLine = '';
  let chordLine = '';
  let hasChords = false;

  let lyricPos = 0;
  let chordPos = 0;

  // Regex matches bracketed chords [Gb] or lyric segments
  const re = /\[([^\]]*)\]|([^\[]+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    if (match[1] !== undefined) {
      // Bracketed chord: e.g. [Gb], [Bbm], [F#m7]
      const rawChord = match[1];
      if (rawChord.trim()) {
        hasChords = true;
        const transposed = transposeChord(rawChord.trim(), semitones);

        // Position chord at Math.max(lyricPos, chordPos) in the monospace grid
        const targetPos = Math.max(lyricPos, chordPos);
        while (chordLine.length < targetPos) {
          chordLine += ' ';
        }

        chordLine += transposed;
        chordPos = chordLine.length + 1; // Keep at least 1 space before next chord
      }
    } else if (match[2] !== undefined) {
      // Plain lyric text segment
      const text = match[2];
      lyricLine += text;
      lyricPos += text.length;
    }
  }

  // Pad chordLine if lyricLine is longer for clean alignment
  while (chordLine.length < lyricLine.length) {
    chordLine += ' ';
  }

  return { chordLine, lyricLine, hasChords };
};

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface ChordProRendererProps {
  lyrics: string;
  semitones?: number;         // -6 to +6
  fontSize?: number;          // px
  fontWeight?: number;        // 600 (Semi-Bold), 700 (Bold), 800 (Extra Bold)
  showChords?: boolean;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export const ChordProRenderer = ({
  lyrics,
  semitones = 0,
  fontSize = 16,
  fontWeight = 500,
  showChords = true,
}: ChordProRendererProps) => {
  const lines = lyrics.split('\n');

  // Check if any line in this song actually contains chords
  const songHasChords = useMemo(() => {
    return /\[[A-G][#b]?[^\]]*\]/.test(lyrics);
  }, [lyrics]);

  const shouldUseMonospace = showChords && songHasChords;

  return (
    <div
      style={{
        fontFamily: shouldUseMonospace
          ? MONOSPACE_FONT_FAMILY
          : 'var(--font-sans), system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: `${fontSize}px`,
        lineHeight: shouldUseMonospace ? 1.55 : 1.7,
        letterSpacing: shouldUseMonospace ? 'normal' : '0.01em',
        whiteSpace: 'pre-wrap',
        overflowX: 'auto',
      }}
    >
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        // Blank line — spacer
        if (trimmed === '') {
          return <div key={lineIdx} style={{ height: `${fontSize * 1.1}px` }} />;
        }

        // ChordPro directive lines like {comment: Verse 1} — render as section label
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const label = trimmed.slice(1, -1).replace(/^(comment|soc|eoc|start_of_chorus|end_of_chorus|verse):?\s*/i, '');
          return (
            <div
              key={lineIdx}
              style={{
                fontSize: `${fontSize * 0.78}px`,
                fontWeight: 750,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: `${fontSize * 0.9}px`,
                marginBottom: `${fontSize * 0.35}px`,
                fontFamily: 'var(--font-sans), system-ui, sans-serif',
              }}
            >
              {label}
            </div>
          );
        }

        // Regular lyric/chord line parsed via monospace character alignment
        const { chordLine, lyricLine, hasChords } = processChordProLine(line, semitones);

        return (
          <div key={lineIdx} style={{ marginBottom: hasChords && showChords ? '8px' : '4px' }}>
            {/* Chord row */}
            {hasChords && showChords && (
              <div
                style={{
                  fontFamily: MONOSPACE_FONT_FAMILY,
                  fontSize: `${fontSize}px`,
                  fontWeight: Math.min(900, fontWeight + 200),
                  color: 'var(--primary)',
                  whiteSpace: 'pre',
                  lineHeight: 1.25,
                  overflowX: 'auto',
                }}
              >
                {chordLine}
              </div>
            )}

            {/* Lyric row */}
            <div
              style={{
                fontFamily: shouldUseMonospace
                  ? MONOSPACE_FONT_FAMILY
                  : 'inherit',
                fontSize: `${fontSize}px`,
                fontWeight: fontWeight,
                color: 'var(--foreground)',
                whiteSpace: 'pre-wrap',
                lineHeight: shouldUseMonospace ? 1.35 : 1.6,
                wordBreak: 'break-word',
              }}
            >
              {lyricLine || '\u00a0'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Controls bar — transposition + font size + boldness weight (exported separately)
// ---------------------------------------------------------------------------

interface ChordProControlsProps {
  semitones: number;
  onSemitonesChange: (s: number) => void;
  fontSize: number;
  onFontSizeChange: (s: number) => void;
  fontWeight?: number;
  onFontWeightChange?: (w: number) => void;
  showChords: boolean;
  onShowChordsChange: (v: boolean) => void;
  storageKey?: string;
}

export const ChordProControls = ({
  semitones,
  onSemitonesChange,
  fontSize,
  onFontSizeChange,
  fontWeight = 600,
  onFontWeightChange,
  showChords,
  onShowChordsChange,
}: ChordProControlsProps) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        padding: '12px 18px',
        background: 'rgba(255,255,255,0.75)',
        borderRadius: '14px',
        border: '1px solid var(--glass-border)',
        backdropFilter: 'blur(8px)',
        marginBottom: '20px',
      }}
    >
      {/* Transpose */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          KEY
        </span>
        <button
          type="button"
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
            fontSize: '0.92rem',
          }}
        >
          {semitones === 0 ? 'Original' : semitones > 0 ? `+${semitones}` : semitones}
        </span>
        <button
          type="button"
          onClick={() => onSemitonesChange(Math.min(6, semitones + 1))}
          style={controlBtnStyle}
          aria-label="Transpose up one semitone"
        >
          ♯+
        </button>
        {semitones !== 0 && (
          <button
            type="button"
            onClick={() => onSemitonesChange(0)}
            style={{ ...controlBtnStyle, color: 'var(--muted)', fontSize: '0.7rem' }}
            aria-label="Reset transposition"
          >
            Reset
          </button>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '22px', background: 'var(--glass-border)' }} />

      {/* Font size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SIZE</span>
        <button
          type="button"
          onClick={() => onFontSizeChange(Math.max(12, fontSize - 2))}
          style={controlBtnStyle}
          aria-label="Decrease font size"
        >
          A−
        </button>
        <span style={{ minWidth: '32px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>
          {fontSize}px
        </span>
        <button
          type="button"
          onClick={() => onFontSizeChange(Math.min(32, fontSize + 2))}
          style={controlBtnStyle}
          aria-label="Increase font size"
        >
          A+
        </button>
      </div>

      {/* Font Weight / Boldness */}
      {onFontWeightChange && (
        <>
          {/* Divider */}
          <div style={{ width: '1px', height: '22px', background: 'var(--glass-border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>BOLD</span>
            <button
              type="button"
              onClick={() => onFontWeightChange(Math.max(500, fontWeight - 100))}
              style={controlBtnStyle}
              aria-label="Decrease font boldness"
              title="Thinner lyrics text"
            >
              B−
            </button>
            <span
              style={{
                minWidth: '28px',
                textAlign: 'center',
                fontSize: '0.92rem',
                color: 'var(--primary)',
                fontWeight: fontWeight,
                fontFamily: 'serif',
                userSelect: 'none',
              }}
              title={`Current weight: ${fontWeight}`}
            >
              B
            </span>
            <button
              type="button"
              onClick={() => onFontWeightChange(Math.min(900, fontWeight + 100))}
              style={controlBtnStyle}
              aria-label="Increase font boldness"
              title="Bolder lyrics text"
            >
              B+
            </button>
          </div>
        </>
      )}

      {/* Divider */}
      <div style={{ width: '1px', height: '22px', background: 'var(--glass-border)' }} />

      {/* Chords toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
        <input
          type="checkbox"
          checked={showChords}
          onChange={(e) => onShowChordsChange(e.target.checked)}
          style={{ accentColor: 'var(--primary)', width: '16px', height: '16px', cursor: 'pointer' }}
        />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--muted)' }}>Show Chords</span>
      </label>
    </div>
  );
};

const controlBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: '8px',
  border: '1px solid var(--glass-border)',
  background: 'rgba(255,255,255,0.85)',
  cursor: 'pointer',
  fontSize: '0.82rem',
  fontWeight: 700,
  color: 'var(--primary)',
  transition: 'all 0.15s ease',
};

// ---------------------------------------------------------------------------
// Hooks: persist font size & weight in localStorage
// ---------------------------------------------------------------------------

export const usePersistedFontSize = (key: string, defaultSize = 16) => {
  const [fontSize, setFontSize] = useState(defaultSize);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 12 && n <= 32) setFontSize(n);
    }
  }, [key]);

  const updateFontSize = (size: number) => {
    setFontSize(size);
    localStorage.setItem(key, String(size));
  };

  return [fontSize, updateFontSize] as const;
};

export const usePersistedFontWeight = (key: string, defaultWeight = 500) => {
  const [fontWeight, setFontWeight] = useState(defaultWeight);

  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 400 && n <= 900) setFontWeight(n);
    }
  }, [key]);

  const updateFontWeight = (weight: number) => {
    setFontWeight(weight);
    localStorage.setItem(key, String(weight));
  };

  return [fontWeight, updateFontWeight] as const;
};

export default ChordProRenderer;
