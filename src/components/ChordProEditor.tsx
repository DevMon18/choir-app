'use client';

import React, { useState, useRef, useCallback } from 'react';
import { ChordProRenderer } from './ChordProRenderer';
import {
  Sparkles,
  Eye,
  Edit3,
  HelpCircle,
  Wand2,
  CornerDownRight,
  Plus,
  Music,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ChordProEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  label?: string;
  showPreviewInitially?: boolean;
}

// Quick common chords for liturgical music
const COMMON_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const COMMON_MINORS = ['Am', 'Em', 'Dm', 'Bm', 'F#m', 'C#m', 'G#m'];
const COMMON_SEVENTHS = ['C7', 'D7', 'G7', 'A7', 'E7', 'B7', 'F7', 'Cmaj7', 'Gmaj7', 'Fmaj7', 'Dmaj7'];
const COMMON_OTHERS = ['Dsus4', 'Gsus4', 'Asus4', 'Csus4', 'Bdim', 'D/F#', 'G/B', 'C/E', 'F/A'];

const SECTION_DIRECTIVES = [
  { label: 'Intro', directive: '{comment: Intro}\n' },
  { label: 'Verse 1', directive: '{comment: Verse 1}\n' },
  { label: 'Verse 2', directive: '{comment: Verse 2}\n' },
  { label: 'Verse 3', directive: '{comment: Verse 3}\n' },
  { label: 'Chorus', directive: '{comment: Chorus}\n' },
  { label: 'Refrain', directive: '{comment: Refrain}\n' },
  { label: 'Bridge', directive: '{comment: Bridge}\n' },
  { label: 'Instrumental', directive: '{comment: Instrumental}\n' },
  { label: 'Outro', directive: '{comment: Outro}\n' },
];

/**
 * Detects whether a string line is primarily chords (e.g. "G   D/F#   Em7   C")
 */
function isChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Ignore lines that are already ChordPro directives
  if (trimmed.startsWith('{') || trimmed.startsWith('#')) return false;

  // Split line by whitespace
  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 0) return false;

  // Regex matching valid chords like G, D/F#, Em7, Asus4, C#m, Bbmaj7, etc.
  const chordRegex = /^[A-G][#b]?(m|min|maj|M|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(\/[A-G][#b]?)?$/;
  let chordMatches = 0;

  for (const token of tokens) {
    const cleanToken = token.replace(/[(),:;]/g, '');
    if (chordRegex.test(cleanToken)) {
      chordMatches++;
    }
  }

  // If at least 70% of tokens look like chords, treat as a chord line
  return chordMatches / tokens.length >= 0.7;
}

/**
 * Converts standard chords-over-lyrics text (like Ultimate Guitar sheets) to ChordPro format.
 */
