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

import { SUBJECT_COLORS, getSubjectColor } from '../../lib/subjectColors';

// Subject presets derived from the unified color system
const subjectPresets = Object.fromEntries(
  Object.entries(SUBJECT_COLORS).map(([key, c]) => [
    key,
    { bgColor: c.badgeBg, textColor: c.badgeText },
  ]),
);

// Common presets for quick use
export const PILL_PRESETS = {
  ...subjectPresets,
  // Grade pills
  gradeBlue:  { bgColor: 'bg-blue-100',    textColor: 'text-blue-700' },
  gradeGreen: { bgColor: 'bg-emerald-100', textColor: 'text-emerald-600' },
  gradeAmber: { bgColor: 'bg-amber-100',   textColor: 'text-amber-700' },
  // Tag pills
  tagSmallGroup: { bgColor: 'bg-blue-100',    textColor: 'text-blue-800' },
  tagWeekly:     { bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
} as const;

/** Get pill colors for a subject name (case-insensitive). */
export function getSubjectPillColors(name: string): { bgColor: string; textColor: string } {
  const c = getSubjectColor(name);
  return { bgColor: c.badgeBg, textColor: c.badgeText };
}

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
