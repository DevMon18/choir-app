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
          maxWidth: '540px',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(197, 160, 89, 0.25)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(197, 160, 89, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #fdfbf7 0%, #f7f1e5 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(197, 160, 89, 0.2)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(197, 160, 89, 0.15)',
              }}
            >
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                Review Reassignment Request
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#5c675e', fontWeight: 500 }}>
                Requested by {request.requester?.full_name}
              </span>
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
              border: '1px solid rgba(197, 160, 89, 0.2)',
              background: '#ffffff',
              color: '#5c675e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', background: '#ffffff' }}>
          {/* Responsibility & Reason Box */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              background: '#faf8f3',
              border: '1px solid rgba(11, 77, 36, 0.12)',
              marginBottom: '18px',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5c675e', textTransform: 'uppercase', marginBottom: '2px' }}>
              Responsibility
            </div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#111c14', marginBottom: '10px' }}>
              {request.assignment?.responsibility}
            </div>

            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#5c675e', textTransform: 'uppercase', marginBottom: '2px' }}>
              Member&apos;s Reason
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: '#111c14', lineHeight: 1.45, fontStyle: 'italic' }}>
              &ldquo;{request.reason}&rdquo;
            </p>
          </div>

          {/* New Assignee Selection */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#111c14', marginBottom: '6px' }}>
              Reassign To Member <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <select
              className="input-field"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '11px 14px',
                fontSize: '0.9rem',
                cursor: 'pointer',
                background: '#ffffff',
                border: '1.5px solid rgba(11, 77, 36, 0.16)',
                color: '#111c14',
              }}
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
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#111c14', marginBottom: '6px' }}>
              Director Note / Feedback (Optional)
            </label>
            <textarea
              className="input-field"
              rows={2}
              placeholder="e.g. Approved and reassigned to Pedro. Thanks for letting us know early."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '0.88rem',
                background: '#ffffff',
                border: '1.5px solid rgba(11, 77, 36, 0.16)',
                color: '#111c14',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button
              type="button"
              onClick={handleReject}
              className="btn btn-secondary"
              style={{
                padding: '9px 16px',
                fontSize: '0.86rem',
                borderRadius: '10px',
                color: 'var(--error)',
                borderColor: 'rgba(239,68,68,0.3)',
                fontWeight: 600,
              }}
              disabled={loading}
            >
              Decline Request
            </button>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ padding: '9px 16px', fontSize: '0.86rem', borderRadius: '10px' }}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="btn btn-primary"
                style={{
                  padding: '9px 20px',
                  fontSize: '0.86rem',
                  borderRadius: '10px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(11, 77, 36, 0.25)',
                }}
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
