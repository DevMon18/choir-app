'use client';

import React, { useState, useEffect } from 'react';
import { MassPartCoverageItem, submitSongLyrics } from './actions';
import { ChordProEditor } from '@/components/ChordProEditor';
import { useToast } from '@/components/Toast';
import { X, Sparkles, Award, AlertCircle, FileText } from 'lucide-react';

interface LyricsContributionModalProps {
  songId: string;
  songTitle: string;
  coverage: MassPartCoverageItem[];
  initialMassPart?: string;
  existingSubmissionId?: string;
  initialLyrics?: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const LyricsContributionModal = ({
  songId,
  songTitle,
  coverage,
  initialMassPart,
  existingSubmissionId,
  initialLyrics = '',
  onSuccess,
  onClose,
}: LyricsContributionModalProps) => {
  const { addToast } = useToast();

  // Find first eligible missing mass part if not specified
  const eligibleParts = coverage.filter((c) => c.status !== 'approved' || c.mass_part === initialMassPart);
  const defaultPart = initialMassPart || eligibleParts[0]?.mass_part || 'kyrie';

  const [selectedMassPart, setSelectedMassPart] = useState<string>(defaultPart);
  const [lyrics, setLyrics] = useState<string>(initialLyrics);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState<boolean>(false);

  const selectedCoverage = coverage.find((c) => c.mass_part === selectedMassPart);
  const draftKey = `choir_lyrics_draft_${songId}_${selectedMassPart}`;

  // Restore draft from localStorage if available and no initialLyrics was supplied
  useEffect(() => {
    if (!initialLyrics) {
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft && savedDraft.trim().length > 0) {
          setLyrics(savedDraft);
          setDraftRestored(true);
        }
      } catch (e) {
        console.warn('Could not read draft from localStorage', e);
      }
    }
  }, [draftKey, initialLyrics]);

  // Debounced autosave to localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (lyrics.trim()) {
          localStorage.setItem(draftKey, lyrics);
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch (e) {
        console.warn('Failed to save draft to localStorage', e);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [lyrics, draftKey]);

  // Clear draft upon successful submission
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lyrics.trim()) {
      setError('Please provide lyrics before submitting.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await submitSongLyrics(
        songId,
        selectedMassPart,
        lyrics,
        existingSubmissionId
      );

      setLoading(false);

      if (res?.error) {
        setError(res.error);
      } else {
        clearDraft();
        addToast({
          type: 'success',
          title: 'Contribution Submitted!',
          message: `Your ${selectedCoverage?.display_name || 'lyrics'} contribution was submitted for director review.`,
        });
        onSuccess();
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'An error occurred during submission.');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[99999] p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 max-w-[840px] w-full text-foreground shadow-2xl my-auto max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-5 pb-3 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              <h3 className="text-lg sm:text-xl font-bold text-primary m-0">
                {existingSubmissionId ? 'Edit Lyrics Submission' : 'Contribute Song Lyrics'}
              </h3>
            </div>
            <p className="text-xs text-muted font-medium m-0 mt-0.5 truncate max-w-[340px] sm:max-w-md">
              Song: <strong className="text-foreground">{songTitle}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-black/5 transition-colors border-0 bg-transparent cursor-pointer"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Draft notification badge */}
        {draftRestored && (
          <div className="alert alert-info !py-2 !px-3 mb-4 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText size={14} />
              Restored unsaved draft from your local device.
            </span>
            <button
              type="button"
              onClick={() => {
                clearDraft();
                setLyrics('');
                setDraftRestored(false);
              }}
              className="text-[0.7rem] font-bold underline cursor-pointer bg-transparent border-0 text-inherit"
            >
              Clear Draft
            </button>
          </div>
        )}

        {error && (
          <div className="alert alert-error mb-4 text-xs">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Mass Part Selection & Reward Preview Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2 input-group !mb-0">
              <label className="input-label" htmlFor="massPartSelect">
                Target Mass Part *
              </label>
              <select
                id="massPartSelect"
                value={selectedMassPart}
                onChange={(e) => {
                  setSelectedMassPart(e.target.value);
                  setDraftRestored(false);
                }}
                disabled={loading || !!existingSubmissionId}
                className="input-field w-full text-sm font-semibold"
                required
              >
                {coverage.map((part) => {
                  const isApproved = part.status === 'approved' && part.mass_part !== initialMassPart;
                  return (
                    <option key={part.mass_part} value={part.mass_part} disabled={isApproved}>
                      {part.display_name} ({part.points} pts) {isApproved ? '— Already Covered' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Potential Reward Badge */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between min-h-[44px]">
              <div className="flex items-center gap-1.5 text-amber-900">
                <Award size={17} className="text-amber-600" />
                <span className="text-xs font-bold">Reward</span>
              </div>
              <span className="text-sm font-extrabold text-amber-700 bg-amber-500/20 py-0.5 px-2.5 rounded-full">
                +{selectedCoverage?.points || 1} pts
              </span>
            </div>
          </div>

          {/* Lyrics / ChordPro Editor */}
          <ChordProEditor
            id="lyricsContent"
            value={lyrics}
            onChange={(val) => setLyrics(val)}
            label="ChordPro Lyrics & Chords"
            placeholder={`{comment: Verse 1}\n[G]Holy, [D]Holy, [Em]Holy [C]Lord God of hosts.\n[G]Heaven and [D]earth are full of your [G]glory.`}
            required
            disabled={loading}
            minHeight="200px"
          />

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end items-center pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn btn-secondary !py-2 !px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !lyrics.trim()}
              className={`btn btn-primary !py-2 !px-5 text-xs font-bold flex items-center gap-1.5 shadow-md ${
                loading ? 'btn-disabled' : ''
              }`}
            >
              <Sparkles size={14} />
              <span>{loading ? 'Submitting…' : existingSubmissionId ? 'Save & Resubmit' : 'Submit for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
