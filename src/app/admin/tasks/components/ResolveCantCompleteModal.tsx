'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, MessageSquare, ArrowRight, ShieldCheck } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { resolveCantComplete } from '../actions';
import { useToast } from '@/components/Toast';
import type { TaskAssignmentItem } from '@/app/tasks/types';

interface ResolveCantCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: TaskAssignmentItem | null;
  taskTitle?: string;
  onSuccess: () => void;
}

export const ResolveCantCompleteModal: React.FC<ResolveCantCompleteModalProps> = ({
  isOpen,
  onClose,
  assignment,
  taskTitle,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('Issue resolved by Officer');
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (assignment) {
      setResolutionNote('Issue resolved by Officer');
    }
  }, [assignment]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || !assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolutionNote.trim()) {
      addToast({
        type: 'warning',
        title: 'Note Required',
        message: 'Please provide a brief note on how this blocker was resolved.',
      });
      return;
    }

    setLoading(true);
    const res = await resolveCantComplete(assignment.id, resolutionNote.trim());
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Resolution Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Status Resolved',
        message: `Task has been resumed for ${assignment.member?.full_name || 'member'}.`,
      });
      onSuccess();
      onClose();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] max-h-[90vh] bg-white rounded-3xl border border-primary/16 shadow-2xl flex flex-col overflow-hidden animate-slideUpModal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="py-5 px-6 border-b border-primary/10 flex items-center justify-between bg-gradient-to-br from-yellow-50 to-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center shadow-md shadow-amber-600/25">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold m-0 text-amber-900">
                Resolve &ldquo;Can&rsquo;t Complete&rdquo; Issue
              </h2>
              <p className="text-xs text-amber-800 mt-0.5 mb-0">
                Provide assistance notes and resume this task for the member
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-[34px] !h-[34px] !p-0 !rounded-full !min-h-0 !border-amber-600/25 bg-white text-amber-800 flex items-center justify-center cursor-pointer"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:py-5.5 sm:px-6 flex flex-col gap-4.5">
          {/* Member & Blocker Detail Card */}
          <div className="p-4 rounded-2xl bg-[#faf8f3] border-1.5 border-amber-600/20 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar
                src={assignment.member?.avatar_url}
                name={assignment.member?.full_name}
                size="md"
                border
              />
              <div className="flex-1">
                <strong className="text-sm sm:text-[0.96rem] text-foreground block">
                  {assignment.member?.full_name || 'Member'}
                </strong>
                <span className="text-xs sm:text-[0.82rem] text-muted">
                  {taskTitle ? `${taskTitle} · ` : ''}{assignment.responsibility}
                </span>
              </div>
            </div>

            {assignment.blocker_reason && (
              <div className="py-2.5 px-3 rounded-xl bg-orange-600/8 border border-orange-600/20 flex items-start gap-2">
                <AlertTriangle size={16} className="text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-orange-700 uppercase block">
                    Member&apos;s Stated Reason:
                  </span>
                  <p className="mt-0.5 mb-0 text-xs sm:text-sm text-orange-800 leading-normal">
                    &ldquo;{assignment.blocker_reason}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Resolution Note Field */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-foreground mb-1.5">
              Officer Assistance / Resolution Instructions <span className="text-error">*</span>
            </label>
            <textarea
              className="input-field w-full !rounded-xl !py-3 !px-3.5 text-sm bg-white border-primary/20 text-foreground leading-normal"
              rows={3}
              placeholder="e.g. Provided updated materials, rescheduled deadline, assisted with transportation..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              required
            />
            <span className="block text-xs text-muted mt-1">
              This note will be logged in the task history and the member will be notified that the task is resumed.
            </span>
          </div>

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
              disabled={loading}
              className="btn btn-primary !py-2.5 !px-5 text-xs sm:text-sm !rounded-xl font-bold inline-flex items-center gap-2 shadow-md shadow-primary/30"
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Resolving...' : 'Resolve Issue & Resume Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
