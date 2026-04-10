'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from './Tooltip';

const EMOJI_CATEGORIES = {
  music: ['🎵', '🎶', '🎼', '🎹', '🎸', '🎺', '🎻', '🥁', '🎤', '🎧', '🎷', '🪕', '🪈', '🎙️'],
  faces: ['😀', '😊', '🤩', '😎', '🥳', '🤗', '🙌', '👏', '✨', '⭐', '🌟', '💫', '🎉', '🎊'],
  symbols: ['✅', '❌', '⚠️', '📋', '📌', '📍', '🔔', '🔥', '💡', '🏆', '🎯', '🎨', '🌈', '☀️'],
  objects: ['📚', '✏️', '📝', '🎒', '🏫', '🎓', '🏅', '🎭', '🎪', '🎬', '📸', '🎮', '🧩', '🎲'],
  people: ['👤', '👥', '👨‍🏫', '👩‍🏫', '👨‍🎓', '👩‍🎓', '🧑‍🎤', '👨‍🎤', '👩‍🎤', '👶', '🧒', '👦', '👧', '🧑'],
};

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

export function EmojiPicker({ value, onChange, className = '' }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof EMOJI_CATEGORIES>('symbols');
  const [portalReady, setPortalReady] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Close on click outside
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

      setPanelStyle({ top, left, width: Math.min(320, viewportWidth - margin * 2) });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <Tooltip text="Click to change emoji">
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
          className="fixed bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-[9999]"
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width, maxWidth: 'calc(100vw - 1.5rem)' }}
        >
          {/* Category tabs */}
          <div className="flex gap-1 mb-3 border-b border-slate-200 pb-2">
            {(Object.keys(EMOJI_CATEGORIES) as Array<keyof typeof EMOJI_CATEGORIES>).map((cat) => (
              <Tooltip key={cat} text={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              </Tooltip>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="grid grid-cols-7 gap-1.5 max-h-48 overflow-y-auto">
            {EMOJI_CATEGORIES[selectedCategory].map((emoji) => (
              <Tooltip key={emoji} text={emoji}>
                <button
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className={`w-9 h-9 rounded-md flex items-center justify-center text-2xl hover:bg-blue-50 transition-colors ${
                    value === emoji ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                  }`}
                >
                  {emoji}
                </button>
              </Tooltip>
            ))}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-700 text-center">
              Click an emoji to select
            </p>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
