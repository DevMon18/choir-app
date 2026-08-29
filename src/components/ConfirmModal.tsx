'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center z-[999999999] p-5 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-slate-300 rounded-[20px] p-8 max-w-[440px] w-full text-slate-900 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mb-5 ${
            isDanger ? 'bg-red-500/10 text-red-600' : 'bg-primary/10 text-primary'
          }`}
        >
          {isDanger ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        <h3
          className={`text-xl font-bold mb-2.5 ${
            isDanger ? 'text-red-700' : 'text-slate-900'
          }`}
        >
          {title}
        </h3>

        <p className="text-sm text-slate-600 leading-relaxed mb-7 m-0">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="py-2.5 px-5 min-w-[90px] rounded-lg border border-slate-300 bg-white text-slate-900 font-bold cursor-pointer hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`py-2.5 px-5 min-w-[90px] rounded-lg border-0 font-bold cursor-pointer text-white shadow-md transition-all ${
              isDanger
                ? 'bg-red-600 shadow-red-600/30 hover:bg-red-700'
                : 'bg-primary shadow-primary/30 hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
};
