'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X, Info, AlertTriangle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let nextId = 0;

/**
 * React-based toast container with persistent ARIA live regions.
 * The live regions always exist in the DOM so screen readers can detect them.
 * Toasts are triggered via the custom 'app-toast' event dispatched by lib/toast.ts.
 */
export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.message) {
        addToast(detail.message, detail.type || 'success');
      }
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, [addToast]);

  const successInfoToasts = toasts.filter((t) => t.type !== 'error');
  const errorToasts = toasts.filter((t) => t.type === 'error');

  const icon = (type: ToastType) => {
    if (type === 'success') return <Check className="w-4 h-4 flex-shrink-0" />;
    if (type === 'error') return <AlertTriangle className="w-4 h-4 flex-shrink-0" />;
    return <Info className="w-4 h-4 flex-shrink-0" />;
  };

  const bg = (type: ToastType) =>
    type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-600';

  return (
    <>
      {/* Polite live region for success/info — always in DOM */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[99999] flex flex-col items-end gap-2 pointer-events-none"
      >
        {successInfoToasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-[13px] font-medium text-white ${bg(t.type)}`}
          >
            {icon(t.type)}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Assertive live region for errors — always in DOM */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[99999] flex flex-col items-end gap-2 pointer-events-none"
        style={{ bottom: successInfoToasts.length > 0 ? `${successInfoToasts.length * 52 + 16}px` : '16px' }}
      >
        {errorToasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-[13px] font-medium text-white bg-red-600"
          >
            {icon(t.type)}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}
