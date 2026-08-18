'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: AvatarSize;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  border?: boolean | string;
  shadow?: boolean;
  voicePart?: string | null;
  badge?: React.ReactNode;
}

const SIZE_MAP: Record<string, { px: number; textClass: string; fontSize: string }> = {
  xs: { px: 28, textClass: 'text-xs', fontSize: '0.75rem' },
  sm: { px: 36, textClass: 'text-sm', fontSize: '0.85rem' },
  md: { px: 44, textClass: 'text-base', fontSize: '1rem' },
  lg: { px: 56, textClass: 'text-lg', fontSize: '1.25rem' },
  xl: { px: 72, textClass: 'text-xl', fontSize: '1.6rem' },
  '2xl': { px: 88, textClass: 'text-2xl', fontSize: '2rem' },
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  style = {},
  priority = false,
  border = false,
  shadow = false,
  voicePart,
  badge,
}) => {
  const [imageError, setImageError] = useState(false);

  let dimension = 44;
  let fontSize = '1rem';

  if (typeof size === 'number') {
    dimension = size;
    fontSize = `${Math.max(12, Math.round(size * 0.4))}px`;
  } else if (SIZE_MAP[size]) {
    dimension = SIZE_MAP[size].px;
    fontSize = SIZE_MAP[size].fontSize;
  }

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : '?';

  let borderStyle = '';
  if (typeof border === 'string') {
    borderStyle = border;
  } else if (border) {
    borderStyle = '2px solid var(--border)';
  }

  const hasValidImage = Boolean(src) && !imageError;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full overflow-hidden flex-shrink-0 select-none ${className}`}
      style={{
        width: `${dimension}px`,
        height: `${dimension}px`,
        minWidth: `${dimension}px`,
        minHeight: `${dimension}px`,
        background: hasValidImage ? 'var(--card-bg)' : 'linear-gradient(135deg, rgba(30,58,138,0.12) 0%, rgba(197,160,89,0.18) 100%)',
        border: borderStyle || undefined,
        boxShadow: shadow ? '0 4px 12px rgba(0,0,0,0.1)' : undefined,
        ...style,
      }}
      aria-label={name ? `${name}'s avatar` : 'User avatar'}
    >
      {hasValidImage ? (
        <Image
          src={src!}
          alt={name ? `${name}'s profile picture` : 'Avatar'}
          fill
          sizes={`${dimension}px`}
          priority={priority}
          style={{ objectFit: 'cover' }}
          onError={() => setImageError(true)}
        />
      ) : (
        <span
          style={{
            fontSize,
            fontWeight: 700,
            color: 'var(--primary)',
            lineHeight: 1,
          }}
        >
          {initial}
        </span>
      )}

      {badge && (
        <div className="absolute bottom-0 right-0 z-10">
          {badge}
        </div>
      )}
    </div>
  );
};
