'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

type ResolvedPosition = 'top' | 'bottom' | 'left' | 'right';

const OFFSET = 8;
const VIEWPORT_PADDING = 4;

export function Tooltip({ text, position = 'top', className, style, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [resolvedPosition, setResolvedPosition] = useState<ResolvedPosition>(position);
  const [arrowOffset, setArrowOffset] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const tr = trigger.getBoundingClientRect();
    const tt = tooltip.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let pos: ResolvedPosition = position;

    // Check which sides have enough space
    const fitsTop = tr.top - OFFSET - tt.height >= VIEWPORT_PADDING;
    const fitsBottom = tr.bottom + OFFSET + tt.height <= vh - VIEWPORT_PADDING;
    const fitsLeft = tr.left - OFFSET - tt.width >= VIEWPORT_PADDING;
    const fitsRight = tr.right + OFFSET + tt.width <= vw - VIEWPORT_PADDING;

    // Flip to opposite side if preferred side overflows
    if (pos === 'top' && !fitsTop && fitsBottom) pos = 'bottom';
    else if (pos === 'bottom' && !fitsBottom && fitsTop) pos = 'top';
    else if (pos === 'left' && !fitsLeft && fitsRight) pos = 'right';
    else if (pos === 'right' && !fitsRight && fitsLeft) pos = 'left';

    let top = 0;
    let left = 0;

    switch (pos) {
      case 'top':
        top = tr.top - OFFSET - tt.height;
        left = tr.left + tr.width / 2 - tt.width / 2;
        break;
      case 'bottom':
        top = tr.bottom + OFFSET;
        left = tr.left + tr.width / 2 - tt.width / 2;
        break;
      case 'left':
        top = tr.top + tr.height / 2 - tt.height / 2;
        left = tr.left - OFFSET - tt.width;
        break;
      case 'right':
        top = tr.top + tr.height / 2 - tt.height / 2;
        left = tr.right + OFFSET;
        break;
    }

    // Clamp horizontally and track arrow shift for top/bottom positions
    let arrow: number | null = null;
    if (pos === 'top' || pos === 'bottom') {
      const clampedLeft = Math.max(
        VIEWPORT_PADDING,
        Math.min(left, vw - tt.width - VIEWPORT_PADDING),
      );
      if (Math.abs(clampedLeft - left) > 1) {
        const triggerCenter = tr.left + tr.width / 2;
        arrow = Math.max(10, Math.min(triggerCenter - clampedLeft, tt.width - 10));
      }
      left = clampedLeft;
    }

    // Clamp vertically and track arrow shift for left/right positions
    if (pos === 'left' || pos === 'right') {
      const clampedTop = Math.max(
        VIEWPORT_PADDING,
        Math.min(top, vh - tt.height - VIEWPORT_PADDING),
      );
      if (Math.abs(clampedTop - top) > 1) {
        const triggerCenter = tr.top + tr.height / 2;
        arrow = Math.max(10, Math.min(triggerCenter - clampedTop, tt.height - 10));
      }
      top = clampedTop;
    }

    setCoords({ top, left });
    setResolvedPosition(pos);
    setArrowOffset(arrow);
    setPlaced(true);
  }, [position]);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setPlaced(false);
      setVisible(true);
    }, 300);
  }, []);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
    setPlaced(false);
  }, []);

  // Measure and position after the tooltip element mounts
  useEffect(() => {
    if (visible && !placed) {
      requestAnimationFrame(computePosition);
    }
  }, [visible, placed, computePosition]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const getArrowStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderStyle: 'solid',
    };
    const pos = arrowOffset != null ? arrowOffset : '50%';
    switch (resolvedPosition) {
      case 'top':
        return { ...base, bottom: -5, left: pos, transform: 'translateX(-50%)', borderWidth: '5px 5px 0', borderColor: '#1e293b transparent transparent transparent' };
      case 'bottom':
        return { ...base, top: -5, left: pos, transform: 'translateX(-50%)', borderWidth: '0 5px 5px', borderColor: 'transparent transparent #1e293b transparent' };
      case 'left':
        return { ...base, right: -5, top: pos, transform: 'translateY(-50%)', borderWidth: '5px 0 5px 5px', borderColor: 'transparent transparent transparent #1e293b' };
      case 'right':
        return { ...base, left: -5, top: pos, transform: 'translateY(-50%)', borderWidth: '5px 5px 5px 0', borderColor: 'transparent #1e293b transparent transparent' };
    }
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      className={className}
      style={{ ...style, display: style?.display ?? (style?.gridColumn !== undefined || style?.gridRow !== undefined ? 'flex' : 'inline-flex') }}
    >
      {children}
      {visible && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            zIndex: 99999,
            backgroundColor: '#1e293b',
            color: '#f1f5f9',
            padding: '5px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.4,
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            opacity: placed ? 1 : 0,
          }}
        >
          {text}
          <div style={getArrowStyle()} />
        </div>,
        document.body
      )}
    </div>
  );
}
