'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';
import { Tooltip } from './Tooltip';

export interface ClickToCopyProps {
  text: string;
  label?: string;
  displayText?: string;
  className?: string;
  iconOnly?: boolean;
  toast?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  textClassName?: string;
  buttonClassName?: string;
}

/**
 * Copy text to clipboard with HTTP fallback (textarea + execCommand).
 * Returns true on success.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // Try the modern Clipboard API first (requires HTTPS or localhost)
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API failed — fall through to legacy approach
  }

  // Legacy fallback for HTTP / older browsers
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    // Move off-screen to avoid visual flash
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/** Show a floating toast confirmation at the bottom-right of the viewport. */
function showCopyToast(label?: string) {
  const toastDiv = document.createElement('div');
  // Use inline styles to guarantee visibility regardless of Tailwind class availability
  Object.assign(toastDiv.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#10B981',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    pointerEvents: 'none' as const,
  });
  toastDiv.className = 'animate-slide-up';
  toastDiv.innerHTML = `
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
    </svg>
    <span>${label ? `Copied ${label}!` : 'Copied!'}</span>
  `;
  document.body.appendChild(toastDiv);

  setTimeout(() => {
    toastDiv.classList.add('animate-fade-out');
    setTimeout(() => {
      if (toastDiv.parentNode) toastDiv.parentNode.removeChild(toastDiv);
    }, 300);
  }, 2000);
}

export function ClickToCopy({
  text,
  label,
  displayText,
  className = '',
  iconOnly = false,
  toast = true,
  icon: Icon,
  textClassName,
  buttonClassName,
}: ClickToCopyProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(text);
    if (!ok) {
      console.error('ClickToCopy: all clipboard methods failed');
      return;
    }

    setCopied(true);
    if (toast) showCopyToast(label);
    setTimeout(() => setCopied(false), 2000);
  }, [text, label, toast]);

  /* ── Icon-only variant ─────────────────────────────────── */
  if (iconOnly) {
    return (
      <Tooltip text={copied ? 'Copied!' : `Copy ${label || 'to clipboard'}`}>
        <button
          type="button"
          onClick={handleCopy}
          className={`p-1 rounded hover:bg-slate-100 transition-colors ${className}`}
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <Copy className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          )}
        </button>
      </Tooltip>
    );
  }

  /* ── Inline variant (icon + text — entire row is clickable) ─ */
  return (
    <Tooltip text={copied ? 'Copied!' : 'Click to copy'}>
      <button
        type="button"
        onClick={handleCopy}
        className={
          buttonClassName ??
          'flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer'
        }
      >
        {/* Leading icon (Mail / Phone / custom) */}
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />}

        {/* Label (only rendered when no icon) */}
        {label && !Icon && (
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {label}
          </span>
        )}

        {/* Text or "Copied" state */}
        {copied ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
            <Check className="w-3.5 h-3.5" /> Copied
          </span>
        ) : (
          <>
            <span className={textClassName ?? 'text-sm font-medium text-slate-700'}>
              {displayText || text}
            </span>
            <Copy className="w-3 h-3 text-slate-300 flex-shrink-0" />
          </>
        )}
      </button>
    </Tooltip>
  );
}
