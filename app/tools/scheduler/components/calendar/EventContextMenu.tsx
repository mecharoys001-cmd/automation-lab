'use client';

import { useEffect, useRef } from 'react';
import { XCircle, UserPlus, RefreshCw, Copy, Trash2 } from 'lucide-react';
import type { CalendarEvent } from './types';
import { EVENT_COLORS } from './types';
import { getSubjectColor } from '../../lib/subjectColors';
import { Tooltip } from '../ui/Tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextMenuAction = 'cancel' | 'suggest_replacements' | 'duplicate' | 'delete';

interface SuggestedReplacement {
  instructor: string;
  time: string;
  available: boolean;
}

interface EventContextMenuProps {
  event: CalendarEvent;
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: ContextMenuAction, event: CalendarEvent) => void;
}

// ---------------------------------------------------------------------------
// Mock replacement suggestions (in a real app these come from the API)
// ---------------------------------------------------------------------------

function getSuggestedReplacements(event: CalendarEvent): SuggestedReplacement[] {
  const suggestions: Record<string, SuggestedReplacement[]> = {
    strings: [
      { instructor: 'Mr. Park', time: event.time, available: true },
      { instructor: 'Ms. Davis', time: '10:00 AM', available: true },
      { instructor: 'Ms. Rivera', time: event.time, available: false },
    ],
    brass: [
      { instructor: 'Ms. Chen', time: event.time, available: true },
      { instructor: 'Mr. Johnson', time: '11:00 AM', available: true },
    ],
    piano: [
      { instructor: 'Ms. Chen', time: '9:00 AM', available: true },
      { instructor: 'Ms. Davis', time: event.time, available: true },
    ],
    percussion: [
      { instructor: 'Mr. Park', time: event.time, available: true },
      { instructor: 'Ms. Rivera', time: '2:00 PM', available: false },
    ],
    choral: [
      { instructor: 'Ms. Rivera', time: event.time, available: true },
      { instructor: 'Ms. Chen', time: '1:00 PM', available: true },
    ],
  };
  return suggestions[event.type] ?? [];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventContextMenu({
  event,
  position,
  onClose,
  onAction,
}: EventContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const subjectColor = event.subjects?.[0] ? getSubjectColor(event.subjects[0]) : null;
  const colors = subjectColor
    ? { accent: subjectColor.accent, bg: subjectColor.eventBg, text: subjectColor.eventText }
    : EVENT_COLORS[event.type] ?? { accent: '#64748B', bg: '#F8FAFC', text: '#334155' };

  // Close on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Clamp menu to viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 340),
    left: Math.min(position.x, window.innerWidth - 280),
    zIndex: 99999,
  };

  const suggestions = getSuggestedReplacements(event);

  return (
    <div ref={menuRef} style={menuStyle} className="w-[264px] bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
      {/* Event header */}
      <div className="px-3 py-2.5 border-b border-slate-100" style={{ backgroundColor: colors.bg }}>
        <p className="text-[12px] font-semibold" style={{ color: colors.text }}>
          {event.title}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {event.time}{event.endTime ? ` – ${event.endTime}` : ''} · {event.instructor}
        </p>
      </div>

      {/* Actions */}
      <div className="py-1">
        <Tooltip text="Cancel this session and notify instructor">
          <button
            onClick={() => onAction('cancel', event)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            Cancel Session
          </button>
        </Tooltip>

        <Tooltip text="Create a copy of this session">
          <button
            onClick={() => onAction('duplicate', event)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Copy className="w-4 h-4 text-slate-400" />
            Duplicate Session
          </button>
        </Tooltip>

        <Tooltip text="Permanently delete this session">
          <button
            onClick={() => onAction('delete', event)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete Event
          </button>
        </Tooltip>
      </div>

      {/* Suggest Replacements section */}
      <div className="border-t border-slate-100">
        <div className="flex items-center gap-2 px-3 py-2">
          <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
            Suggested Replacements
          </span>
        </div>

        <div className="px-2 pb-2 space-y-1">
          {suggestions.map((s, idx) => (
            <Tooltip key={idx} text={s.available ? `Assign ${s.instructor} to this session` : `${s.instructor} is unavailable at this time`}>
              <button
                onClick={() => onAction('suggest_replacements', event)}
                disabled={!s.available}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer ${
                  s.available
                    ? 'hover:bg-blue-50 text-slate-700'
                    : 'opacity-50 cursor-not-allowed text-slate-400'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" style={{ color: s.available ? colors.accent : undefined }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate">{s.instructor}</p>
                  <p className="text-[10px] text-slate-400">{s.time}{!s.available ? ' · Unavailable' : ''}</p>
                </div>
              </button>
            </Tooltip>
          ))}

          {suggestions.length === 0 && (
            <p className="text-[11px] text-slate-400 text-center py-2">
              No suggestions available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
