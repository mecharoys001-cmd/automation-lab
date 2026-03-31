'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Tooltip } from './Tooltip';

/* ─────────────────────────────────────────────────────────────
 * MODAL COMPONENT
 * 
 * Standard modal with sticky header (X button) and sticky footer 
 * (action buttons). Enforces the sticky button pattern for all modals.
 * 
 * USAGE:
 * 
 * <Modal
 *   open={isOpen}
 *   onClose={handleClose}
 *   title="Edit Event"
 *   width="600px"
 *   footer={
 *     <>
 *       <button onClick={handleDelete}>Delete</button>
 *       <button onClick={handleClose}>Cancel</button>
 *       <button onClick={handleSave}>Save</button>
 *     </>
 *   }
 * >
 *   <form>...</form>
 * </Modal>
 * 
 * STRUCTURE:
 * - Container: flex flex-col max-h-[calc(100vh-2rem)]
 * - Header: shrink-0 (sticky top with X button)
 * - Body: flex-1 overflow-y-auto (scrollable content)
 * - Footer: shrink-0 (sticky bottom with action buttons)
 * 
 * WHY THIS PATTERN:
 * - Buttons always visible without scrolling
 * - Consistent UX across all modals
 * - Long forms remain usable on small screens
 * ───────────────────────────────────────────────────────────── */

export interface ModalWarning {
  id: string;
  label: string;
  message: React.ReactNode;
}

export interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when modal should close (X button or backdrop click) */
  onClose: () => void;
  /** Modal title shown in header */
  title: string;
  /** Modal content (form, details, etc.) */
  children: React.ReactNode;
  /** Footer content (action buttons) */
  footer?: React.ReactNode;
  /** Modal width (default: 600px) */
  width?: string | number;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Disable backdrop click to close (default: false) */
  disableBackdropClose?: boolean;
  /** Custom class for modal container */
  className?: string;
  /** Ref to the scrollable body container (for IntersectionObserver, sticky warnings, etc.) */
  bodyRef?: React.Ref<HTMLDivElement>;
  /** Validation warnings displayed as cards between body and footer */
  warnings?: ModalWarning[];
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = '600px',
  subtitle,
  disableBackdropClose = false,
  className = '',
  bodyRef,
  warnings,
}: ModalProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const prevWarningIdsRef = useRef<string>('');

  // Reset dismissed set when warnings array changes (new warnings should show)
  const warningIdKey = warnings?.map((w) => w.id).join(',') ?? '';
  if (warningIdKey !== prevWarningIdsRef.current) {
    prevWarningIdsRef.current = warningIdKey;
    if (dismissedIds.size > 0) setDismissedIds(new Set());
  }

  const dismissWarning = useCallback((id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and Escape key handler
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    // Focus first focusable element on open
    const timer = setTimeout(() => {
      if (modalRef.current) {
        const first = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      }
    }, 0);

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const visibleWarnings = warnings?.filter((w) => !dismissedIds.has(w.id));

  const handleBackdropClick = () => {
    if (!disableBackdropClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-[70] rounded-2xl bg-white shadow-xl flex flex-col overflow-hidden max-h-[calc(100vh-2rem)] ${className}`}
        style={{ width }}
      >
        {/* ── Header (sticky top) ──────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="modal-title" className="text-xl font-bold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>
            )}
          </div>
          <Tooltip text="Close">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </Tooltip>
        </div>

        {/* ── Body (scrollable) ────────────────────────────── */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto">
          {children}

          {/* ── Warnings (scrollable, inside body) ───────────── */}
          {visibleWarnings && visibleWarnings.length > 0 && (
            <div className="border-t border-red-200 bg-red-50 space-y-0">
              {visibleWarnings.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 px-6 py-3 border-b border-red-100 last:border-b-0 relative group"
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-red-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-red-700">{w.label}</span>
                    <p className="text-xs text-red-700 mt-0.5 leading-relaxed">{w.message}</p>
                  </div>
                  <button
                    onClick={() => dismissWarning(w.id)}
                    className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center text-red-700 opacity-0 group-hover:opacity-100 hover:bg-red-200 hover:text-red-700 transition-all"
                    aria-label="Dismiss warning"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Footer (sticky bottom) ───────────────────────── */}
        {footer && (
          <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * STANDARD BUTTON COMPONENTS
 * 
 * Use these for consistent button styling in modal footers.
 * ───────────────────────────────────────────────────────────── */

interface ModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  icon?: React.ReactNode;
}

export function ModalButton({
  variant = 'secondary',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}: ModalButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
  
  const variantStyles = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {!loading && icon}
      {children}
    </button>
  );
}
