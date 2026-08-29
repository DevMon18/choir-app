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
    <div className="max-w-[800px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-primary m-0 flex items-center gap-2">
            <Tag size={20} />
            <span>Song Categories & Tags</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted mt-1 m-0">
            Manage categories used to tag repertoire songs across the app.
          </p>
        </div>
      </div>

      {/* Add New Category Box */}
      <div className="glass-container p-5 mb-6 bg-white/70">
        <h4 className="text-xs sm:text-sm font-bold text-foreground mb-3 mt-0">
          Create New Category
        </h4>
        <form onSubmit={handleCreate} className="flex gap-2.5 items-center flex-wrap sm:flex-nowrap">
          <input
            type="text"
            className="input-field flex-1 !py-2.5 !px-3.5 text-xs sm:text-sm"
            placeholder="e.g. Marian, Offertory, Choral..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating || !newCatName.trim()}
            className="btn btn-primary inline-flex items-center gap-1.5 !py-2.5 !px-5 whitespace-nowrap text-xs sm:text-sm"
          >
            <Plus size={16} />
            <span>{creating ? 'Adding…' : 'Add Category'}</span>
          </button>
        </form>
      </div>

      {/* Category List */}
      <div className="glass-container p-0 overflow-hidden">
        {categories.length === 0 ? (
          <div className="p-10 text-center text-muted">
            <Tag size={32} className="opacity-40 mb-3 mx-auto" />
            <p className="m-0 text-xs sm:text-sm">No categories found. Create your first category above.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {categories.map((cat, idx) => {
              const isEditing = editingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between p-3.5 sm:py-3.5 sm:px-5 flex-wrap gap-2.5 transition-colors ${
                    idx < categories.length - 1 ? 'border-b border-glass-border' : ''
                  } ${idx % 2 === 0 ? 'bg-white/40' : 'bg-transparent'}`}
                >
                  {/* Left: Move handles & Category Name */}
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0 || reordering}
                        className={`bg-transparent border-none p-0.5 text-foreground ${
                          idx === 0 || reordering ? 'opacity-25 cursor-not-allowed' : 'opacity-70 cursor-pointer hover:opacity-100'
                        }`}
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === categories.length - 1 || reordering}
                        className={`bg-transparent border-none p-0.5 text-foreground ${
                          idx === 0 || reordering ? 'opacity-25 cursor-not-allowed' : 'opacity-70 cursor-pointer hover:opacity-100'
                        }`}
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          className="input-field flex-1 !py-1.5 !px-3 text-xs sm:text-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={updating}
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveRename(cat.id)}
                          disabled={updating || !editName.trim()}
                          className="btn btn-primary !py-1.5 !px-3 text-xs"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={updating}
                          className="btn btn-secondary !py-1.5 !px-3 text-xs"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs sm:text-sm font-semibold text-foreground">
                          {cat.name}
                        </span>
                        <span className="text-[0.72rem] font-bold py-0.5 px-2 rounded-md bg-primary/8 text-primary">
                          {cat.song_count ?? 0} {cat.song_count === 1 ? 'song' : 'songs'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right: Edit & Delete Actions */}
                  {!isEditing && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(cat)}
                        className="btn btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1"
                      >
                        <Edit2 size={13} />
                        <span>Rename</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(cat)}
                        className="btn btn-secondary !py-1.5 !px-3 text-xs inline-flex items-center gap-1 !text-error !border-red-500/30 !bg-red-500/5"
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
