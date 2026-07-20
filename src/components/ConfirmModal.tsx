'use client';

import React from 'react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99998,
        padding: '20px',
        animation: 'fadeIn 0.2s ease',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--glass-bg, #fff)',
          border: '1px solid var(--glass-border, rgba(255,255,255,0.4))',
          borderRadius: '20px',
          padding: '32px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2), 0 8px 20px rgba(0,0,0,0.1)',
          animation: 'slideUpModal 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: isDanger ? 'rgba(220,38,38,0.1)' : 'rgba(11,77,36,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          {isDanger ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        <h3
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: isDanger ? '#b91c1c' : 'var(--primary)',
            marginBottom: '10px',
          }}
        >
          {title}
        </h3>

        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--muted)',
            lineHeight: 1.6,
            marginBottom: '28px',
          }}
        >
          {message}
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ padding: '10px 20px', minWidth: '90px' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-primary"
            style={{
              padding: '10px 20px',
              minWidth: '90px',
              background: isDanger ? '#dc2626' : undefined,
              borderColor: isDanger ? '#dc2626' : undefined,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
