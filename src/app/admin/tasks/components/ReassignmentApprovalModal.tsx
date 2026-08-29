'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { approveReassignment, rejectReassignment } from '../actions';
import { useToast } from '@/components/Toast';
import type { TaskRequestItem } from '@/app/tasks/types';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
}

interface ReassignmentApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: TaskRequestItem;
  members: MemberOption[];
  onSuccess: () => void;
}

export const ReassignmentApprovalModal: React.FC<ReassignmentApprovalModalProps> = ({
  isOpen,
  onClose,
  request,
  members,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    request.suggested_member_id || ''
  );
  const [reviewNote, setReviewNote] = useState('');
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

  const handleApprove = async () => {
    if (!selectedMemberId) {
      addToast({ type: 'warning', title: 'Member Required', message: 'Please choose which choir member will take over this responsibility.' });
      return;
    }

    setLoading(true);
    const res = await approveReassignment(request.id, selectedMemberId, reviewNote);
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Approval Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Reassignment Approved',
        message: 'Responsibility successfully reassigned and members notified.',
      });
      onSuccess();
      onClose();
    }
  };

  const handleReject = async () => {
    if (!reviewNote.trim()) {
      addToast({ type: 'warning', title: 'Reason Required', message: 'Please provide a short explanation for declining this request.' });
      return;
    }

    setLoading(true);
    const res = await rejectReassignment(request.id, reviewNote.trim());
    setLoading(false);

    if (res.error) {
      addToast({ type: 'error', title: 'Action Failed', message: res.error });
    } else {
      addToast({
        type: 'success',
        title: 'Request Declined',
        message: 'The member has been notified of your decision.',
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
        className="w-full max-w-[540px] bg-white rounded-3xl border border-accent/25 shadow-2xl overflow-hidden animate-slideUpModal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-5 px-6 border-b border-accent/15 flex items-center justify-between bg-gradient-to-br from-[#fdfbf7] to-[#f7f1e5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center shadow-sm">
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold m-0 text-foreground">
                Review Reassignment Request
              </h3>
              <span className="text-xs text-muted font-medium">
                Requested by {request.requester?.full_name}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-[34px] !h-[34px] !p-0 !rounded-full !min-h-0 !border-accent/20 bg-white text-muted flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-white">
          {/* Responsibility & Reason Box */}
          <div className="py-3.5 px-4 rounded-2xl bg-[#faf8f3] border border-primary/12 mb-4.5">
            <div className="text-xs font-bold text-muted uppercase mb-0.5">
              Responsibility
            </div>
            <div className="text-base font-extrabold text-foreground mb-2.5">
              {request.assignment?.responsibility}
            </div>

            <div className="text-xs font-bold text-muted uppercase mb-0.5">
              Member&apos;s Reason
            </div>
            <p className="m-0 text-sm text-foreground leading-relaxed italic">
              &ldquo;{request.reason}&rdquo;
            </p>
          </div>

          {/* New Assignee Selection */}
          <div className="mb-4.5">
            <label className="block text-sm font-bold text-foreground mb-1.5">
              Reassign To Member <span className="text-error">*</span>
            </label>
            <select
              className="input-field w-full !rounded-xl !py-2.5 !px-3.5 text-sm cursor-pointer bg-white border-primary/20 text-foreground"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
            >
              <option value="">-- Select Member to delegate to --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} {m.voice_part ? `(${m.voice_part})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Director Review Note */}
          <div className="mb-5.5">
            <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5">
              Director Note / Feedback (Optional)
            </label>
            <textarea
              className="input-field w-full !rounded-xl !py-2.5 !px-3.5 text-sm bg-white border-primary/20 text-foreground"
              rows={2}
              placeholder="e.g. Approved and reassigned to Pedro. Thanks for letting us know early."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 justify-between items-center pt-3 border-t border-black/6">
            <button
              type="button"
              onClick={handleReject}
              className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm !rounded-xl !text-error !border-error/30 font-semibold"
              disabled={loading}
            >
              Decline Request
            </button>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary !py-2 !px-4 text-xs sm:text-sm !rounded-xl"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="btn btn-primary !py-2 !px-5 text-xs sm:text-sm !rounded-xl inline-flex items-center gap-1.5 font-bold shadow-md shadow-primary/25"
                disabled={loading || !selectedMemberId}
              >
                <CheckCircle2 size={16} /> Approve & Reassign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
