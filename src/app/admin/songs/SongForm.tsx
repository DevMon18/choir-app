'use client';

import React, { useState } from 'react';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import { createSong, updateSong } from './actions';

interface Song {
  id: string;
  title: string;
  composer: string | null;
  arranger: string | null;
  category: string | null;
  lyrics: string | null;
}

interface SongFormProps {
  song?: Song;                      // undefined = create mode
  onSuccess: (id: string) => void;
  onCancel: () => void;
}

const CATEGORIES = ['SATB', 'Gospel', 'Contemporary', 'Traditional', 'Liturgical', 'Advent', 'Easter', 'Christmas'];

export const SongForm = ({ song, onSuccess, onCancel }: SongFormProps) => {
  const isEdit = !!song;

  const [title, setTitle] = useState(song?.title ?? '');
  const [composer, setComposer] = useState(song?.composer ?? '');
  const [arranger, setArranger] = useState(song?.arranger ?? '');
  const [category, setCategory] = useState(song?.category ?? '');
  const [lyrics, setLyrics] = useState(song?.lyrics ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateSong(song!.id, fd)
      : await createSong(fd);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      onSuccess(isEdit ? song!.id : (result as any).id);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
          {isEdit ? 'Edit Song' : 'Add New Song'}
        </h3>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="btn btn-secondary"
          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '16px' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: showPreview && lyrics ? '1fr 1fr' : '1fr', gap: '30px', alignItems: 'start' }}>
        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="songTitle">Title *</label>
              <input
                id="songTitle"
                name="title"
                type="text"
                className="input-field"
                placeholder="Amazing Grace"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="songCategory">Category</label>
              <select
                id="songCategory"
                name="category"
                className="input-field"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
                style={{ background: '#ffffff' }}
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="songComposer">Composer</label>
              <input
                id="songComposer"
                name="composer"
                type="text"
                className="input-field"
                placeholder="John Newton"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label" htmlFor="songArranger">Arranger</label>
              <input
                id="songArranger"
                name="arranger"
                type="text"
                className="input-field"
                placeholder="Optional"
                value={arranger}
                onChange={(e) => setArranger(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="songLyrics">
              ChordPro Lyrics
              <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '8px', fontSize: '0.78rem' }}>
                — wrap chords in [brackets]: [G]Amazing [D]grace
              </span>
            </label>
            <textarea
              id="songLyrics"
              name="lyrics"
              className="input-field"
              placeholder={`{comment: Verse 1}\n[G]Amazing [D]grace how [Em]sweet the [C]sound\nThat [G]saved a wretch like [D]me`}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              disabled={loading}
              rows={16}
              style={{
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '0.9rem',
                resize: 'vertical',
                minHeight: '260px',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={loading}
              style={{ padding: '10px 20px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
              disabled={loading}
              style={{ padding: '10px 24px' }}
            >
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Song'}
            </button>
          </div>
        </form>

        {/* Live ChordPro Preview */}
        {showPreview && lyrics && (
          <div
            style={{
              background: 'rgba(255,255,255,0.6)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '20px',
              maxHeight: '520px',
              overflowY: 'auto',
            }}
          >
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.06em' }}>
              Live Preview
            </p>
            <ChordProRenderer lyrics={lyrics} fontSize={14} />
          </div>
        )}
      </div>
    </div>
  );
};

export default SongForm;
