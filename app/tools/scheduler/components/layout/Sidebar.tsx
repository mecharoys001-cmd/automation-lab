// Force rebuild - basePath fixed to /tools/scheduler
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarDays,
  Calendar,
  Users,
  Tags,
  Settings,
  LogOut,
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
  /** Callback when user clicks the logout button */
  onLogout?: () => void;
  className?: string;
  /** Whether the sidebar is open on mobile */
  mobileOpen?: boolean;
  /** Callback to close the sidebar on mobile */
  onMobileClose?: () => void;
}

const defaultNavItems: NavItem[] = [
  {
    label: 'Calendar',
    href: '',
    icon: Calendar,
    tooltip: 'View and manage the session calendar',
  },
  {
    label: 'Staff & Venues',
    href: '/people',
    icon: Users,
    tooltip: 'Manage staff and venues',
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
  onLogout,
  className = '',
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const fullHref = `${basePath}${href}`;
    // Exact match for empty href or root-level routes
    if (href === '' || href === '/admin') {
      return pathname === fullHref;
    }
    // Prefix match for other routes
    return pathname.startsWith(fullHref);
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`w-[240px] flex flex-col justify-between bg-slate-800 py-6 px-4 flex-shrink-0 fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0 transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${className}`}
      >
      {/* Top section: Logo + Nav */}
      <div className="min-h-0 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0">
          {header ?? (
            <div className="flex items-center gap-2.5 pb-6">
              <CalendarDays className="w-7 h-7 text-blue-500 flex-shrink-0" />
              <span className="text-xl font-bold text-white">Symphonix</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 overflow-y-auto min-h-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Tooltip key={item.href} text={item.tooltip} position="right">
                <Link
                  href={`${basePath}${item.href}`}
                  className={`flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 ${
                    active
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-100 hover:bg-slate-700/50 hover:text-white font-medium'
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
      <div className="border-t border-slate-700 pt-4 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Avatar initials={user.initials} size="md" bgColor="bg-blue-500" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-white truncate">{user.name}</p>
            <p className="text-[11px] text-slate-300 truncate">{user.role}</p>
          </div>
          {onLogout && (
            <Tooltip text="Sign out" position="top">
              <button
                onClick={onLogout}
                className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}
