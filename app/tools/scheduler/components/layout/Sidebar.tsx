// Force rebuild - basePath fixed to /tools/scheduler
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Music,
  Calendar,
  Users,
  LayoutTemplate,
  Tags,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { Avatar } from '../ui/Avatar';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  tooltip: string;
}

interface UserProfile {
  name: string;
  initials: string;
  role: string;
}

interface SidebarProps {
  /** Override the default nav items */
  navItems?: NavItem[];
  /** User profile shown at the bottom */
  user?: UserProfile;
  /** Base path prefix for all nav hrefs */
  basePath?: string;
  /** Custom header content (replaces the default Symphonix logo) */
  header?: React.ReactNode;
  className?: string;
}

const defaultNavItems: NavItem[] = [
  {
    label: 'Calendar',
    href: '',
    icon: Calendar,
    tooltip: 'View and manage the session calendar',
  },
  {
    label: 'People & Places',
    href: '/people',
    icon: Users,
    tooltip: 'Manage instructors and venues',
  },
  {
    label: 'Schedule Builder',
    href: '/templates',
    icon: LayoutTemplate,
    tooltip: 'Build weekly schedule templates and configure day times',
  },
  {
    label: 'Tags',
    href: '/tags',
    icon: Tags,
    tooltip: 'Manage event tags and categories',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    tooltip: 'Configure programs and settings',
  },
];

const defaultUser: UserProfile = {
  name: 'Sarah Admin',
  initials: 'SA',
  role: 'Administrator',
};

export function Sidebar({
  navItems = defaultNavItems,
  user = defaultUser,
  basePath = '/tools/scheduler',
  header,
  className = '',
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const fullHref = `${basePath}${href}`;
    // Exact match for the base admin path (empty href = root)
    if (href === '') {
      return pathname === fullHref;
    }
    return pathname.startsWith(fullHref);
  };

  return (
    <aside
      className={`w-[240px] flex flex-col justify-between bg-slate-800 py-6 px-4 flex-shrink-0 ${className}`}
    >
      {/* Top section: Logo + Nav */}
      <div>
        {/* Header */}
        {header ?? (
          <div className="flex items-center gap-2.5 pb-6">
            <Music className="w-7 h-7 text-blue-500 flex-shrink-0" />
            <span className="text-xl font-bold text-white">Symphonix</span>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Tooltip key={item.href} text={item.tooltip} position="right">
                <Link
                  href={`${basePath}${item.href}`}
                  className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 transition-colors ${
                    active
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-white font-medium'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 ${active ? 'text-blue-500' : 'text-slate-300'}`}
                  />
                  <span className="text-sm">{item.label}</span>
                </Link>
              </Tooltip>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: User profile */}
      <div className="border-t border-slate-700 pt-4">
        <Tooltip text={`Signed in as ${user.name}`} position="right">
          <div className="flex items-center gap-2.5">
            <Avatar initials={user.initials} size="md" bgColor="bg-blue-500" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-300 truncate">{user.role}</p>
            </div>
          </div>
        </Tooltip>
      </div>
    </aside>
  );
}
