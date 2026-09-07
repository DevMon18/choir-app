'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Sparkles, Loader2, ImageOff } from 'lucide-react';

interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
}

const KLIPY_API_KEY =
  process.env.NEXT_PUBLIC_KLIPY_API_KEY ||
  'h26saC4d4kLgI13g2pn4nQeTwZiN3JIn021kPLlLzNuVSTweDGyKXXn0jdCLNLDP';

const FEATURED_CATEGORIES = [
  { label: 'Singing & Choir', query: 'choir singing' },
  { label: 'Praise & Amen', query: 'praise amen' },
  { label: 'Applause & Bravo', query: 'applause bravo' },
  { label: 'Celebration', query: 'celebrate happy' },
  { label: 'Music & Vibes', query: 'music worship' },
  { label: 'Church & Sunday', query: 'church sunday' },
  { label: 'Hype & Dance', query: 'hype dance' },
];

const CURATED_FALLBACK_GIFS = [
  'https://media.giphy.com/media/l41lZxzroU33typuU/giphy.gif',
  'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif',
  'https://media.giphy.com/media/26gsjCZpPolPr3sBy/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
  'https://media.giphy.com/media/3o7TKDkDbIDJieKbVm/giphy.gif',
  'https://media.giphy.com/media/26u4cqiYI30juCOGY/giphy.gif',
  'https://media.giphy.com/media/3o7TKsWZBZX21vYnqu/giphy.gif',
  'https://media.giphy.com/media/l2Je2M4Nfrit0L7sQ/giphy.gif',
  'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif',
  'https://media.giphy.com/media/xT0xezQGU5xCDJuCPe/giphy.gif',
  'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
];

export const GifPickerModal: React.FC<GifPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectGif,
}) => {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchGifs = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      let endpoint = '';
      if (query && query.trim()) {
        endpoint = `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/search?q=${encodeURIComponent(
          query.trim()
        )}&limit=30`;
      } else {
        endpoint = `https://api.klipy.com/api/v1/${KLIPY_API_KEY}/gifs/trending?limit=30`;
      }

      const res = await fetch(endpoint);
      if (res.ok) {
        const json = await res.json();
        const items = json?.data?.data || json?.data || [];
        const extractedUrls: string[] = items
          .map((item: any) => {
            return (
              item.file?.hd?.gif?.url ||
              item.file?.md?.gif?.url ||
              item.file?.sm?.gif?.url ||
              item.file?.gif?.url ||
              item.url
            );
          })
          .filter(Boolean);

        if (extractedUrls.length > 0) {
          setGifs(extractedUrls);
        } else {
          setGifs(CURATED_FALLBACK_GIFS);
        }
      } else {
        setGifs(CURATED_FALLBACK_GIFS);
      }
    } catch (err) {
      console.error('Error fetching Klipy GIFs:', err);
      setGifs(CURATED_FALLBACK_GIFS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSearchQuery('');
    setSelectedCategory(null);
    fetchGifs();
  }, [isOpen, fetchGifs]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSelectedCategory(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchGifs(val);
    }, 350);
  };

  const handleCategoryClick = (cat: { label: string; query: string }) => {
    setSelectedCategory(cat.label);
    setSearchQuery(cat.query);
    fetchGifs(cat.query);
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-[520px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] h-[600px] animate-in fade-in zoom-in-95 duration-150 z-10">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 rounded-xl bg-purple-100 text-purple-700 shrink-0">
              <Sparkles size={16} />
            </span>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                Choose a GIF
              </h3>
              <span className="text-[0.65rem] text-slate-400 font-medium">
                Powered by KLIPY
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar & Category Filter */}
        <div className="p-3 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/40 shrink-0">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search all GIFs on KLIPY…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/10 transition-all"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  fetchGifs();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {FEATURED_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.label;
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[0.68rem] font-bold border transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* GIF Gallery Grid */}
        <div className="p-3 overflow-y-auto flex-1 no-scrollbar overscroll-contain">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400 font-medium flex flex-col items-center justify-center gap-2.5">
              <Loader2 size={24} className="animate-spin text-purple-600" />
              <span>Finding best GIFs…</span>
            </div>
          ) : gifs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <ImageOff size={28} className="text-slate-300 stroke-[1.5]" />
              <span className="text-xs font-semibold text-slate-600">No GIFs found</span>
              <span className="text-[0.72rem] text-slate-400">
                Try searching for something else like choir, celebrate, or praise!
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gifs.map((url, idx) => (
                <button
                  key={`${url}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelectGif(url);
                    onClose();
                  }}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-purple-600 hover:scale-[1.02] transition-all cursor-pointer shadow-2xs focus:outline-none"
                >
                  <img
                    src={url}
                    alt="GIF"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-purple-950/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="bg-white/95 backdrop-blur-xs text-purple-700 px-2.5 py-0.5 rounded-full text-[0.68rem] font-black shadow-sm">
                      Select
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