function convertChordsOverLyricsToChordPro(input: string): string {
  const lines = input.split('\n');
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const currentLine = lines[i];

    if (isChordLine(currentLine) && i + 1 < lines.length && !isChordLine(lines[i + 1]) && lines[i + 1].trim() !== '') {
      // Current line is chords, next line is lyrics! Merge them.
      const lyricLine = lines[i + 1];
      const chordMatches: Array<{ chord: string; index: number }> = [];

      // Find all chords with their column positions in currentLine
      const chordTokenRegex = /([A-G][#b]?(?:m|min|maj|M|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(?:\/[A-G][#b]?)?)/g;
      let match;
      while ((match = chordTokenRegex.exec(currentLine)) !== null) {
        chordMatches.push({
          chord: match[1],
          index: match.index,
        });
      }

      // Sort in reverse column order so inserting brackets doesn't alter upcoming indices
      chordMatches.sort((a, b) => b.index - a.index);

      let merged = lyricLine;
      for (const item of chordMatches) {
        const insertIdx = Math.min(item.index, merged.length);
        merged = merged.slice(0, insertIdx) + `[${item.chord}]` + merged.slice(insertIdx);
      }

      result.push(merged);
      i++; // Skip the next line since we merged it
    } else if (isChordLine(currentLine)) {
      // Standalone chord line (e.g. Intro or chords only)
      // Wrap each chord token in brackets
      const chordTokenRegex = /([A-G][#b]?(?:m|min|maj|M|dim|aug|sus|add|2|4|5|6|7|9|11|13)*(?:\/[A-G][#b]?)?)/g;
      const bracketed = currentLine.replace(chordTokenRegex, '[$1]');
      result.push(bracketed);
    } else {
      result.push(currentLine);
    }
  }

  return result.join('\n');
}

export const ChordProEditor = ({
  value,
  onChange,
  placeholder = '{comment: Verse 1}\n[G]Amazing [D]grace, how [Em]sweet the [C]sound\n[G]That saved a [D]wretch like [G]me',
  minHeight = '220px',
  rows = 12,
  disabled = false,
  required = false,
  id = 'chordpro-editor',
  label = 'Lyrics & Chords (ChordPro Format)',
  showPreviewInitially = false,
}: ChordProEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>(
    showPreviewInitially ? 'preview' : 'edit'
  );
  const [customChord, setCustomChord] = useState('');
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [convertedNotice, setConvertedNotice] = useState(false);
  const [activeChordCategory, setActiveChordCategory] = useState<'roots' | 'minors' | '7ths' | 'others'>('roots');

  // Preview Transpose State
  const [previewSemitones, setPreviewSemitones] = useState(0);
  const [previewFontSize, setPreviewFontSize] = useState(14);

  /**
   * Insert text or chord into textarea at cursor or wrap selected text
   */
  const insertAtCursor = useCallback(
    (insertion: string, isChord: boolean = false) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(value ? `${value}\n${insertion}` : insertion);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      let newText = '';
      let newCursorPos = start;

      if (isChord) {
        // e.g. insertion is "G" -> format as [G]
        const formattedChord = `[${insertion}]`;
        if (selectedText) {
          // Wrap/prefix selected text with chord
          newText = value.substring(0, start) + formattedChord + selectedText + value.substring(end);
          newCursorPos = start + formattedChord.length + selectedText.length;
        } else {
          newText = value.substring(0, start) + formattedChord + value.substring(end);
          newCursorPos = start + formattedChord.length;
        }
      } else {
        // Directive or generic text
        newText = value.substring(0, start) + insertion + value.substring(end);
        newCursorPos = start + insertion.length;
      }

      onChange(newText);

      // Restore focus and cursor position smoothly
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 10);
    },
    [value, onChange]
  );

  /**
   * Wrap current selection in custom brackets [ ]
   */
  const wrapSelectionWithBrackets = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);

    let newText = '';
    let newCursorPos = start + 1;

    if (selectedText) {
      newText = value.substring(0, start) + `[${selectedText}]` + value.substring(end);
      newCursorPos = start + selectedText.length + 2;
    } else {
      newText = value.substring(0, start) + '[]' + value.substring(end);
      newCursorPos = start + 1; // Cursor inside the brackets
    }

    onChange(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  /**
   * Auto-convert chords above lyrics into ChordPro brackets
   */
  const handleSmartConvert = () => {
    if (!value.trim()) return;
    const converted = convertChordsOverLyricsToChordPro(value);
    onChange(converted);
    setConvertedNotice(true);
    setTimeout(() => setConvertedNotice(false), 3500);
  };

  const handleCustomChordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customChord.trim().replace(/[\[\]]/g, '');
    if (clean) {
      insertAtCursor(clean, true);
      setCustomChord('');
    }
  };

  const displayedChords =
    activeChordCategory === 'roots'
      ? COMMON_ROOTS
      : activeChordCategory === 'minors'
      ? COMMON_MINORS
      : activeChordCategory === '7ths'
      ? COMMON_SEVENTHS
      : COMMON_OTHERS;

  return (
    <div className="flex flex-col gap-2 w-full text-foreground">
      {/* Top Header Row with Tabs and Help */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="input-label !mb-0 font-bold flex items-center gap-1.5 text-xs sm:text-sm">
          <Music size={15} className="text-primary" />
          <span>{label}</span>
          {required && <span className="text-error">*</span>}
        </label>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Smart Auto-Converter Button */}
          <button
            type="button"
            onClick={handleSmartConvert}
            title="Automatically detect chords written above lyrics and convert them to [Chord] tags"
            className="btn btn-secondary !py-1 !px-2.5 !text-[0.72rem] font-bold flex items-center gap-1 border-amber-500/30 text-amber-900 bg-amber-500/10 hover:bg-amber-500/20"
          >
            <Wand2 size={12} className="text-amber-600" />
            <span>Auto-Convert 2-Line Chords</span>
          </button>

          {/* Help / Cheat Sheet Toggle */}
          <button
            type="button"
            onClick={() => setShowCheatSheet(!showCheatSheet)}
            className="btn btn-secondary !py-1 !px-2 !text-[0.72rem] font-semibold flex items-center gap-1 text-muted"
            title="Toggle ChordPro format cheatsheet"
          >
            <HelpCircle size={12} />
            <span>Guide</span>
            {showCheatSheet ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Mode Switcher */}
          <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 border-0 cursor-pointer ${
                activeTab === 'edit'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'bg-transparent text-muted hover:text-foreground'
              }`}
            >
              <Edit3 size={12} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 border-0 cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-white text-primary shadow-xs font-bold'
                  : 'bg-transparent text-muted hover:text-foreground'
              }`}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Auto-converted toast notification */}
      {convertedNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <Check size={14} className="text-emerald-600 flex-shrink-0" />
          <span>Chords were automatically converted into ChordPro format! Check the live preview.</span>
        </div>
      )}

      {/* Collapsible Cheat Sheet Guide */}
      {showCheatSheet && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 animate-in fade-in duration-150 flex flex-col gap-2">
          <div className="font-bold text-primary flex items-center gap-1">
            <Sparkles size={13} />
            <span>ChordPro Formatting Cheatsheet</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[0.76rem] leading-relaxed">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <strong className="text-foreground block mb-1">1. Inline Chords in Brackets:</strong>
              <code className="bg-slate-100 px-1 py-0.5 rounded text-primary font-mono block">
                [G]Grace how [D]sweet the [Em]sound
              </code>
              <span className="text-muted text-[0.7rem] mt-1 block">
                Chords appear directly above that syllable when singing.
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200">
              <strong className="text-foreground block mb-1">2. Section Directives:</strong>
              <code className="bg-slate-100 px-1 py-0.5 rounded text-accent font-mono block">
                {`{comment: Verse 1}`} or {`{comment: Chorus}`}
              </code>
              <span className="text-muted text-[0.7rem] mt-1 block">
                Highlights sections with clean colored headers.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Formatting Toolbar (Only in Edit mode) */}
      {activeTab === 'edit' && (
        <div className="bg-slate-50/90 border border-slate-200/90 rounded-xl p-2.5 flex flex-col gap-2 shadow-xs">
          {/* Row 1: Section Directive Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[0.68rem] font-extrabold text-muted uppercase tracking-wider flex-shrink-0 mr-1">
              Sections:
            </span>
            {SECTION_DIRECTIVES.map((sec) => (
              <button
                key={sec.label}
                type="button"
                onClick={() => insertAtCursor(sec.directive)}
                disabled={disabled}
                className="px-2 py-0.5 rounded-md text-[0.72rem] font-bold bg-white text-slate-700 border border-slate-200 hover:border-accent hover:text-accent hover:bg-amber-50/50 transition-colors flex-shrink-0 cursor-pointer shadow-2xs"
              >
                +{sec.label}
              </button>
            ))}
          </div>

          {/* Row 2: Chord Palette Categories & Insertion */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
            {/* Chord Category Selector */}
            <div className="flex items-center gap-1">
              <span className="text-[0.68rem] font-extrabold text-muted uppercase tracking-wider mr-1">
                Chords:
              </span>
              {(
                [
                  { id: 'roots', label: 'Major' },
                  { id: 'minors', label: 'Minor' },
                  { id: '7ths', label: '7ths' },
                  { id: 'others', label: 'Slash/Sus' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveChordCategory(cat.id)}
                  className={`px-2 py-0.5 rounded text-[0.68rem] font-bold border-0 cursor-pointer transition-colors ${
                    activeChordCategory === cat.id
                      ? 'bg-primary text-white'
                      : 'bg-slate-200/70 text-slate-600 hover:bg-slate-300/70'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Custom Chord Inserter & [ ] Wrapper */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={wrapSelectionWithBrackets}
                title="Wrap selected text in [ ] or insert empty brackets"
                className="px-2.5 py-0.5 rounded text-[0.75rem] font-mono font-bold bg-white border border-slate-300 hover:border-primary text-primary cursor-pointer shadow-2xs"
              >
                [ ]
              </button>

              <form onSubmit={handleCustomChordSubmit} className="flex items-center gap-1">
                <input
                  type="text"
                  value={customChord}
                  onChange={(e) => setCustomChord(e.target.value)}
                  placeholder="Custom (e.g. F#m7)"
                  disabled={disabled}
                  className="w-24 sm:w-28 px-2 py-0.5 text-xs rounded border border-slate-200 bg-white font-mono focus:border-primary outline-none"
                />
                <button
                  type="submit"
                  disabled={!customChord.trim() || disabled}
                  className="px-2 py-0.5 rounded text-xs font-bold bg-primary text-white border-0 hover:bg-primary-hover disabled:opacity-40 cursor-pointer"
                  title="Insert custom chord"
                >
                  <Plus size={13} />
                </button>
              </form>
            </div>
          </div>

          {/* Row 3: Chord Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {displayedChords.map((chord) => (
              <button
                key={chord}
                type="button"
                onClick={() => insertAtCursor(chord, true)}
                disabled={disabled}
                className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-white text-primary border border-primary/20 hover:bg-primary hover:text-white hover:border-primary transition-all flex-shrink-0 cursor-pointer shadow-2xs active:scale-95"
                title={`Insert [${chord}] at cursor`}
              >
                [{chord}]
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor Main Content Area */}
      {activeTab === 'edit' ? (
        <div className="relative">
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            rows={rows}
            placeholder={placeholder}
            style={{ minHeight }}
            className="input-field w-full font-mono text-xs sm:text-sm leading-relaxed resize-y bg-white border-slate-300 focus:border-primary shadow-2xs"
          />
          <div className="flex items-center justify-between text-[0.7rem] text-muted mt-1 px-1">
            <span>
              💡 Tip: Click any chord above to insert it at your cursor, or highlight words to wrap them with a chord.
            </span>
            <span className="font-mono">{value.length} chars</span>
          </div>
        </div>
      ) : (
        /* Live Preview Container */
        <div className="flex flex-col gap-2">
          {/* Live Preview Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-[0.7rem] font-bold text-muted uppercase">Transpose Key:</span>
              <button
                type="button"
                onClick={() => setPreviewSemitones((s) => Math.max(-6, s - 1))}
                className="px-2 py-0.5 rounded text-xs font-bold bg-white border border-slate-200 hover:border-primary text-primary cursor-pointer"
              >
                ♭−
              </button>
              <span className="text-xs font-mono font-bold text-primary min-w-[28px] text-center">
                {previewSemitones === 0 ? 'Original' : previewSemitones > 0 ? `+${previewSemitones}` : previewSemitones}
              </span>
              <button
                type="button"
                onClick={() => setPreviewSemitones((s) => Math.min(6, s + 1))}
                className="px-2 py-0.5 rounded text-xs font-bold bg-white border border-slate-200 hover:border-primary text-primary cursor-pointer"
              >
                ♯+
              </button>
              {previewSemitones !== 0 && (
                <button
                  type="button"
                  onClick={() => setPreviewSemitones(0)}
                  className="text-[0.68rem] text-muted hover:underline ml-1 bg-transparent border-0 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[0.7rem] font-bold text-muted uppercase">Size:</span>
              <button
                type="button"
                onClick={() => setPreviewFontSize((f) => Math.max(11, f - 1))}
                className="px-2 py-0.5 rounded text-xs font-bold bg-white border border-slate-200 hover:border-primary text-primary cursor-pointer"
              >
                A−
              </button>
              <span className="text-xs font-mono font-bold text-slate-700 min-w-[24px] text-center">
                {previewFontSize}px
              </span>
              <button
                type="button"
                onClick={() => setPreviewFontSize((f) => Math.min(22, f + 1))}
                className="px-2 py-0.5 rounded text-xs font-bold bg-white border border-slate-200 hover:border-primary text-primary cursor-pointer"
              >
                A+
              </button>
            </div>
          </div>

          {/* Rendered Preview Box */}
          <div
            style={{ minHeight }}
            className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 overflow-y-auto max-h-[380px]"
          >
            {value.trim() ? (
              <ChordProRenderer
                lyrics={value}
                semitones={previewSemitones}
                fontSize={previewFontSize}
                showChords={true}
              />
            ) : (
              <div className="text-center py-12 text-muted text-xs">
                No lyrics typed yet. Switch to the <strong>Edit</strong> tab to write chords and lyrics.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChordProEditor;
