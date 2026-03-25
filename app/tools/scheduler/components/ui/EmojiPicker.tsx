'use client';

import { useState, useRef, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSelect = (emoji: string) => {
    onChange(emoji);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <Tooltip text="Click to change emoji">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-16 h-16 rounded-lg border-2 border-slate-200 hover:border-blue-400 bg-white flex items-center justify-center text-4xl transition-colors cursor-pointer"
        >
          {value}
        </button>
      </Tooltip>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50">
          {/* Category tabs */}
          <div className="flex gap-1 mb-3 border-b border-slate-200 pb-2">
            {(Object.keys(EMOJI_CATEGORIES) as Array<keyof typeof EMOJI_CATEGORIES>).map((cat) => (
              <Tooltip key={cat} text={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-blue-500 text-white'
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

          {/* Quick search (optional - can add later) */}
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-700 text-center">
              Click an emoji to select
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
