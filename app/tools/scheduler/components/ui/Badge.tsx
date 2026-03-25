'use client';

import { Tooltip } from './Tooltip';

type BadgeVariant = 'status' | 'count' | 'table';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'slate';
  dot?: boolean;
  tooltip?: string;
  className?: string;
}

const colorStyles: Record<string, { bg: string; text: string; dot: string }> = {
  blue:   { bg: 'bg-blue-100',    text: 'text-blue-600',    dot: 'bg-blue-500' },
  green:  { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  amber:  { bg: 'bg-amber-100',   text: 'text-amber-800',   dot: 'bg-amber-500' },
  red:    { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  violet: { bg: 'bg-violet-50',   text: 'text-violet-600',  dot: 'bg-violet-500' },
  slate:  { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-500' },
};

const variantStyles: Record<BadgeVariant, string> = {
  status: 'rounded-xl px-2.5 py-1 text-xs font-medium',
  count:  'rounded-[10px] px-2 py-0.5 text-xs font-semibold',
  table:  'rounded-xl px-2.5 py-0.5 text-[11px] font-semibold',
};

export function Badge({
  children,
  variant = 'status',
  color = 'blue',
  dot = false,
  tooltip,
  className = '',
}: BadgeProps) {
  const c = colorStyles[color];

  const el = (
    <span
      className={`inline-flex items-center gap-1.5 ${c.bg} ${c.text} ${variantStyles[variant]} ${className}`}
    >
      {dot && <span className={`w-2 h-2 rounded-full ${c.dot}`} />}
      {children}
    </span>
  );

  if (tooltip) {
    return <Tooltip text={tooltip}>{el}</Tooltip>;
  }

  return el;
}
