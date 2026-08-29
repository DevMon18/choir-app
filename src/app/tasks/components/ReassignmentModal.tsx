'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, Shield, ArrowRight } from 'lucide-react';
import { requestReassignment } from '../actions';
import { officerDirectReassign } from '@/app/admin/tasks/actions';
import { useToast } from '@/components/Toast';

interface MemberOption {
  id: string;
  full_name: string;
  voice_part?: string | null;
}

interface ReassignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignmentId: string;
  taskTitle: string;
  responsibility: string;
  members: MemberOption[];
  isOfficer?: boolean;
  onSuccess: () => void;
}

export const ReassignmentModal: React.FC<ReassignmentModalProps> = ({
  isOpen,
  onClose,
  assignmentId,
  taskTitle,
  responsibility,
  members,
  isOfficer = false,
  onSuccess,
}) => {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState('');
  const [suggestedMemberId, setSuggestedMemberId] = useState('');
  const [isDirectReassign, setIsDirectReassign] = useState(isOfficer);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsDirectReassign(isOfficer);
  }, [isOfficer]);

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

    if (isDirectReassign && isOfficer) {
      if (!suggestedMemberId) {
        addToast({ type: 'warning', title: 'Member Required', message: 'Please select a new member to assign this responsibility to.' });
        return;
      }

      setLoading(true);
      const res = await officerDirectReassign(assignmentId, suggestedMemberId, reason.trim());
      setLoading(false);

      if (res.error) {
        addToast({ type: 'error', title: 'Direct Reassignment Failed', message: res.error });
      } else {
        addToast({
          type: 'success',
          title: 'Directly Reassigned',
          message: 'Responsibility transferred immediately to the new assignee.',
        });
        setReason('');
        setSuggestedMemberId('');
        onSuccess();
        onClose();
      }
    } else {
      if (!reason.trim()) {
        addToast({ type: 'warning', title: 'Reason Required', message: 'Please state why you need to request reassignment.' });
        return;
      }

      setLoading(true);
      const res = await requestReassignment(assignmentId, reason.trim(), suggestedMemberId || null);
      setLoading(false);

      if (res.error) {
        addToast({ type: 'error', title: 'Request Failed', message: res.error });
      } else {
        addToast({
          type: 'success',
          title: 'Request Submitted',
          message: 'Your reassignment request was forwarded to the Director for approval.',
        });
        setReason('');
        setSuggestedMemberId('');
        onSuccess();
        onClose();
      }
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-white rounded-3xl border border-amber-500/25 shadow-2xl overflow-hidden animate-modal-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="py-5 px-6 border-b border-amber-500/15 flex items-center justify-between bg-gradient-to-br from-amber-50/50 to-amber-100/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center shadow-sm">
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold m-0 text-foreground">
                {isDirectReassign && isOfficer ? 'Direct Reassign (Officer)' : 'Request Reassignment'}
              </h3>
              <span className="text-xs text-muted font-medium">
                {taskTitle}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-secondary !w-8.5 !h-8.5 !p-0 !rounded-full !min-h-0 border border-amber-500/20 bg-white text-muted flex items-center justify-center cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 bg-white">
          {isOfficer && (
            <div className="mb-4 py-2.5 px-3.5 rounded-xl bg-primary/6 border border-primary/16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <span className="text-xs font-bold text-primary">
                  Officer Direct Action
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDirectReassign}
                  onChange={(e) => setIsDirectReassign(e.target.checked)}
                  className="accent-primary cursor-pointer"
                />
                Direct Reassign
              </label>
            </div>
          )}

          <div className="mb-4.5">
            <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">
              Responsibility
            </label>
            <div className="py-3 px-3.5 rounded-xl bg-amber-50/40 border border-primary/12 text-sm font-bold text-foreground">
              {responsibility}
            </div>
          </div>

          <div className="mb-4.5">
            <label className="block text-xs sm:text-sm font-semibold text-foreground mb-1.5">
              {isDirectReassign && isOfficer ? 'Select New Assignee' : 'Suggested Member (Optional)'}{' '}
              {isDirectReassign && isOfficer && <span className="text-error">*</span>}
            </label>
            <select
              className="input-field w-full rounded-xl py-2.5 px-3.5 text-sm bg-white border-[1.5px] border-primary/16 text-foreground cursor-pointer"
              value={suggestedMemberId}
              onChange={(e) => setSuggestedMemberId(e.target.value)}
              required={isDirectReassign && isOfficer}
            >
              <option value="">-- Select Member --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} {m.voice_part ? `(${m.voice_part})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-5.5">
            <label className="block text-sm font-bold text-foreground mb-1.5">
              {isDirectReassign && isOfficer ? 'Handover Note (Optional)' : 'Reason for Reassignment'} {!isDirectReassign && <span className="text-error">*</span>}
            </label>
            <textarea
              className="input-field w-full rounded-xl py-2.75 px-3.5 text-sm leading-relaxed bg-white border-[1.5px] border-primary/16 text-foreground"
              rows={3}
              placeholder={isDirectReassign && isOfficer ? 'Add context or instruction for the new assignee...' : 'Explain why you are unable to fulfill this responsibility...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={!isDirectReassign}
            />
          </div>

          <div className="flex gap-3 justify-end pt-3 border-t border-black/6">
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
              className="btn btn-primary !py-2.25 !px-5 text-sm !rounded-xl font-bold shadow-md"
              disabled={loading}
            >
              {loading ? 'Processing...' : isDirectReassign && isOfficer ? 'Directly Reassign' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
