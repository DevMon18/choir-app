'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      addToast: () => {},
      removeToast: () => {},
    };
  }
  return ctx;
};

const ICONS: Record<ToastType, React.ReactElement> = {
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
};

const COLORS: Record<ToastType, { bg: string; icon: string; border: string; title: string }> = {
  success: { bg: '#f0fdf4', icon: '#16a34a', border: '#bbf7d0', title: '#15803d' },
  error:   { bg: '#fef2f2', icon: '#dc2626', border: '#fecaca', title: '#b91c1c' },
  warning: { bg: '#fffbeb', icon: '#d97706', border: '#fde68a', title: '#b45309' },
  info:    { bg: '#eff6ff', icon: '#2563eb', border: '#bfdbfe', title: '#1d4ed8' },
};

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: () => void }) => {
  const colors = COLORS[toast.type];
  const [visible, setVisible] = useState(true);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onRemove, 300);
  }, [onRemove]);

  React.useEffect(() => {
    const t = setTimeout(handleClose, toast.duration ?? 4000);
    return () => clearTimeout(t);
  }, [handleClose, toast.duration]);

  return (
    <div
      className={`flex items-start gap-3 p-3.5 sm:px-4 rounded-xl shadow-lg min-w-[300px] max-w-[420px] w-full transition-all duration-300 cursor-default ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span style={{ color: colors.icon }} className="shrink-0 mt-0.5">
        {ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p style={{ color: colors.title }} className="font-semibold text-sm m-0">
          {toast.title}
        </p>
        {toast.message && (
          <p className="text-xs text-gray-500 mt-1 m-0 leading-snug">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="bg-transparent border-0 cursor-pointer text-gray-400 p-0 leading-none shrink-0 text-lg hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { ...t, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem
              toast={toast}
              onRemove={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
