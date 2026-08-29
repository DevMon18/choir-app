'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, X, Sparkles } from 'lucide-react';
import { updateAssignmentStatus } from '../actions';
import { useToast } from '@/components/Toast';

interface CompleteTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  taskTitle: string;
  responsibility: string;
  onSuccess: () => void;
}

export const CompleteTaskModal: React.FC<CompleteTaskModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  taskTitle,
  responsibility,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await updateAssignmentStatus(
      assignmentId,
      'completed',
      undefined,
      comment.trim() || undefined
    );
    setLoading(false);

    if (res?.error) {
      addToast({ type: 'error', title: 'Unable to Complete Task', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Task Completed! 🎉',
        message: 'Responsibility marked completed and archived from active tasks.',
      });
      setComment('');
      onSuccess();
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[500px] bg-white rounded-3xl border border-primary/25 shadow-2xl overflow-hidden animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-5 px-6 bg-gradient-to-br from-primary/8 to-emerald-700/4 border-b border-primary/12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10.5 h-10.5 rounded-xl bg-gradient-to-br from-primary to-emerald-700 text-white flex items-center justify-center shadow-md">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-foreground m-0">
                Complete Task
              </h3>
              <p className="text-xs text-muted mt-0.5 m-0">
                Confirm completion of your assigned responsibility
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon text-muted bg-transparent border-0 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4.5">
          {/* Target Task Summary Card */}
          <div className="py-3.5 px-4 rounded-xl bg-slate-50 border border-black/6">
            <div className="text-xs font-bold text-primary uppercase tracking-wider">
              Task
            </div>
            <div className="text-sm font-bold text-foreground mt-0.5">
              {taskTitle}
            </div>
            <div className="text-xs text-muted mt-1">
              <span className="font-semibold">Responsibility:</span> {responsibility}
            </div>
          </div>

          <div className="text-sm text-foreground leading-relaxed">
            Are you sure you want to mark this task as completed? It will be archived from your active task dashboard.
          </div>

          {/* Optional Completion Note */}
          <div>
            <label className="flex items-center justify-between text-sm font-bold text-foreground mb-2">
              <span>Completion Note <span className="font-normal text-muted">(optional)</span></span>
              <span className="text-xs text-muted">Visible to Officers</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., Completed all sheet music sorting and handed them over to the soprano section leader..."
              rows={3}
              className="input w-full rounded-xl py-3 px-3.5 text-sm leading-relaxed resize-y bg-neutral-50"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 justify-end mt-1.5">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary !rounded-xl !py-2.5 !px-4.5 text-sm"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary !rounded-xl !py-2.5 !px-5 text-sm inline-flex items-center gap-2 bg-gradient-to-br from-primary to-emerald-700 shadow-md"
              disabled={loading}
            >
              {loading ? (
                <span>Completing...</span>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Complete Task</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
