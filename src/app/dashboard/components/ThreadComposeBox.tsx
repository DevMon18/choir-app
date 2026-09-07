'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  AtSign,
  Send,
  X,
  Lock,
  Globe,
  Loader2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { createThreadPost, ThreadMediaItem } from '../actions';
import { PostFormattingToolbar, FormatType } from './PostFormattingToolbar';
import { GifPickerModal } from './GifPickerModal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/Toast';

interface MemberOption {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  voice_part?: string | null;
}

interface ThreadComposeBoxProps {
  currentUserProfile: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
    role: string;
    voice_part?: string | null;
  };
  members?: MemberOption[];
  onPostCreated?: () => void;
}

export const ThreadComposeBox: React.FC<ThreadComposeBoxProps> = ({
  currentUserProfile,
  members = [],
  onPostCreated,
}) => {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [category, setCategory] = useState<'general' | 'minutes' | 'announcement' | 'repertoire' | 'prayer'>('general');
  const [requiresAck, setRequiresAck] = useState(false);
  const [mediaList, setMediaList] = useState<ThreadMediaItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showGifModal, setShowGifModal] = useState(false);

  const isOfficer = ['super_admin', 'director', 'secretary', 'treasurer'].includes(currentUserProfile.role);

  // Mention State
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const [selectedMentions, setSelectedMentions] = useState<MemberOption[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { addToast } = useToast();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 260)}px`;
    }
  }, [content]);

  // Handle Category Select
  const handleCategorySelect = (cat: 'general' | 'minutes' | 'announcement' | 'repertoire' | 'prayer') => {
    setCategory(cat);
    if (cat === 'minutes' || cat === 'announcement') {
      setRequiresAck(true);
    } else {
      setRequiresAck(false);
    }
  };

  // Rich Text Formatting Action Handler
  const handleApplyFormat = (type: FormatType, extra?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (type) {
      case 'bold':
        replacement = selectedText ? `**${selectedText}**` : '**bold text**';
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'italic':
        replacement = selectedText ? `*${selectedText}*` : '*italic text*';
        cursorOffset = selectedText ? replacement.length : 1;
        break;
      case 'underline':
        replacement = selectedText ? `<u>${selectedText}</u>` : '<u>underlined text</u>';
        cursorOffset = selectedText ? replacement.length : 3;
        break;
      case 'strike':
        replacement = selectedText ? `~~${selectedText}~~` : '~~strikethrough text~~';
        cursorOffset = selectedText ? replacement.length : 2;
        break;
      case 'h1':
        replacement = selectedText ? `\n# ${selectedText}\n` : '\n# Main Heading\n';
        cursorOffset = replacement.length;
        break;
      case 'h2':
        replacement = selectedText ? `\n## ${selectedText}\n` : '\n## Section Heading\n';
        cursorOffset = replacement.length;
        break;
      case 'bullet':
        if (selectedText) {
          replacement = selectedText
            .split('\n')
            .map((line) => (line.startsWith('- ') ? line : `- ${line}`))
            .join('\n');
        } else {
          replacement = '\n- Bullet item\n';
        }
        cursorOffset = replacement.length;
        break;
      case 'numbered':
        if (selectedText) {
          replacement = selectedText
            .split('\n')
            .map((line, i) => `${i + 1}. ${line}`)
            .join('\n');
        } else {
          replacement = '\n1. List item\n';
        }
        cursorOffset = replacement.length;
        break;
      case 'quote':
        replacement = selectedText ? `\n> ${selectedText}\n` : '\n> Important notice or quote\n';
        cursorOffset = replacement.length;
        break;
      case 'hr':
        replacement = '\n---\n';
        cursorOffset = replacement.length;
        break;
      case 'color':
        const col = extra || '#059669';
        replacement = selectedText
          ? `<span style="color:${col}">${selectedText}</span>`
          : `<span style="color:${col}">colored text</span>`;
        cursorOffset = replacement.length;
        break;
      case 'highlight':
        const bg = extra || '#fef08a';
        replacement = selectedText
          ? `<mark style="background:${bg}">${selectedText}</mark>`
          : `<mark style="background:${bg}">highlighted text</mark>`;
        cursorOffset = replacement.length;
        break;
    }

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 20);
  };

  // Handle Mentions Detection
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\s]{0,20})$/);

    if (lastAtMatch) {
      setMentionQuery(lastAtMatch[1].toLowerCase());
      setMentionIndex(lastAtMatch.index!);
    } else {
      setMentionQuery(null);
    }
  };

  const handleSelectMention = (member: MemberOption) => {
    if (mentionIndex < 0 || mentionQuery === null) return;

    const before = content.slice(0, mentionIndex);
    const after = content.slice(mentionIndex + mentionQuery.length + 1);
    const newContent = `${before}@${member.full_name} ${after}`;

    setContent(newContent);
    setMentionQuery(null);
    setSelectedMentions((prev) => [...prev.filter((m) => m.id !== member.id), member]);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 50);
  };

  const filteredMembers = mentionQuery !== null
    ? members.filter(
        (m) =>
          m.id !== currentUserProfile.id &&
          m.full_name.toLowerCase().includes(mentionQuery)
      ).slice(0, 5)
    : [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast({
        type: 'error',
        title: 'File Too Large',
        message: 'Image size should be under 5MB.',
      });
      return;
    }

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserProfile.id}-${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('thread-media')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('thread-media')
        .getPublicUrl(filePath);

      setMediaList((prev) => [...prev, { media_type: 'image', url: publicUrl }]);
      addToast({ type: 'success', title: 'Image Attached', message: 'Photo ready to share.' });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Upload Failed', message: err.message || 'Could not upload image.' });
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectGif = (url: string) => {
    setMediaList((prev) => [...prev, { media_type: 'gif', url }]);
  };

  const handleRemoveMedia = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitPost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() && mediaList.length === 0) return;

    setSubmitting(true);

    // Extract all mentions from text
    const mentionedIds = selectedMentions
      .filter((m) => content.includes(`@${m.full_name}`))
      .map((m) => m.id);

    const res = await createThreadPost({
      content: content.trim(),
      is_anonymous: isAnonymous,
      category,
      requires_acknowledgement: requiresAck,
      media: mediaList,
      mentions: mentionedIds,
    });

    setSubmitting(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Post Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: category === 'minutes' ? '📋 Meeting Minutes Published' : isAnonymous ? '🔒 Posted Anonymously' : '✓ Thread Published',
        message: category === 'minutes'
          ? 'Meeting minutes posted. Members can now acknowledge.'
          : isAnonymous
          ? 'Your post is published anonymously to fellow choristers.'
          : 'Your thread is now live on the choir feed.',
      });
      setContent('');
      setMediaList([]);
      setSelectedMentions([]);
      setIsAnonymous(false);
      setCategory('general');
      setRequiresAck(false);
      if (onPostCreated) onPostCreated();
    }
  };

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs transition-all relative">
      {/* Officer Post Category Bar */}
      {isOfficer && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-3 border-b border-slate-100">
          <span className="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 shrink-0 mr-1">
            Post Type:
          </span>
          <button
            type="button"
            onClick={() => handleCategorySelect('general')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
              category === 'general'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            💬 General
          </button>
          <button
            type="button"
            onClick={() => handleCategorySelect('minutes')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
              category === 'minutes'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200/70 hover:bg-amber-100'
            }`}
          >
            📋 Minutes of the Meeting
          </button>
          <button
            type="button"
            onClick={() => handleCategorySelect('announcement')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
              category === 'announcement'
                ? 'bg-primary text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/70 hover:bg-emerald-100'
            }`}
          >
            📢 Announcement
          </button>
          <button
            type="button"
            onClick={() => handleCategorySelect('repertoire')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
              category === 'repertoire'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-800 border border-purple-200/70 hover:bg-purple-100'
            }`}
          >
            🎵 Repertoire
          </button>
          <button
            type="button"
            onClick={() => handleCategorySelect('prayer')}
            className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
              category === 'prayer'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-800 border border-blue-200/70 hover:bg-blue-100'
            }`}
          >
            🙏 Prayer
          </button>
        </div>
      )}

      <div className="flex gap-3.5 items-start">
        {/* Author Avatar or Anonymous Mask */}
        <div className="relative shrink-0">
          {isAnonymous ? (
            <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-xs border-2 border-slate-600">
              <Lock size={18} className="text-amber-300" />
            </div>
          ) : (
            <Avatar
              src={currentUserProfile.avatar_url}
              name={currentUserProfile.full_name}
              size={40}
              className="border border-slate-200"
            />
          )}
        </div>

        {/* Text Input Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-800">
                {isAnonymous ? 'Anonymous Member' : currentUserProfile.full_name}
              </span>
              {category !== 'general' && (
                <span className="text-[0.65rem] font-extrabold uppercase px-2 py-0.2 rounded-full bg-slate-100 text-slate-700">
                  {category.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Anonymous Toggle Pill */}
            <button
              type="button"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isAnonymous
                  ? 'bg-slate-900 text-amber-300 shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title="Toggle Anonymous Post"
            >
              <Lock size={12} />
              <span>{isAnonymous ? 'Anonymous Active' : 'Post as Yourself'}</span>
            </button>
          </div>

          {/* Word-Style Rich Formatting Toolbar */}
          <div className="mb-2">
            <PostFormattingToolbar onApplyFormat={handleApplyFormat} />
          </div>

          <textarea
            ref={textareaRef}
            rows={3}
            value={content}
            onChange={handleContentChange}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                handleSubmitPost();
              }
            }}
            placeholder={
              category === 'minutes'
                ? 'Type meeting minutes (use H2 ## for sections, - for bullet points, --- for lines)...'
                : isAnonymous
                ? 'Share confidential thoughts, liturgical questions, or feedback...'
                : 'Share music updates, mass notes, announcements, or encouragement...'
            }
            className="w-full text-xs sm:text-sm bg-transparent border-0 outline-none text-slate-800 placeholder:text-slate-400 resize-none min-h-[70px] leading-relaxed"
          />

          {/* Mandatory Acknowledgement Indicator / Checkbox for Officers */}
          {isOfficer && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requiresAck}
                  onChange={(e) => setRequiresAck(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Require Member Acknowledgement (Roster Tracking)</span>
              </label>
            </div>
          )}

          {/* Mention Autocomplete Popup */}
          {mentionQuery !== null && filteredMembers.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden mb-3 p-1 animate-in fade-in-50">
              <div className="text-[0.65rem] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                Mention Member
              </div>
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMention(m)}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Avatar src={m.avatar_url} name={m.full_name} size={24} />
                  <span className="text-xs font-bold text-slate-800">{m.full_name}</span>
                  {m.voice_part && (
                    <span className="text-[0.65rem] text-slate-400">({m.voice_part})</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Media Attachments Preview Gallery */}
          {mediaList.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-2 my-1">
              {mediaList.map((m, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-2xl overflow-hidden border border-slate-200 w-24 h-24 sm:w-28 sm:h-28 shrink-0 bg-slate-100 shadow-2xs"
                >
                  <img
                    src={m.url}
                    alt="attachment"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-1 left-1 bg-black/60 backdrop-blur-xs text-white text-[0.6rem] font-bold px-1.5 py-0.2 rounded-md uppercase">
                    {m.media_type}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Anonymous Disclaimer Bar */}
          {isAnonymous && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-[0.72rem] my-2">
              <AlertCircle size={14} className="shrink-0 text-amber-700" />
              <span>
                <strong>Moderation Notice:</strong> Fellow members only see &quot;Anonymous Member&quot;. Choir Directors &amp; Officers can still view the real author for safety and audit purposes.
              </span>
            </div>
          )}

          {/* Bottom Action Strip */}
          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 mt-1">
            <div className="flex items-center gap-1 sm:gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Attach Photo"
              >
                <ImageIcon size={16} className="text-emerald-600" />
                <span className="hidden sm:inline">Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGifModal(true)}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Search GIF"
              >
                <Sparkles size={16} className="text-purple-600" />
                <span className="hidden sm:inline">GIF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContent((prev) => `${prev} @`);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-slate-100 text-slate-600 font-semibold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Mention Choir Member"
              >
                <AtSign size={16} className="text-blue-600" />
                <span className="hidden sm:inline">Mention</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleSubmitPost()}
              disabled={submitting || (!content.trim() && mediaList.length === 0)}
              className="btn btn-primary !py-1.5 sm:!py-2 !px-4 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Publishing…</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Publish</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* GIF Picker Modal */}
      <GifPickerModal
        isOpen={showGifModal}
        onClose={() => setShowGifModal(false)}
        onSelectGif={handleSelectGif}
      />
    </div>
  );
};
