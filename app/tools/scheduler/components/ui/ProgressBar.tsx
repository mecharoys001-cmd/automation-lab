'use client';

interface ProgressBarProps {
  /** Percentage fill (0–100) */
  value: number;
  /** Track height in pixels */
  height?: number;
  /** Tailwind bg class or hex color for the filled portion */
  color?: string;
  /** Tailwind bg class for the track background */
  trackColor?: string;
  /** Optional opacity for the fill bar (0–1) */
  fillOpacity?: number;
  className?: string;
}

export function ProgressBar({
  value,
  height = 6,
  color = 'bg-blue-500',
  trackColor = 'bg-slate-200',
  fillOpacity,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const isHex = color.startsWith('#');

  return (
    <div
      className={`w-full ${trackColor} overflow-hidden ${className}`}
      style={{ height, borderRadius: height / 2 }}
    >
      <div
        className={`h-full ${isHex ? '' : color}`}
        style={{
          width: `${clamped}%`,
          borderRadius: height / 2,
          opacity: fillOpacity,
          ...(isHex ? { backgroundColor: color } : {}),
        }}
      />
    </div>
  );
}
