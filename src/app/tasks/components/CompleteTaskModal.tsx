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
          border: '1px solid rgba(11, 77, 36, 0.25)',
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
            background: 'linear-gradient(135deg, rgba(11, 77, 36, 0.08) 0%, rgba(21, 128, 61, 0.04) 100%)',
            borderBottom: '1px solid rgba(11, 77, 36, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary, #0b4d24) 0%, #15803d 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(11, 77, 36, 0.25)',
              }}
            >
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--foreground)', margin: 0 }}>
                Complete Task
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '2px 0 0 0' }}>
                Confirm completion of your assigned responsibility
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon"
            style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Target Task Summary Card */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              background: '#f8fafc',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Task
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)', marginTop: '2px' }}>
              {taskTitle}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '4px' }}>
              <span style={{ fontWeight: 600 }}>Responsibility:</span> {responsibility}
            </div>
          </div>

          <div style={{ fontSize: '0.88rem', color: 'var(--foreground)', lineHeight: 1.5 }}>
            Are you sure you want to mark this task as completed? It will be archived from your active task dashboard.
          </div>

          {/* Optional Completion Note */}
          <div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--foreground)',
                marginBottom: '8px',
              }}
            >
              <span>Completion Note <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></span>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Visible to Officers</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g., Completed all sheet music sorting and handed them over to the soprano section leader..."
              rows={3}
              className="input"
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '0.88rem',
                lineHeight: '1.45',
                resize: 'vertical',
                background: '#fafafa',
              }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
              style={{ borderRadius: '12px', padding: '10px 18px', fontSize: '0.88rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                borderRadius: '12px',
                padding: '10px 20px',
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, var(--primary, #0b4d24) 0%, #15803d 100%)',
                boxShadow: '0 4px 12px rgba(11, 77, 36, 0.25)',
              }}
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
