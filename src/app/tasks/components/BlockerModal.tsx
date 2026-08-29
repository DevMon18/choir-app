'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { updateAssignmentStatus } from '../actions';
import { useToast } from '@/components/Toast';

interface BlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  taskTitle: string;
  responsibility: string;
  onSuccess: () => void;
}

export const BlockerModal: React.FC<BlockerModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  taskTitle,
  responsibility,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState('');
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
    if (!reason.trim()) {
      addToast({ type: 'warning', title: 'Reason Required', message: 'Please explain why you cannot complete this task.' });
      return;
    }

    setLoading(true);
    const res = await updateAssignmentStatus(assignmentId, 'blocked', reason.trim());
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Error', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Status Updated',
        message: 'Your update has been logged and sent to the Choir Director.',
      });
      setReason('');
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
        className="w-full max-w-[500px] bg-white rounded-3xl border border-orange-500/25 shadow-2xl overflow-hidden animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-5 px-6 border-b border-orange-500/15 flex items-center justify-between bg-gradient-to-br from-orange-50 to-orange-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/18 text-orange-600 flex items-center justify-center shadow-sm">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold m-0 text-foreground">
                Can&apos;t Complete Task
              </h3>
              <span className="text-xs text-muted font-medium">
                {taskTitle}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-8.5 !h-8.5 !p-0 !rounded-full !min-h-0 border border-orange-500/20 bg-white text-muted flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 bg-white">
          <div className="mb-4.5">
            <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
              Your Responsibility
            </label>
            <div className="py-3 px-3.5 rounded-xl bg-amber-50/40 border border-primary/12 text-sm font-bold text-foreground">
              {responsibility}
            </div>
          </div>

          <div className="mb-5.5">
            <label className="block text-sm font-bold text-foreground mb-1.5">
              Why can&apos;t you complete this? <span className="text-error">*</span>
            </label>
            <textarea
              className="input-field w-full rounded-xl py-3 px-3.5 text-sm leading-relaxed bg-white border-[1.5px] border-orange-500/35 text-foreground"
              rows={4}
              placeholder="Explain what is preventing you from completing this task (e.g. scheduling conflict, missing resources, ill, etc.)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              autoFocus
            />
            <span className="block text-xs text-muted mt-1.5 font-medium">
              The Choir Director and Officers will be notified to assist or reassign if needed.
            </span>
          </div>

          <div className="flex gap-3 justify-end pt-2.5 border-t border-black/6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary !py-2.25 !px-4.5 text-sm !rounded-xl"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary !py-2.25 !px-5 text-sm !rounded-xl bg-orange-600 border-orange-600 font-bold shadow-md hover:bg-orange-700"
              disabled={loading}
            >
              {loading ? 'Submitting...' : "Submit Reason"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
