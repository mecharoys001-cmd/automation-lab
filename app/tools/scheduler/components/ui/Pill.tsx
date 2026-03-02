'use client';

import { Tooltip } from './Tooltip';

type PillVariant = 'skill' | 'grade' | 'tag';

interface PillProps {
  children: React.ReactNode;
  variant?: PillVariant;
  bgColor?: string;
  textColor?: string;
  tooltip?: string;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<PillVariant, string> = {
  skill: 'rounded-full px-3 py-1 text-xs font-medium',
  grade: 'rounded-2xl px-3 py-1 text-xs font-medium',
  tag:   'rounded-2xl px-3 py-1 text-xs font-medium',
};

// Common presets for quick use
export const PILL_PRESETS = {
  // Skill pills
  strings:    { bgColor: 'bg-blue-100',    textColor: 'text-blue-500' },
  brass:      { bgColor: 'bg-amber-100',   textColor: 'text-amber-800' },
  piano:      { bgColor: 'bg-indigo-100',  textColor: 'text-indigo-800' },
  percussion: { bgColor: 'bg-amber-100',   textColor: 'text-amber-800' },
  choral:     { bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
  // Grade pills
  gradeBlue:  { bgColor: 'bg-blue-100',    textColor: 'text-blue-700' },
  gradeGreen: { bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' },
  gradeAmber: { bgColor: 'bg-amber-100',   textColor: 'text-amber-700' },
  // Tag pills
  tagSmallGroup: { bgColor: 'bg-blue-100',    textColor: 'text-blue-800' },
  tagWeekly:     { bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
} as const;

export function Pill({
  children,
  variant = 'skill',
  bgColor = 'bg-blue-100',
  textColor = 'text-blue-500',
  tooltip,
  className = '',
  onClick,
}: PillProps) {
  const el = (
    <span
      className={`inline-flex items-center ${bgColor} ${textColor} ${variantStyles[variant]} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {children}
    </span>
  );

  if (tooltip) {
    return <Tooltip text={tooltip}>{el}</Tooltip>;
  }

  return el;
}
