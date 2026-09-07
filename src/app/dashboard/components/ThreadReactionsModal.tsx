'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, Sparkles, Heart, ThumbsUp, Music } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ReactionType } from '../actions';

export interface ReactionDetailItem {
  id: string;
  reaction_type: ReactionType;
  member_id: string;
  member?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    role?: string;
    voice_part?: string | null;
  } | null;
}

interface ThreadReactionsModalProps {
  isOpen: boolean;
  reactions: ReactionDetailItem[];
  currentUserId: string;
  initialType?: ReactionType | 'all';
  onClose: () => void;
}

const REACTION_ICONS: Record<ReactionType, { emoji: string; label: string; activeColor: string }> = {
  like: { emoji: '👍', label: 'Like', activeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
  heart: { emoji: '❤️', label: 'Heart', activeColor: 'bg-red-50 text-red-700 border-red-200' },
  pray: { emoji: '🙏', label: 'Pray', activeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
  clap: { emoji: '👏', label: 'Clap', activeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  music: { emoji: '🎵', label: 'Music', activeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export const ThreadReactionsModal: React.FC<ThreadReactionsModalProps> = ({
  isOpen,
  reactions = [],
  currentUserId,
  initialType = 'all',
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ReactionType | 'all'>(initialType);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
    }
  }, [isOpen, initialType]);

  if (!isOpen || !mounted) return null;

  // Filtered reactions
  const filteredReactions = activeTab === 'all'
    ? reactions
    : reactions.filter((r) => r.reaction_type === activeTab);

  // Group counts
  const availableTypes = (['like', 'heart', 'pray', 'clap', 'music'] as ReactionType[]).filter((t) =>
    reactions.some((r) => r.reaction_type === t)
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 z-[1250] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[85vh] sm:max-h-[75vh] overflow-hidden animate-in slide-in-from-bottom duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg">🎉</span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  Reactions
                </h3>
                <p className="text-[0.7rem] text-slate-500">
                  {reactions.length} total {reactions.length === 1 ? 'reaction' : 'reactions'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Reaction Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({reactions.length})
            </button>

            {availableTypes.map((type) => {
              const cfg = REACTION_ICONS[type];
              const count = reactions.filter((r) => r.reaction_type === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setActiveTab(type)}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer inline-flex items-center gap-1 ${
                    activeTab === type
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{cfg.emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reactor List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 divide-y divide-slate-100">
          {filteredReactions.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs font-medium">
              No reactions in this category.
            </div>
          ) : (
            filteredReactions.map((r) => {
              const cfg = REACTION_ICONS[r.reaction_type] || { emoji: '👍', label: 'Reacted' };
              const memberName = r.member?.full_name || 'Choir Member';
              const isMe = r.member_id === currentUserId;

              return (
                <div
                  key={r.id}
                  className="pt-2 first:pt-0 flex items-center justify-between gap-3"
                >
                  <Link
                    href={isMe ? '/profile' : `/directory/${r.member_id}`}
                    className="flex items-center gap-3 min-w-0 group hover:opacity-90 cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <Avatar src={r.member?.avatar_url} name={memberName} size={36} />
                      <span className="absolute -bottom-1 -right-1 text-xs bg-white rounded-full p-0.5 shadow-2xs border border-slate-100">
                        {cfg.emoji}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate group-hover:text-primary group-hover:underline">
                          {memberName}
                        </span>
                        {isMe && (
                          <span className="text-[0.62rem] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                            You
                          </span>
                        )}
                        {r.member?.role && r.member.role !== 'member' && (
                          <span className="text-[0.58rem] font-bold px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 uppercase">
                            {r.member.role.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[0.68rem] text-slate-400 block truncate">
                        {r.member?.voice_part || 'Choir Member'}
                      </span>
                    </div>
                  </Link>

                  <span className="text-xs font-semibold text-slate-400 shrink-0">
                    {cfg.label}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
