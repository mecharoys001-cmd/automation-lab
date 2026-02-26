'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom';
  className?: string;
  children: React.ReactNode;
}

export default function Tooltip({ text, position = 'top', className, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const isTop = position === 'top';
        setCoords({
          left: rect.left + rect.width / 2,
          top: isTop ? rect.top - 8 : rect.bottom + 8,
        });
      }
      setVisible(true);
    }, 300);
  }, [position]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const isTop = position === 'top';

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      className={className}
      style={{ display: 'inline-block' }}
    >
      {children}
      {visible && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            transform: isTop ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            zIndex: 99999,
            backgroundColor: '#1f2937',
            color: '#f3f4f6',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 13,
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          {text}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderStyle: 'solid',
              ...(isTop
                ? { bottom: -5, borderWidth: '5px 5px 0', borderColor: '#1f2937 transparent transparent transparent' }
                : { top: -5, borderWidth: '0 5px 5px', borderColor: 'transparent transparent #1f2937 transparent' }),
            }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
