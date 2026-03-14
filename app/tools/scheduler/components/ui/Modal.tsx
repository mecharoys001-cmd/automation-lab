'use client';

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
  if (!open) return null;

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
        className={`relative z-[70] rounded-2xl bg-white shadow-xl flex flex-col overflow-hidden max-h-[calc(100vh-2rem)] ${className}`}
        style={{ width }}
      >
        {/* ── Header (sticky top) ──────────────────────────── */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <Tooltip text="Close">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>

        {/* ── Body (scrollable) ────────────────────────────── */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* ── Warnings (fixed, above footer) ─────────────────── */}
        {warnings && warnings.length > 0 && (
          <div className="shrink-0 border-t border-red-200 bg-red-50 space-y-0">
            {warnings.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-3 px-6 py-3 border-b border-red-100 last:border-b-0"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-red-700">{w.label}</span>
                  <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{w.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

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
  const baseStyles = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2';
  
  const variantStyles = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'border border-slate-200 text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-500 text-white hover:bg-red-600',
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
