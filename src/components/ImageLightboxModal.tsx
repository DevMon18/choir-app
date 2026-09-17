'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react';

export interface LightboxImage {
  url: string;
  alt?: string;
  caption?: string;
}

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: LightboxImage[];
  initialIndex?: number;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex = 0,
}) => {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
    }
  }, [isOpen, initialIndex, images.length]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handlePrev, handleNext]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;

    if (diff > 50) {
      // Swipe left -> Next
      handleNext();
    } else if (diff < -50) {
      // Swipe right -> Previous
      handlePrev();
    }

    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  if (!isOpen || !mounted || images.length === 0) return null;

  const currentImage = images[currentIndex] || images[0];

  return createPortal(
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-[999999] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 sm:p-5 select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Header Control Bar */}
      <div className="flex justify-between items-center z-[100] w-full py-1.5 px-2">
        <div className="flex items-center gap-2">
          {images.length > 1 && (
            <span className="text-white/80 bg-white/10 px-2.5 py-1 rounded-full text-xs font-bold tracking-wider">
              {currentIndex + 1} / {images.length}
            </span>
          )}
          {currentImage.caption && (
            <span className="text-white/90 text-xs sm:text-sm font-semibold truncate max-w-[200px] sm:max-w-md">
              {currentImage.caption}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <a
            href={currentImage.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open Original Image"
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <ExternalLink size={16} />
          </a>

          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        className="relative flex-1 flex items-center justify-center py-2 min-h-0"
        onClick={onClose}
      >
        {/* Previous Navigation Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            title="Previous (Left Arrow)"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-[100] bg-black/60 hover:bg-black/85 border border-white/20 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full cursor-pointer flex items-center justify-center backdrop-blur-sm transition-all shadow-xl active:scale-95"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* The Fullscreen Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentImage.url}
          alt={currentImage.alt || 'Full screen preview'}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-200"
        />

        {/* Next Navigation Button */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            title="Next (Right Arrow)"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-[100] bg-black/60 hover:bg-black/85 border border-white/20 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full cursor-pointer flex items-center justify-center backdrop-blur-sm transition-all shadow-xl active:scale-95"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Hint on Mobile */}
      <div className="text-center py-1 text-[0.7rem] text-white/50">
        Tap outside or press Esc to close · Swipe to navigate
      </div>
    </div>,
    document.body
  );
};
