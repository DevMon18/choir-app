'use client';

import React, { useState, useEffect } from 'react';
import { submitNewSongWithLyrics } from '@/app/repertoire/[id]/actions';
import { ChordProEditor } from '@/components/ChordProEditor';
import { useToast } from '@/components/Toast';
import { X, Sparkles, Music, AlertCircle } from 'lucide-react';

interface SubmitSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  availableMassParts?: Array<{
    mass_part: string;
    display_name: string;
    points: number;
  }>;
}

const DEFAULT_MASS_PARTS = [
  { mass_part: 'entrance_song', display_name: 'Entrance Song', points: 1 },
  { mass_part: 'kyrie', display_name: 'Kyrie', points: 2 },
  { mass_part: 'gloria', display_name: 'Gloria', points: 1 },
  { mass_part: 'responsorial_psalm', display_name: 'Responsorial Psalm', points: 1 },
  { mass_part: 'gospel_acclamation', display_name: 'Gospel Acclamation', points: 2 },
  { mass_part: 'offertory', display_name: 'Offertory / Presentation', points: 1 },
  { mass_part: 'sanctus', display_name: 'Sanctus', points: 1 },
  { mass_part: 'memorial_acclamation', display_name: 'Memorial Acclamation', points: 1 },
  { mass_part: 'great_amen', display_name: 'Great Amen', points: 2 },
  { mass_part: 'lords_prayer', display_name: "Lord's Prayer", points: 1 },
  { mass_part: 'lamb_of_god', display_name: 'Lamb of God', points: 1 },
  { mass_part: 'communion_song', display_name: 'Communion Song', points: 2 },
  { mass_part: 'recessional_song', display_name: 'Recessional / Closing', points: 1 },
];

export const SubmitSongModal = ({
  isOpen,
  onClose,
  onSuccess,
  availableMassParts = DEFAULT_MASS_PARTS,
}: SubmitSongModalProps) => {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [composer, setComposer] = useState('');
  const [keyTone, setKeyTone] = useState('');
  const [selectedMassPart, setSelectedMassPart] = useState('entrance_song');
  const [lyricsContent, setLyricsContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Restore draft from localStorage
  useEffect(() => {
    if (!isOpen) return;
    try {
      const draft = localStorage.getItem('choir_new_song_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.composer) setComposer(parsed.composer);
        if (parsed.keyTone) setKeyTone(parsed.keyTone);
        if (parsed.selectedMassPart) setSelectedMassPart(parsed.selectedMassPart);
        if (parsed.lyricsContent) setLyricsContent(parsed.lyricsContent);
      }
    } catch {}
  }, [isOpen]);

  // Autosave draft
  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(
          'choir_new_song_draft',
          JSON.stringify({
            title,
            composer,
            keyTone,
            selectedMassPart,
            lyricsContent,
            savedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }, 600);
    return () => clearTimeout(timeout);
  }, [isOpen, title, composer, keyTone, selectedMassPart, lyricsContent]);

  if (!isOpen) return null;

  const currentMp = availableMassParts.find((m) => m.mass_part === selectedMassPart) || DEFAULT_MASS_PARTS[0];
  const pointsAtStake = currentMp.points;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please provide the song title.');
      return;
    }
    if (!lyricsContent.trim()) {
      setErrorMsg('Please enter the song lyrics/chords.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    const res = await submitNewSongWithLyrics({
      title: title.trim(),
      composer: composer.trim() || undefined,
      key: keyTone.trim() || undefined,
      massPart: selectedMassPart,
      lyricsContent: lyricsContent.trim(),
    });

    setSubmitting(false);

    if (res.error) {
      setErrorMsg(res.error);
      addToast({
        type: 'error',
        title: 'Submission Failed',
        message: res.error,
      });
      return;
    }

    // Clear draft
    try {
      localStorage.removeItem('choir_new_song_draft');
    } catch {}

    addToast({
      type: 'success',
      title: '🎉 Song Proposed Successfully!',
      message: `"${title}" was submitted to the director review queue. You'll earn +${pointsAtStake} points once approved!`,
    });

    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[99999] p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 max-w-[800px] w-full text-foreground shadow-2xl my-auto max-h-[94vh] sm:max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <Music size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-primary m-0">
                Submit New Song &amp; Lyrics
              </h2>
              <p className="text-xs text-slate-500 m-0">
                Earn contributor points once approved by the choir director
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors border-0 bg-transparent cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title & Composer Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="input-label" htmlFor="newSongTitle">
                Song Title <span className="text-error">*</span>
              </label>
              <input
                id="newSongTitle"
                type="text"
                placeholder="e.g. Bukas Palad, Purihin ang Panginoon..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="input-field text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="input-label" htmlFor="newSongComposer">
                Composer / Artist (Optional)
              </label>
              <input
                id="newSongComposer"
                type="text"
                placeholder="e.g. Fr. Manoling Francisco, SJ"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                className="input-field text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Mass Part & Key Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-end">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="input-label !mb-0" htmlFor="newSongMassPart">
                  Mass Part / Category <span className="text-error">*</span>
                </label>
                <span className="bg-amber-500/15 text-amber-900 text-[0.68rem] font-bold px-2 py-0.5 rounded-full border border-amber-500/25">
                  +{pointsAtStake} pts reward
                </span>
              </div>
              <select
                id="newSongMassPart"
                value={selectedMassPart}
                onChange={(e) => setSelectedMassPart(e.target.value)}
                className="input-field text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {availableMassParts.map((mp) => (
                  <option key={mp.mass_part} value={mp.mass_part}>
                    {mp.display_name} (+{mp.points} pts)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label" htmlFor="newSongKey">
                Key / Tone (Optional)
              </label>
              <input
                id="newSongKey"
                type="text"
                placeholder="e.g. G major, D, F#"
                value={keyTone}
                onChange={(e) => setKeyTone(e.target.value)}
                className="input-field text-xs sm:text-sm font-mono"
              />
            </div>
          </div>

          {/* Lyrics / ChordPro Section with full formatting toolbar */}
          <ChordProEditor
            id="newSongLyrics"
            value={lyricsContent}
            onChange={(val) => setLyricsContent(val)}
            label="Lyrics & Chords (ChordPro Format)"
            placeholder={`{comment: Verse 1}\n[G]Purihin ang Pa[D]nginoon\n[C]Sa Kanyang kabu[G]tihan...\n\n{comment: Chorus}\n[Em]Aleluya, [Bm]Aleluya\n[C]Purihin ang [D]Diyos!`}
            required
            minHeight="200px"
            disabled={submitting}
          />

          {/* Footer Actions */}
          <div className="flex gap-2.5 justify-end items-center pt-3 border-t border-slate-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
              disabled={submitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary !py-2 !px-5 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
              disabled={submitting || !title.trim() || !lyricsContent.trim()}
            >
              <Sparkles size={14} />
              <span>{submitting ? 'Submitting Song...' : `Submit Song (+${pointsAtStake} pts)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitSongModal;
