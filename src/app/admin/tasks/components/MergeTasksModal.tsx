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
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(11, 77, 36, 0.16)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(11, 77, 36, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              <GitMerge size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#1e3a8a' }}>
                Merge & Consolidate Tasks
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#3b82f6', margin: '2px 0 0' }}>
                Combine duplicate tasks into one master task without losing member progress
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              width: '34px',
              height: '34px',
              padding: 0,
              borderRadius: '50%',
              minHeight: 'auto',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              background: '#ffffff',
              color: '#1e3a8a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleMerge} style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Step 1: Select Primary Target Task */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 800, color: '#111c14', marginBottom: '6px' }}>
              1. Keep as Primary Master Task <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <select
              className="input-field"
              value={targetTaskId}
              onChange={(e) => {
                const newTargetId = e.target.value;
                setTargetTaskId(newTargetId);
                const found = activeTasks.find((t) => t.id === newTargetId);
                if (found) setCustomTitle(found.title);
                // Remove new target from sourceTaskIds if present
                setSourceTaskIds((prev) => prev.filter((id) => id !== newTargetId));
              }}
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14', fontSize: '0.9rem' }}
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
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5c675e', marginBottom: '6px' }}>
              Consolidated Task Title
            </label>
            <input
              type="text"
              className="input-field"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="e.g. Recollection Materials"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '12px', background: '#ffffff', color: '#111c14' }}
            />
          </div>

          {/* Step 3: Select Duplicate Tasks to Merge */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ fontSize: '0.86rem', fontWeight: 800, color: '#111c14' }}>
                2. Select Tasks to Merge into Primary ({sourceTaskIds.length} Selected)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={selectAllSources}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563eb',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllSources}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Source Tasks List */}
            <div
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1.5px solid rgba(11, 77, 36, 0.14)',
                borderRadius: '14px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                background: '#faf8f3',
              }}
            >
              {availableSources.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#5c675e', fontSize: '0.86rem' }}>
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
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: isSelected ? 'rgba(37, 99, 235, 0.08)' : '#ffffff',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '6px',
                            border: isSelected ? '2px solid #2563eb' : '2px solid #cbd5e1',
                            background: isSelected ? '#2563eb' : '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                          }}
                        >
                          {isSelected && <Check size={14} />}
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.88rem', color: '#111c14', display: 'block' }}>
                            {t.title}
                          </strong>
                          {t.description && (
                            <span style={{ fontSize: '0.78rem', color: '#5c675e' }}>
                              {t.description.slice(0, 70)}{t.description.length > 70 ? '...' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#5c675e' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
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
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1.5px solid rgba(22, 163, 74, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#16a34a',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Layers size={16} />
                </div>
                <div>
                  <strong style={{ fontSize: '0.86rem', color: '#14532d', display: 'block' }}>
                    Consolidation Summary
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: '#15803d' }}>
                    Merging {sourceTaskIds.length} task(s) into &ldquo;{targetTask.title}&rdquo;.
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#14532d' }}>
                Total Combined Assignees: {totalCombinedAssignees}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div
            style={{
              paddingTop: '14px',
              borderTop: '1px solid rgba(11, 77, 36, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '10px 18px', fontSize: '0.88rem', borderRadius: '12px' }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || sourceTaskIds.length === 0}
              style={{
                padding: '10px 22px',
                fontSize: '0.9rem',
                borderRadius: '12px',
                fontWeight: 700,
                background: sourceTaskIds.length === 0 ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                border: 'none',
                cursor: sourceTaskIds.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: sourceTaskIds.length === 0 ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.3)',
              }}
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
