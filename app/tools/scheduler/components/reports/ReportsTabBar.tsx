'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip } from '../ui/Tooltip';

const TABS = [
  { key: 'instructor-hours', label: 'Instructor Hours', href: '/tools/scheduler/admin/reports/instructor-hours', tooltip: 'View hours breakdown by instructor' },
  { key: 'hours-by-tag', label: 'Hours by Tag', href: '/tools/scheduler/admin/reports/hours-by-tag', tooltip: 'View hours breakdown by tag category' },
] as const;

export function ReportsTabBar() {
  const pathname = usePathname();

  return (
    <div className="bg-white px-8 border-b border-slate-200">
      <div className="flex items-center gap-0">
        {TABS.map((tab) => {
          const isActive = pathname.includes(tab.key);
          return (
            <Tooltip key={tab.key} text={tab.tooltip}>
              <Link
                href={tab.href}
                className={`relative px-5 py-3.5 text-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-blue-500'
                    : 'font-medium text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </Link>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
