'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, GitMerge, AlertCircle, Check, ArrowRight, Layers, Users, Calendar } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { mergeTasks } from '../actions';
import { calculateTaskSimilarity } from '../utils/similarity';
import type { TaskItem } from '@/app/tasks/types';

interface MergeTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  initialTargetTask?: TaskItem | null;
  initialSourceTasks?: TaskItem[];
  onSuccess: () => void;
}

export const MergeTasksModal: React.FC<MergeTasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  initialTargetTask,
  initialSourceTasks = [],
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [targetTaskId, setTargetTaskId] = useState<string>('');
  const [sourceTaskIds, setSourceTaskIds] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const activeTasks = useMemo(() => tasks.filter((t) => !t.is_archived), [tasks]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialTargetTask) {
      setTargetTaskId(initialTargetTask.id);
      setCustomTitle(initialTargetTask.title);
      if (initialSourceTasks.length > 0) {
        setSourceTaskIds(initialSourceTasks.map((t) => t.id));
      } else {
        setSourceTaskIds([]);
      }
    } else if (activeTasks.length > 0) {
      setTargetTaskId(activeTasks[0].id);
      setCustomTitle(activeTasks[0].title);
      setSourceTaskIds([]);
    }
  }, [initialTargetTask, initialSourceTasks, activeTasks]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const targetTask = useMemo(() => {
    return activeTasks.find((t) => t.id === targetTaskId);
  }, [activeTasks, targetTaskId]);

  // Available source tasks: ONLY tasks that are genuinely near-identical (similarity >= 92%-100% on title + description) or explicitly pre-selected
  const availableSources = useMemo(() => {
    if (!targetTask) return [];
    return activeTasks.filter((t) => {
      if (t.id === targetTaskId) return false;
      const isInitial = initialSourceTasks.some((st) => st.id === t.id);
      const similarity = calculateTaskSimilarity(
        { title: targetTask.title, description: targetTask.description },
        { title: t.title, description: t.description }
      );
      return isInitial || similarity >= 0.92;
    });
  }, [activeTasks, targetTaskId, targetTask, initialSourceTasks]);

  const filteredSources = useMemo(() => {
    return availableSources.filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    });
  }, [availableSources, search]);

  const toggleSource = (id: string) => {
    setSourceTaskIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  const selectAllSources = () => {
    setSourceTaskIds(availableSources.map((t) => t.id));
  };

  const clearAllSources = () => {
    setSourceTaskIds([]);
  };

  // Preview counts
  const targetAssigneeCount = targetTask?.assignments?.length || 0;
  const mergedAssigneeCount = activeTasks
    .filter((t) => sourceTaskIds.includes(t.id))
    .reduce((acc, curr) => acc + (curr.assignments?.length || 0), 0);
  const totalCombinedAssignees = targetAssigneeCount + mergedAssigneeCount;

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetTaskId) {
      addToast({ type: 'warning', title: 'Target Required', message: 'Please select a primary target task.' });
      return;
    }

    if (sourceTaskIds.length === 0) {
      addToast({ type: 'warning', title: 'Sources Required', message: 'Please check at least one task to merge into the primary task.' });
      return;
    }

    setLoading(true);
    const res = await mergeTasks(targetTaskId, sourceTaskIds, customTitle.trim());
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Merge Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Tasks Merged',
        message: `Merged ${res.mergedCount} duplicate task(s) into "${res.targetTitle}" (${res.assignmentsMoved} assignments combined).`,
      });
      onSuccess();
      onClose();
    }
  };

  // Safe early return only after all hooks are declared
  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[680px] max-h-[90vh] bg-white rounded-3xl border border-primary/16 shadow-2xl flex flex-col overflow-hidden animate-slideUpModal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="py-5 px-6 border-b border-primary/10 flex items-center justify-between bg-gradient-to-br from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/25">
              <GitMerge size={20} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold m-0 text-blue-900">
                Merge & Consolidate Tasks
              </h2>
              <p className="text-xs text-blue-600 mt-0.5 mb-0">
                Combine duplicate tasks into one master task without losing member progress
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-[34px] !h-[34px] !p-0 !rounded-full !min-h-0 !border-blue-600/20 bg-white text-blue-900 flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleMerge} className="flex-1 overflow-y-auto p-5 sm:py-5.5 sm:px-6 flex flex-col gap-4.5">
          {/* Step 1: Select Primary Target Task */}
          <div>
            <label className="block text-xs sm:text-sm font-extrabold text-foreground mb-1.5">
              1. Keep as Primary Master Task <span className="text-error">*</span>
            </label>
            <select
              className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground text-sm"
              value={targetTaskId}
              onChange={(e) => {
                const newTargetId = e.target.value;
                setTargetTaskId(newTargetId);
                const found = activeTasks.find((t) => t.id === newTargetId);
                if (found) setCustomTitle(found.title);
                // Remove new target from sourceTaskIds if present
                setSourceTaskIds((prev) => prev.filter((id) => id !== newTargetId));
              }}
            >
              {activeTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.assignments?.length || 0} assignees) {t.due_date ? `· Due ${new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Final Task Title */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-muted mb-1.5">
              Consolidated Task Title
            </label>
            <input
              type="text"
              className="input-field w-full !py-2.5 !px-3.5 !rounded-xl bg-white text-foreground"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Recollection Materials"
            />
          </div>

          {/* Step 3: Select Duplicate Tasks to Merge */}
          <div>
            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
              <label className="text-xs sm:text-sm font-extrabold text-foreground">
                2. Select Tasks to Merge into Primary ({sourceTaskIds.length} Selected)
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAllSources}
                  className="bg-transparent border-0 text-blue-600 text-xs font-bold cursor-pointer underline"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllSources}
                  className="bg-transparent border-0 text-slate-500 text-xs font-semibold cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Source Tasks List */}
            <div className="max-h-[220px] overflow-y-auto border border-primary/15 rounded-2xl p-2 flex flex-col gap-1.5 bg-[#faf8f3]">
              {availableSources.length === 0 ? (
                <div className="py-6 px-4 text-center text-muted text-xs sm:text-sm">
                  No other active tasks with similar titles found for &ldquo;{targetTask?.title}&rdquo;.
                </div>
              ) : (
                filteredSources.map((t) => {
                  const isSelected = sourceTaskIds.includes(t.id);
                  const assignees = t.assignments?.length || 0;

                  return (
                    <div
                      key={t.id}
                      onClick={() => toggleSource(t.id)}
                      className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl cursor-pointer transition-all duration-150 ${
                        isSelected ? 'bg-blue-600/8 border-1.5 border-blue-600' : 'bg-white border border-black/6'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-white ${
                            isSelected ? 'border-2 border-blue-600 bg-blue-600' : 'border-2 border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check size={14} />}
                        </div>
                        <div>
                          <strong className="text-xs sm:text-sm text-foreground block">
                            {t.title}
                          </strong>
                          {t.description && (
                            <span className="text-xs text-muted">
                              {t.description.slice(0, 70)}{t.description.length > 70 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="inline-flex items-center gap-1 bg-black/5 py-0.5 px-2 rounded-md">
                          <Users size={12} /> {assignees} {assignees === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Consolidation Summary Card */}
          {sourceTaskIds.length > 0 && targetTask && (
            <div className="py-3.5 px-4 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-100 border border-green-600/30 flex items-center justify-between flex-wrap gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center">
                  <Layers size={16} />
                </div>
                <div>
                  <strong className="text-xs sm:text-sm text-green-900 block">
                    Consolidation Summary
                  </strong>
                  <span className="text-xs text-green-700">
                    Merging {sourceTaskIds.length} task(s) into &ldquo;{targetTask.title}&rdquo;.
                  </span>
                </div>
              </div>

              <div className="text-xs sm:text-sm font-extrabold text-green-900">
                Total Combined Assignees: {totalCombinedAssignees}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3.5 border-t border-primary/10 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary !py-2.5 !px-4.5 text-xs sm:text-sm !rounded-xl"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || sourceTaskIds.length === 0}
              className={`py-2.5 px-5.5 text-xs sm:text-sm rounded-xl font-bold border-none text-white inline-flex items-center gap-2 ${
                sourceTaskIds.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 cursor-pointer shadow-md shadow-blue-600/30'
              }`}
            >
              <GitMerge size={16} />
              <span>{loading ? 'Merging Tasks...' : `Merge Selected (${sourceTaskIds.length})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
