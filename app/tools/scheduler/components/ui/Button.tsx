'use client';

import { forwardRef } from 'react';
import { Tooltip } from './Tooltip';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'filter' | 'today';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  tooltip?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:      'bg-blue-600 text-white hover:bg-blue-700 border border-transparent',
  secondary:    'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
  danger:       'bg-transparent text-red-700 border border-red-500 hover:bg-red-50',
  ghost:        'bg-transparent text-blue-600 hover:text-blue-700 border border-transparent',
  filter:       'bg-transparent text-slate-600 border border-slate-200 hover:bg-slate-50',
  today:        'bg-blue-600 text-white hover:bg-blue-700 border border-transparent',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs rounded-md gap-1.5',
  md: 'px-4 py-2 text-[13px] rounded-lg gap-1.5',
  lg: 'px-5 py-2.5 text-sm rounded-lg gap-2',
};

const variantSizeOverrides: Partial<Record<ButtonVariant, string>> = {
  filter:       'px-2.5 py-1.5 text-[13px] rounded-md gap-1.5',
  today:        'px-3 py-1.5 text-[13px] rounded-md gap-1.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', tooltip, icon, children, className = '', ...props }, ref) => {
    const sizeClass = variantSizeOverrides[variant] ?? sizeStyles[size];

    const el = (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeClass} ${className}`}
        {...props}
      >
        {icon}
        {children}
      </button>
    );

    if (tooltip) {
      return <Tooltip text={tooltip}>{el}</Tooltip>;
    }

    return el;
  }
);

Button.displayName = 'Button';
