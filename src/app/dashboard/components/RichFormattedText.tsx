'use client';

import React from 'react';

interface RichFormattedTextProps {
  content: string;
  className?: string;
}

export const RichFormattedText: React.FC<RichFormattedTextProps> = ({
  content,
  className = '',
}) => {
  if (!content) return null;

  // Split into lines
  const rawLines = content.split('\n');

  // Render inline formatting: bold, italic, underline, strike, mark, span colors
  const renderInline = (text: string): React.ReactNode => {
    if (!text) return null;

    // Replace color spans/tags, marks, bolds, italics, underlines, strikes
    // We can use a regex tokenizer or DOMParser for safe inline parsing
    const parts: React.ReactNode[] = [];
    
    // Pattern that catches:
    // 1. <span style="color:...">text</span>
    // 2. <mark ...>text</mark>
    // 3. <u>text</u> or __text__
    // 4. **text** or <b>text</b> or <strong>text</strong>
    // 5. *text* or <i>text</i> or <em>text</em>
    // 6. ~~text~~ or <del>text</del>
    // 7. [color=...]text[/color]
    const regex = /(<span\s+style="color:\s*([^"]+)">([\s\S]*?)<\/span>|<mark(?:\s+style="background:\s*([^"]+)")?>([\s\S]*?)<\/mark>|<u>([\s\S]*?)<\/u>|__([\s\S]*?)__|<b>([\s\S]*?)<\/b>|<strong>([\s\S]*?)<\/strong>|\*\*([\s\S]*?)\*\*|<i>([\s\S]*?)<\/i>|<em>([\s\S]*?)<\/em>|\*([\s\S]*?)\*|~~([\s\S]*?)~~|<del>([\s\S]*?)<\/del>|\[color=([^\]]+)\]([\s\S]*?)\[\/color\])/gi;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const [
        fullMatch,
        spanMatch, spanColor, spanText,
        markStyle, markText,
        uText, uUnderlineText,
        bText, strongText, boldText,
        iText, emText, italicText,
        strikeText, delText,
        bracketColor, bracketText,
      ] = match;

      const key = `inline-${match.index}-${Math.random()}`;

      if (spanMatch && spanText) {
        parts.push(
          <span key={key} style={{ color: spanColor }} className="font-semibold">
            {renderInline(spanText)}
          </span>
        );
      } else if (markText) {
        parts.push(
          <mark
            key={key}
            style={{ background: markStyle || '#fef08a', color: '#854d0e' }}
            className="px-1 py-0.2 rounded-md font-medium"
          >
            {renderInline(markText)}
          </mark>
        );
      } else if (uText || uUnderlineText) {
        parts.push(
          <u key={key} className="underline underline-offset-2">
            {renderInline(uText || uUnderlineText)}
          </u>
        );
      } else if (bText || strongText || boldText) {
        parts.push(
          <strong key={key} className="font-extrabold text-slate-900">
            {renderInline(bText || strongText || boldText)}
          </strong>
        );
      } else if (iText || emText || italicText) {
        parts.push(
          <em key={key} className="italic text-slate-700">
            {renderInline(iText || emText || italicText)}
          </em>
        );
      } else if (strikeText || delText) {
        parts.push(
          <del key={key} className="line-through text-slate-400">
            {renderInline(strikeText || delText)}
          </del>
        );
      } else if (bracketText && bracketColor) {
        parts.push(
          <span key={key} style={{ color: bracketColor }} className="font-semibold">
            {renderInline(bracketText)}
          </span>
        );
      } else {
        parts.push(fullMatch);
      }

      lastIndex = match.index + fullMatch.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`space-y-1.5 text-xs sm:text-sm text-slate-800 leading-relaxed break-words ${className}`}>
      {rawLines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <div key={idx} className="h-2" />;
        }

        // Horizontal Line Divider (--- or ***)
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          return <hr key={idx} className="my-3 border-t border-slate-200/90" />;
        }

        // H1 Heading (# Heading)
        if (trimmed.startsWith('# ')) {
          const title = trimmed.replace(/^#\s+/, '');
          return (
            <h1
              key={idx}
              className="text-sm sm:text-base font-black text-slate-900 pt-3 pb-1 border-b border-slate-200/80 tracking-tight"
            >
              {renderInline(title)}
            </h1>
          );
        }

        // H2 Heading (## Subheading)
        if (trimmed.startsWith('## ')) {
          const title = trimmed.replace(/^##\s+/, '');
          return (
            <h2
              key={idx}
              className="text-xs sm:text-sm font-black text-primary pt-2.5 pb-0.5 tracking-tight flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              <span>{renderInline(title)}</span>
            </h2>
          );
        }

        // H3 Heading (### Section)
        if (trimmed.startsWith('### ')) {
          const title = trimmed.replace(/^###\s+/, '');
          return (
            <h3 key={idx} className="text-xs font-bold text-slate-800 pt-2 pb-0.5">
              {renderInline(title)}
            </h3>
          );
        }

        // Blockquote (> Quote)
        if (trimmed.startsWith('> ')) {
          const quote = trimmed.replace(/^>\s+/, '');
          return (
            <div
              key={idx}
              className="my-1.5 pl-3 py-1.5 border-l-3 border-primary bg-primary/5 rounded-r-xl text-xs sm:text-sm text-slate-800 italic"
            >
              {renderInline(quote)}
            </div>
          );
        }

        // Bullet List (- Item, * Item, • Item)
        if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const itemText = trimmed.replace(/^[•\-\*]\s*/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 sm:pl-3 my-0.5">
              <span className="text-primary font-bold text-xs shrink-0 select-none">•</span>
              <span className="flex-1 font-medium">{renderInline(itemText)}</span>
            </div>
          );
        }

        // Numbered List (1. Item, 2. Item)
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          const num = numberedMatch[1];
          const itemText = numberedMatch[2];
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 sm:pl-3 my-0.5">
              <span className="text-primary font-bold text-xs font-mono shrink-0 select-none">{num}.</span>
              <span className="flex-1 font-medium">{renderInline(itemText)}</span>
            </div>
          );
        }

        // Auto-detect uppercase Meeting Minutes Section Headings if written plainly
        const isHeaderLike =
          trimmed.length > 3 &&
          trimmed.length < 60 &&
          (trimmed.toUpperCase() === trimmed ||
            trimmed.endsWith(':') ||
            trimmed.startsWith('New Officers') ||
            trimmed.startsWith('Financial & Budget Matters') ||
            trimmed.startsWith('Planned Sources of Income') ||
            trimmed.startsWith('Practices & Schedules') ||
            trimmed.startsWith('Next Practice'));

        if (isHeaderLike && !trimmed.includes('. ')) {
          return (
            <div
              key={idx}
              className="font-extrabold text-slate-900 text-xs sm:text-sm pt-2 pb-0.5 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block shrink-0" />
              <span>{renderInline(trimmed)}</span>
            </div>
          );
        }

        // Standard Paragraph line
        return (
          <p key={idx} className="my-0.5 font-medium leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
};
