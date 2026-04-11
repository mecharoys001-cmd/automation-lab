'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Picker, { EmojiStyle, Theme } from 'emoji-picker-react';
import type { EmojiClickData } from 'emoji-picker-react';
import { Tooltip } from './Tooltip';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ value, onChange, className = '' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !panelRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current || !panelRef.current) return;

      const buttonRect = buttonRef.current.getBoundingClientRect();
      const panelRect = panelRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 12;
      const gap = 8;

      let left = buttonRect.left;
      if (left + panelRect.width > viewportWidth - margin) {
        left = viewportWidth - panelRect.width - margin;
      }
      left = Math.max(margin, left);

      let top = buttonRect.bottom + gap;
      if (top + panelRect.height > viewportHeight - margin && buttonRect.top - gap - panelRect.height > margin) {
        top = buttonRect.top - panelRect.height - gap;
      }
      top = Math.max(margin, Math.min(top, viewportHeight - panelRect.height - margin));

      setPanelStyle({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const handleSelect = (emojiData: EmojiClickData) => {
    onChange(emojiData.emoji);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <Tooltip text="Choose an icon for this tag">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          className="w-16 h-16 rounded-lg border-2 border-slate-200 hover:border-blue-400 bg-white flex items-center justify-center text-4xl transition-colors cursor-pointer"
        >
          {value}
        </button>
      </Tooltip>

      {open && portalReady && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[9999] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          style={{ top: panelStyle.top, left: panelStyle.left }}
        >
          <Picker
            onEmojiClick={handleSelect}
            searchPlaceholder="Search icons"
            width={350}
            height={420}
            theme={Theme.LIGHT}
            emojiStyle={EmojiStyle.NATIVE}
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            lazyLoadEmojis={false}
            autoFocusSearch={false}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
