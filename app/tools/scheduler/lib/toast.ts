/**
 * Lightweight toast notifications using DOM injection.
 * No external dependencies required.
 *
 * Uses persistent ARIA live regions so screen readers are notified
 * of dynamic content changes. Errors use role="alert" + aria-live="assertive";
 * success/info use role="status" + aria-live="polite".
 */

type ToastType = 'success' | 'error' | 'info';

const TOAST_COLORS: Record<ToastType, string> = {
  success: '#10B981',
  error: '#EF4444',
  info: '#3B82F6',
};

const TOAST_ICONS: Record<ToastType, string> = {
  success:
    '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
  error:
    '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
  info:
    '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01"/><circle cx="12" cy="12" r="10" stroke-width="2"/></svg>',
};

/** Persistent live region containers keyed by aria-live value. */
const liveRegions: Record<string, HTMLDivElement> = {};

function getLiveRegion(level: 'polite' | 'assertive'): HTMLDivElement {
  if (liveRegions[level]) return liveRegions[level];

  const region = document.createElement('div');
  region.setAttribute('aria-live', level);
  region.setAttribute('aria-atomic', 'true');
  region.setAttribute('role', level === 'assertive' ? 'alert' : 'status');
  // Visually position the region but keep it in the DOM permanently
  Object.assign(region.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '99999',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px',
  });
  document.body.appendChild(region);
  liveRegions[level] = region;
  return region;
}

export function showToast(message: string, type: ToastType = 'success') {
  // Dispatch custom event for the React ToastContainer (ARIA live regions)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
  }

  const liveLevel = type === 'error' ? 'assertive' : 'polite';
  const region = getLiveRegion(liveLevel);

  const el = document.createElement('div');
  Object.assign(el.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: TOAST_COLORS[type],
    color: '#fff',
    padding: '10px 18px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    pointerEvents: 'none',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 0.2s ease, transform 0.2s ease',
  });
  el.innerHTML = `${TOAST_ICONS[type]}<span>${message}</span>`;
  region.appendChild(el);

  // Animate in
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });

  // Animate out after 2.5s
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 200);
  }, 2500);
}
