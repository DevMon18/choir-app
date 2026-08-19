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
          maxWidth: '520px',
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
                {isDirectReassign && isOfficer ? 'Direct Reassign (Officer)' : 'Request Reassignment'}
              </h3>
              <span style={{ fontSize: '0.8rem', color: '#5c675e', fontWeight: 500 }}>
                {taskTitle}
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
        <form onSubmit={handleSubmit} style={{ padding: '24px', background: '#ffffff' }}>
          {isOfficer && (
            <div
              style={{
                marginBottom: '16px',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(11, 77, 36, 0.06)',
                border: '1px solid rgba(11, 77, 36, 0.16)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>
                  Officer Direct Action
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isDirectReassign}
                  onChange={(e) => setIsDirectReassign(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                Direct Reassign
              </label>
            </div>
          )}

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5c675e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Responsibility
            </label>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '12px',
                background: '#faf8f3',
                border: '1px solid rgba(11, 77, 36, 0.12)',
                fontSize: '0.92rem',
                fontWeight: 700,
                color: '#111c14',
              }}
            >
              {responsibility}
            </div>
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 600, color: '#111c14', marginBottom: '6px' }}>
              {isDirectReassign && isOfficer ? 'Select New Assignee' : 'Suggested Member (Optional)'}{' '}
              {isDirectReassign && isOfficer && <span style={{ color: 'var(--error)' }}>*</span>}
            </label>
            <select
              className="input-field"
              value={suggestedMemberId}
              onChange={(e) => setSuggestedMemberId(e.target.value)}
              required={isDirectReassign && isOfficer}
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '0.9rem',
                background: '#ffffff',
                border: '1.5px solid rgba(11, 77, 36, 0.16)',
                color: '#111c14',
                cursor: 'pointer',
              }}
            >
              <option value="">-- Select Member --</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} {m.voice_part ? `(${m.voice_part})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#111c14', marginBottom: '6px' }}>
              {isDirectReassign && isOfficer ? 'Handover Note (Optional)' : 'Reason for Reassignment'} {!isDirectReassign && <span style={{ color: 'var(--error)' }}>*</span>}
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder={isDirectReassign && isOfficer ? 'Add context or instruction for the new assignee...' : 'Explain why you are unable to fulfill this responsibility...'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required={!isDirectReassign}
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '11px 14px',
                fontSize: '0.9rem',
                lineHeight: 1.45,
                background: '#ffffff',
                border: '1.5px solid rgba(11, 77, 36, 0.16)',
                color: '#111c14',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '9px 18px', fontSize: '0.88rem', borderRadius: '10px' }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '9px 20px',
                fontSize: '0.88rem',
                borderRadius: '10px',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(11, 77, 36, 0.3)',
              }}
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
