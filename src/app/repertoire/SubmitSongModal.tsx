'use client';

import React, { useState, useEffect, useRef } from 'react';
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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="glass-container"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid var(--glass-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(11, 77, 36, 0.04), rgba(197, 160, 89, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Music size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--primary)', fontWeight: 700 }}>
                Submit New Song &amp; Lyrics
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                Earn contributor points once approved by the choir director
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: '6px',
              borderRadius: '8px',
              display: 'inline-flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: 'var(--error)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Title & Composer Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px' }}>
                  Song Title <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bukas Palad, Purihin ang Panginoon..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px' }}>
                  Composer / Artist (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fr. Manoling Francisco, SJ"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Mass Part & Key Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    Mass Part / Category <span style={{ color: 'var(--error)' }}>*</span>
                  </label>
                  <span
                    style={{
                      background: 'rgba(197, 160, 89, 0.15)',
                      color: 'var(--accent)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '999px',
                      border: '1px solid rgba(197, 160, 89, 0.3)',
                    }}
                  >
                    +{pointsAtStake} pts reward
                  </span>
                </div>
                <select
                  value={selectedMassPart}
                  onChange={(e) => setSelectedMassPart(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.88rem',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {availableMassParts.map((mp) => (
                    <option key={mp.mass_part} value={mp.mass_part}>
                      {mp.display_name} (+{mp.points} pts)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '6px' }}>
                  Key / Tone (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. G major, D, F#"
                  value={keyTone}
                  onChange={(e) => setKeyTone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
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
              minHeight="220px"
              disabled={submitting}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#fcfcfc',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={submitting}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={15} />
              <span>{submitting ? 'Submitting Song...' : `Submit Song for Review (+${pointsAtStake} pts)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
