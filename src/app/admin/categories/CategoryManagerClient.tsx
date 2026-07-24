'use client';

import React, { useState } from 'react';
import { CategoryItem, createCategory, renameCategory, deleteCategory, reorderCategories } from './actions';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { Tag, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Check, X } from 'lucide-react';

interface Props {
  initialCategories: CategoryItem[];
  onCategoriesChange?: () => void;
}

export const CategoryManagerClient: React.FC<Props> = ({ initialCategories, onCategoriesChange }) => {
  const { addToast } = useToast();
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);

  // New category state
  const [newCatName, setNewCatName] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [updating, setUpdating] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reordering loading
  const [reordering, setReordering] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await createCategory(name);
      if (res.error) {
        addToast({ type: 'error', title: 'Error', message: res.error });
      } else if (res.category) {
        addToast({ type: 'success', title: 'Category Created', message: `"${res.category.name}" was added.` });
        setCategories((prev) => [...prev, res.category as CategoryItem]);
        setNewCatName('');
        if (onCategoriesChange) onCategoriesChange();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to create category.' });
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleSaveRename = async (id: string) => {
    const name = editName.trim();
    if (!name) return;

    setUpdating(true);
    try {
      const res = await renameCategory(id, name);
      if (res.error) {
        addToast({ type: 'error', title: 'Error', message: res.error });
      } else {
        addToast({ type: 'success', title: 'Category Renamed', message: `Renamed to "${name}".` });
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name } : c))
        );
        setEditingId(null);
        if (onCategoriesChange) onCategoriesChange();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to rename category.' });
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const cat = deleteTarget;
    setDeleting(true);

    try {
      const res = await deleteCategory(cat.id);
      if (res.error) {
        addToast({ type: 'error', title: 'Error', message: res.error });
      } else {
        addToast({ type: 'success', title: 'Category Deleted', message: `"${cat.name}" was removed.` });
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        setDeleteTarget(null);
        if (onCategoriesChange) onCategoriesChange();
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete category.' });
    } finally {
      setDeleting(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (reordering) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newArr = [...categories];
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;

    // Re-assign sort_orders
    const itemsToSave = newArr.map((c, i) => ({ id: c.id, sort_order: i }));
    setCategories(newArr.map((c, i) => ({ ...c, sort_order: i })));

    setReordering(true);
    try {
      const res = await reorderCategories(itemsToSave);
      if (res.error) {
        addToast({ type: 'error', title: 'Error', message: res.error });
      }
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message || 'Failed to reorder categories.' });
    } finally {
      setReordering(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={20} />
            <span>Song Categories & Tags</span>
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '4px', margin: 0 }}>
            Manage categories used to tag repertoire songs across the app.
          </p>
        </div>
      </div>

      {/* Add New Category Box */}
      <div
        className="glass-container"
        style={{ padding: '20px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.7)' }}
      >
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '12px', marginTop: 0 }}>
          Create New Category
        </h4>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '12px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Marian, Offertory, Choral..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            disabled={creating}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            disabled={creating || !newCatName.trim()}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', whiteSpace: 'nowrap' }}
          >
            <Plus size={16} />
            <span>{creating ? 'Adding…' : 'Add Category'}</span>
          </button>
        </form>
      </div>

      {/* Category List */}
      <div className="glass-container" style={{ padding: '0', overflow: 'hidden' }}>
        {categories.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
            <Tag size={32} style={{ opacity: 0.4, marginBottom: '12px' }} />
            <p style={{ margin: 0, fontSize: '0.92rem' }}>No categories found. Create your first category above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {categories.map((cat, idx) => {
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: idx < categories.length - 1 ? '1px solid var(--glass-border)' : 'none',
                    background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.4)' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Left: Move handles & Category Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <button
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0 || reordering}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: idx === 0 || reordering ? 'not-allowed' : 'pointer',
                          opacity: idx === 0 || reordering ? 0.25 : 0.7,
                          padding: '2px',
                          color: 'var(--foreground)',
                        }}
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === categories.length - 1 || reordering}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: idx === categories.length - 1 || reordering ? 'not-allowed' : 'pointer',
                          opacity: idx === categories.length - 1 || reordering ? 0.25 : 0.7,
                          padding: '2px',
                          color: 'var(--foreground)',
                        }}
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '320px' }}>
                        <input
                          type="text"
                          className="input-field"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={updating}
                          style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(cat.id)}
                          disabled={updating || !editName.trim()}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={updating}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--primary)' }}>
                          {cat.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: 'rgba(30, 58, 138, 0.08)',
                            color: 'var(--muted)',
                          }}
                        >
                          {cat.song_count ?? 0} {cat.song_count === 1 ? 'song' : 'songs'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Edit & Delete Actions */}
                  {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => handleStartEdit(cat)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit2 size={13} />
                        <span>Rename</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="btn btn-secondary"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.82rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--error)',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.05)',
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          title={`Delete "${deleteTarget.name}" Category?`}
          message={`Are you sure you want to delete "${deleteTarget.name}"? This action will untag this category from all ${deleteTarget.song_count ?? 0} song(s) that currently use it.`}
          confirmLabel={deleting ? 'Deleting…' : 'Yes, Delete Category'}
          isDanger={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
