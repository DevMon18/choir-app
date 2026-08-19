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
          maxWidth: '560px',
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
            background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#78350f' }}>
                Resolve &ldquo;Can&rsquo;t Complete&rdquo; Issue
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '2px 0 0' }}>
                Provide assistance notes and resume this task for the member
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
              border: '1px solid rgba(217, 119, 6, 0.25)',
              background: '#ffffff',
              color: '#92400e',
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

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Member & Blocker Detail Card */}
          <div
            style={{
              padding: '16px',
              borderRadius: '16px',
              background: '#faf8f3',
              border: '1.5px solid rgba(217, 119, 6, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar
                src={assignment.member?.avatar_url}
                name={assignment.member?.full_name}
                size="md"
                border
              />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.96rem', color: '#111c14', display: 'block' }}>
                  {assignment.member?.full_name || 'Member'}
                </strong>
                <span style={{ fontSize: '0.82rem', color: '#5c675e' }}>
                  {taskTitle ? `${taskTitle} · ` : ''}{assignment.responsibility}
                </span>
              </div>
            </div>

            {assignment.blocker_reason && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(234, 88, 12, 0.08)',
                  border: '1px solid rgba(234, 88, 12, 0.2)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} style={{ color: '#ea580c', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', display: 'block' }}>
                    Member&apos;s Stated Reason:
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '0.86rem', color: '#9a3412', lineHeight: 1.4 }}>
                    &ldquo;{assignment.blocker_reason}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Resolution Note Field */}
          <div>
            <label style={{ display: 'block', fontSize: '0.84rem', fontWeight: 700, color: '#111c14', marginBottom: '6px' }}>
              Officer Assistance / Resolution Instructions <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <textarea
              className="input-field"
              rows={3}
              placeholder="e.g. Provided updated materials, rescheduled deadline, assisted with transportation..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              required
              style={{
                width: '100%',
                borderRadius: '12px',
                padding: '12px 14px',
                fontSize: '0.9rem',
                background: '#ffffff',
                border: '1.5px solid rgba(11, 77, 36, 0.18)',
                color: '#111c14',
                lineHeight: 1.4,
              }}
            />
            <span style={{ display: 'block', fontSize: '0.76rem', color: '#5c675e', marginTop: '4px' }}>
              This note will be logged in the task history and the member will be notified that the task is resumed.
            </span>
          </div>

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
              disabled={loading}
              className="btn btn-primary"
              style={{
                padding: '10px 22px',
                fontSize: '0.9rem',
                borderRadius: '12px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(11, 77, 36, 0.3)',
              }}
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
