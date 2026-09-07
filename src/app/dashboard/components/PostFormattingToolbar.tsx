'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  Palette,
  Highlighter,
  ChevronDown,
} from 'lucide-react';

export type FormatType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'h1'
  | 'h2'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'hr'
  | 'color'
  | 'highlight';

interface PostFormattingToolbarProps {
  onApplyFormat: (type: FormatType, extra?: string) => void;
  className?: string;
}

const COLOR_PALETTE = [
  { name: 'Emerald', hex: '#059669' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Purple', hex: '#9333ea' },
  { name: 'Dark Slate', hex: '#0f172a' },
];

const HIGHLIGHT_PALETTE = [
  { name: 'Yellow', bg: '#fef08a' },
  { name: 'Mint Green', bg: '#a7f3d0' },
  { name: 'Peach', bg: '#fed7aa' },
  { name: 'Soft Blue', bg: '#bfdbfe' },
];

export const PostFormattingToolbar: React.FC<PostFormattingToolbarProps> = ({
  onApplyFormat,
  className = '',
}) => {
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [highlightMenuOpen, setHighlightMenuOpen] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setColorMenuOpen(false);
      }
      if (highlightRef.current && !highlightRef.current.contains(e.target as Node)) {
        setHighlightMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className={`flex items-center gap-0.5 sm:gap-1 p-1 bg-slate-50 border border-slate-200/90 rounded-2xl flex-wrap shadow-2xs ${className}`}
    >
      {/* ── Text Styling: Bold, Italic, Underline, Strike ── */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onApplyFormat('bold')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} className="stroke-[2.5]" />
        </button>

        <button
          type="button"
          onClick={() => onApplyFormat('italic')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </button>

        <button
          type="button"
          onClick={() => onApplyFormat('underline')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Underline"
        >
          <Underline size={14} />
        </button>

        <button
          type="button"
          onClick={() => onApplyFormat('strike')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Strikethrough"
        >
          <Strikethrough size={14} />
        </button>
      </div>

      <div className="w-px h-4 bg-slate-200 mx-0.5" />

      {/* ── Headings: H1, H2 ── */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onApplyFormat('h1')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Main Heading"
        >
          <Heading1 size={14} />
        </button>

        <button
          type="button"
          onClick={() => onApplyFormat('h2')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Subheading"
        >
          <Heading2 size={14} />
        </button>
      </div>

      <div className="w-px h-4 bg-slate-200 mx-0.5" />

      {/* ── Lists & Callouts: Bullet, Numbered, Quote, Divider ── */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onApplyFormat('bullet')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Bullet List"
        >
          <List size={14} />
        </button>

        <button
          type="button"
          onClick={() => onApplyFormat('numbered')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </button>

        <button
          type="button"
          onClick={() => onApplyFormat('quote')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Callout / Quote"
        >
          <Quote size={14} />
        </button>

        <button
          type="button"
          onClick={() => onApplyFormat('hr')}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
          title="Horizontal Line Divider"
        >
          <Minus size={14} />
        </button>
      </div>

      <div className="w-px h-4 bg-slate-200 mx-0.5" />

      {/* ── Text Color Picker Dropdown ── */}
      <div className="relative" ref={colorRef}>
        <button
          type="button"
          onClick={() => {
            setColorMenuOpen(!colorMenuOpen);
            setHighlightMenuOpen(false);
          }}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-0.5"
          title="Text Color"
        >
          <Palette size={14} className="text-emerald-700" />
          <ChevronDown size={10} className="text-slate-400" />
        </button>

        {colorMenuOpen && (
          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-30 flex gap-1.5 animate-in fade-in-50 zoom-in-95">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => {
                  onApplyFormat('color', c.hex);
                  setColorMenuOpen(false);
                }}
                className="w-5 h-5 rounded-full border border-black/10 hover:scale-115 transition-transform cursor-pointer shadow-2xs"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Highlight Marker Dropdown ── */}
      <div className="relative" ref={highlightRef}>
        <button
          type="button"
          onClick={() => {
            setHighlightMenuOpen(!highlightMenuOpen);
            setColorMenuOpen(false);
          }}
          className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-0.5"
          title="Highlight Text"
        >
          <Highlighter size={14} className="text-amber-600" />
          <ChevronDown size={10} className="text-slate-400" />
        </button>

        {highlightMenuOpen && (
          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-30 flex gap-1.5 animate-in fade-in-50 zoom-in-95">
            {HIGHLIGHT_PALETTE.map((h) => (
              <button
                key={h.bg}
                type="button"
                onClick={() => {
                  onApplyFormat('highlight', h.bg);
                  setHighlightMenuOpen(false);
                }}
                className="w-5 h-5 rounded-full border border-black/10 hover:scale-115 transition-transform cursor-pointer shadow-2xs"
                style={{ backgroundColor: h.bg }}
                title={h.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
