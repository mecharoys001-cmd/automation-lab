'use client';

import { Tooltip } from './Tooltip';
import { getSubjectColor } from '../../lib/subjectColors';

type PillVariant = 'skill' | 'grade' | 'tag';

interface PillProps {
  children: React.ReactNode;
  variant?: PillVariant;
  /** Hex color or Tailwind class for background */
  bgColor?: string;
  /** Hex color or Tailwind class for text */
  textColor?: string;
  /** Optional emoji to display before children */
  emoji?: string;
  tooltip?: string;
  className?: string;
  onClick?: () => void;
}

const variantStyles: Record<PillVariant, string> = {
  skill: 'rounded-full px-3 py-1 text-xs font-medium',
  grade: 'rounded-2xl px-3 py-1 text-xs font-medium',
  tag:   'rounded-2xl px-3 py-1 text-xs font-medium',
};

/** Detect if a color string is a hex value (vs a Tailwind class). */
function isHex(color: string): boolean {
  return color.startsWith('#');
}

// Common presets for quick use (grade/tag pills that don't map to subjects)
export const PILL_PRESETS = {
  gradeBlue:  { bgColor: 'bg-blue-100',    textColor: 'text-blue-700' },
  gradeGreen: { bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
  gradeAmber: { bgColor: 'bg-amber-100',   textColor: 'text-amber-800' },
  tagSmallGroup: { bgColor: 'bg-blue-100',    textColor: 'text-blue-800' },
  tagWeekly:     { bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
} as const;

/** Get pill colors for a subject name (case-insensitive). Returns hex values. */
export function getSubjectPillColors(name: string): { bgColor: string; textColor: string } {
  const c = getSubjectColor(name);
  return { bgColor: c.badgeBg, textColor: c.badgeText };
}

export function Pill({
  children,
  variant = 'skill',
  bgColor = 'bg-blue-100',
  textColor = 'text-blue-700',
  emoji,
  tooltip,
  className = '',
  onClick,
}: PillProps) {
  // Support both hex values (from dynamic color system) and Tailwind classes (legacy)
  const usesHexBg = isHex(bgColor);
  const usesHexText = isHex(textColor);

  const inlineStyle: React.CSSProperties = {};
  if (usesHexBg) inlineStyle.backgroundColor = bgColor;
  if (usesHexText) inlineStyle.color = textColor;

  const bgClass = usesHexBg ? '' : bgColor;
  const textClass = usesHexText ? '' : textColor;

  const el = (
    <span
      className={`inline-flex items-center ${bgClass} ${textClass} ${variantStyles[variant]} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1' : ''} ${className}`}
      style={Object.keys(inlineStyle).length > 0 ? inlineStyle : undefined}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {emoji && <span className="mr-1">{emoji}</span>}
      {children}
    </span>
  );

  if (tooltip) {
    return <Tooltip text={tooltip}>{el}</Tooltip>;
  }

  return el;
}
