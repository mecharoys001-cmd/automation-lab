'use client';

import { Tooltip } from './Tooltip';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  initials: string;
  name?: string;
  size?: AvatarSize;
  bgColor?: string;
  className?: string;
  tooltip?: string;
}

const sizeMap: Record<AvatarSize, { container: string; text: string }> = {
  sm: { container: 'w-6 h-6', text: 'text-[10px]' },
  md: { container: 'w-8 h-8', text: 'text-xs' },
  lg: { container: 'w-10 h-10', text: 'text-sm' },
};

export function Avatar({ initials, size = 'md', bgColor = 'bg-blue-500', className = '', tooltip }: AvatarProps) {
  const s = sizeMap[size];

  const el = (
    <div
      className={`${s.container} rounded-full ${bgColor} flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className={`${s.text} font-semibold text-white leading-none`}>
        {initials}
      </span>
    </div>
  );

  if (tooltip) {
    return <Tooltip text={tooltip}>{el}</Tooltip>;
  }

  return el;
}
