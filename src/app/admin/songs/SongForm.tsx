'use client';

import React, { useState } from 'react';
import { ChordProRenderer } from '@/components/ChordProRenderer';
import { createSong, updateSong } from './actions';
import { createCategory } from '@/app/admin/categories/actions';
import { Plus, Check, Tag } from 'lucide-react';

export interface SongCategory {
  id: string;
  name: string;
}

interface Song {
  id: string;
  title: string;
  composer: string | null;
  arranger: string | null;
  category?: string | null;
  categories?: SongCategory[];
  lyrics: string | null;
}

interface SongFormProps {
  song?: Song;
  availableCategories: SongCategory[];
  onSuccess: (id: string) => void;
  onCancel: () => void;
  onCategoryCreated?: (newCat: SongCategory) => void;
}

export const SongForm = ({
  song,
  availableCategories = [],
  onSuccess,
  onCancel,
  onCategoryCreated,
}: SongFormProps) => {
  const isEdit = !!song;

  const [title, setTitle] = useState(song?.title ?? '');
  const [composer, setComposer] = useState(song?.composer ?? '');
  const [arranger, setArranger] = useState(song?.arranger ?? '');
  const [lyrics, setLyrics] = useState(song?.lyrics ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // Selected category IDs state
  const initialCategoryIds = (song?.categories || []).map((c) => c.id);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryIds);

  // Categories list in local state to allow instant inline creation
  const [catList, setCatList] = useState<SongCategory[]>(availableCategories);

  // Inline new category input
  const [showAddCatInput, setShowAddCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleInlineCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    setCreatingCat(true);
    try {
      const res = await createCategory(name);
      if (res.error) {
        setError(res.error);
      } else if (res.category) {
        const newCat: SongCategory = { id: res.category.id, name: res.category.name };
        setCatList((prev) => [...prev, newCat]);
        setSelectedCategoryIds((prev) => [...prev, newCat.id]);
        if (onCategoryCreated) onCategoryCreated(newCat);
        setNewCatName('');
        setShowAddCatInput(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create category.');
    } finally {
      setCreatingCat(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateSong(song!.id, fd, selectedCategoryIds)
      : await createSong(fd, selectedCategoryIds);

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

          {/* Multi-Select Category Tags Picker */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="input-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={14} />
                <span>Categories / Tags</span>
              </label>
              {!showAddCatInput && (
                <button
                  type="button"
                  onClick={() => setShowAddCatInput(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                  }}
                >
                  <Plus size={14} />
                  <span>New Category</span>
                </button>
              )}
            </div>

            {/* Inline Add Category Form */}
            {showAddCatInput && (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  borderRadius: '10px',
                  border: '1px solid var(--primary)',
                }}
              >
                <input
                  type="text"
                  className="input-field"
                  placeholder="Category Name (e.g. Marian, Offertory)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  disabled={creatingCat}
                  style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleInlineCreateCategory}
                  disabled={creatingCat || !newCatName.trim()}
                  className="btn btn-primary"
                  style={{ padding: '6px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                >
                  {creatingCat ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCatInput(false);
                    setNewCatName('');
                  }}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Category Toggle Chips */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '12px',
                background: 'rgba(255, 255, 255, 0.5)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                minHeight: '48px',
                alignItems: 'center',
              }}
            >
              {catList.length === 0 ? (
                <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                  No categories created yet. Click "+ New Category" to add one.
                </span>
              ) : (
                catList.map((cat) => {
                  const selected = selectedCategoryIds.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      disabled={loading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        border: selected
                          ? '1px solid var(--primary)'
                          : '1px solid var(--border)',
                        background: selected
                          ? 'rgba(30, 58, 138, 0.12)'
                          : 'rgba(255, 255, 255, 0.8)',
                        color: selected ? 'var(--primary)' : 'var(--foreground)',
                        boxShadow: selected ? '0 2px 8px rgba(30, 58, 138, 0.15)' : 'none',
                      }}
                    >
                      {selected && <Check size={14} style={{ strokeWidth: 3 }} />}
                      <span>{cat.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
              Select all categories that apply to this song.
            </span>
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
