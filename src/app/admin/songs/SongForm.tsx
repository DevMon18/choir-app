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
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg sm:text-xl font-bold text-primary">
          {isEdit ? 'Edit Song' : 'Add New Song'}
        </h3>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="btn btn-secondary !py-1.5 !px-3.5 text-xs"
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className={`song-form-grid ${showPreview && lyrics ? 'has-preview' : ''}`}>
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="input-group !mb-0">
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
          <div className="input-group !mb-0">
            <div className="flex justify-between items-center mb-2">
              <label className="input-label !mb-0 flex items-center gap-1.5">
                <Tag size={14} />
                <span>Categories / Tags</span>
              </label>
              {!showAddCatInput && (
                <button
                  type="button"
                  onClick={() => setShowAddCatInput(true)}
                  className="bg-transparent border-0 text-primary text-xs font-semibold cursor-pointer flex items-center gap-1 py-0.5 px-1.5"
                >
                  <Plus size={14} />
                  <span>New Category</span>
                </button>
              )}
            </div>

            {/* Inline Add Category Form */}
            {showAddCatInput && (
              <div className="song-form-cat-add-bar">
                <input
                  type="text"
                  className="input-field text-xs sm:text-sm !py-1.5 !px-3"
                  placeholder="Category Name (e.g. Marian, Offertory)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  disabled={creatingCat}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleInlineCreateCategory}
                  disabled={creatingCat || !newCatName.trim()}
                  className="btn btn-primary !py-1.5 !px-3.5 text-xs whitespace-nowrap"
                >
                  {creatingCat ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCatInput(false);
                    setNewCatName('');
                  }}
                  className="btn btn-secondary !py-1.5 !px-3 text-xs"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Category Toggle Chips */}
            <div className="flex flex-wrap gap-2 p-3 bg-white/50 border border-glass-border rounded-xl min-h-[48px] items-center">
              {catList.length === 0 ? (
                <span className="text-xs text-muted">
                  No categories created yet. Click &quot;+ New Category&quot; to add one.
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
                      className={`inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                        selected
                          ? 'border-primary bg-primary/12 text-primary shadow-sm shadow-primary/20'
                          : 'border-border bg-white/80 text-foreground'
                      }`}
                    >
                      {selected && <Check size={14} style={{ strokeWidth: 3 }} />}
                      <span>{cat.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <span className="text-xs text-muted mt-1 block">
              Select all categories that apply to this song.
            </span>
          </div>

          <div className="song-form-row-2col">
            <div className="input-group !mb-0">
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
            <div className="input-group !mb-0">
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

          <div className="input-group !mb-0">
            <label className="input-label" htmlFor="songLyrics">
              ChordPro Lyrics
              <span className="font-normal text-muted ml-2 text-xs">
                — wrap chords in [brackets]: [G]Amazing [D]grace
              </span>
            </label>
            <textarea
              id="songLyrics"
              name="lyrics"
              className="input-field font-mono text-sm resize-y min-h-[200px]"
              placeholder={`{comment: Verse 1}\n[G]Amazing [D]grace how [Em]sweet the [C]sound\nThat [G]saved a wretch like [D]me`}
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              disabled={loading}
              rows={16}
            />
          </div>

          <div className="song-form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
              disabled={loading}
            >
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Song'}
            </button>
          </div>
        </form>

        {/* Live ChordPro Preview */}
        {showPreview && lyrics && (
          <div className="song-form-preview-box">
            <p className="text-xs font-bold text-muted uppercase mb-3 tracking-wider">
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
