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
          maxWidth: '500px',
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid rgba(249, 115, 22, 0.25)',
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
            borderBottom: '1px solid rgba(249, 115, 22, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(249, 115, 22, 0.18)',
                color: '#ea580c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(249, 115, 22, 0.15)',
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#111c14' }}>
                Can&apos;t Complete Task
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
              border: '1px solid rgba(249, 115, 22, 0.2)',
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
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#5c675e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Your Responsibility
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

          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '0.86rem', fontWeight: 700, color: '#111c14', marginBottom: '6px' }}>
              Why can&apos;t you complete this? <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Explain what is preventing you from completing this task (e.g. scheduling conflict, missing resources, ill, etc.)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '0.9rem',
                lineHeight: 1.45,
                background: '#ffffff',
                border: '1.5px solid rgba(249, 115, 22, 0.35)',
                color: '#111c14',
              }}
            />
            <span style={{ display: 'block', fontSize: '0.76rem', color: '#5c675e', marginTop: '6px', fontWeight: 500 }}>
              The Choir Director and Officers will be notified to assist or reassign if needed.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
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
                background: '#ea580c',
                borderColor: '#ea580c',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)',
              }}
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
