import {
  Calendar,
  LayoutTemplate,
  Tags,
  Users,
  Clock,
  AlertTriangle,
  BarChart2,
  Settings,
  History,
  type LucideIcon,
} from 'lucide-react';

// ── Single source of truth for all scheduler paths ──────────────────────────

export const APP_BASE_PATH = '/tools/scheduler';
export const ADMIN_BASE_PATH = `${APP_BASE_PATH}/admin`;
export const PORTAL_BASE_PATH = `${APP_BASE_PATH}/portal`;

/** Build an admin sub-path, e.g. adminPath('templates') → '/tools/scheduler/admin/templates' */
export function adminPath(sub?: string): string {
  return sub ? `${ADMIN_BASE_PATH}/${sub}` : ADMIN_BASE_PATH;
}

/** Build a portal sub-path, e.g. portalPath('schedule') → '/tools/scheduler/portal/schedule' */
export function portalPath(sub?: string): string {
  return sub ? `${PORTAL_BASE_PATH}/${sub}` : PORTAL_BASE_PATH;
}

// ── Nav item type ───────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  tooltip: string;
}

// ── Admin sidebar navigation ────────────────────────────────────────────────

export const adminNavItems: NavItem[] = [
  { label: 'Calendar',         href: adminPath(),              icon: Calendar,       tooltip: 'View and manage the session calendar' },
  { label: 'Schedule Builder', href: adminPath('templates'),   icon: LayoutTemplate, tooltip: 'Build weekly schedule templates and configure day times' },
  { label: 'Tags',             href: adminPath('tags'),        icon: Tags,           tooltip: 'Create and manage session tags and categories' },
  { label: 'People & Places',  href: adminPath('people'),      icon: Users,          tooltip: 'Manage instructors and their availability' },
  { label: 'School Calendar',  href: adminPath('calendar'),    icon: Clock,          tooltip: 'View and manage school calendar and special dates' },
  { label: 'Exceptions',       href: adminPath('exceptions'),  icon: AlertTriangle,  tooltip: 'Review and resolve scheduling conflicts' },
  { label: 'Reports',          href: adminPath('reports'),     icon: BarChart2,      tooltip: 'View usage reports and export data' },
  { label: 'Versions',         href: adminPath('versions'),    icon: History,        tooltip: 'Save, publish, and revert schedule versions' },
  { label: 'Settings',         href: adminPath('settings'),    icon: Settings,       tooltip: 'Configure programs, admins, and system settings' },
];

// ── Reports sub-tabs ────────────────────────────────────────────────────────

export const reportTabs = [
  { key: 'instructor-hours', label: 'Instructor Hours', href: adminPath('reports/instructor-hours'), tooltip: 'View hours breakdown by instructor' },
  { key: 'hours-by-tag',     label: 'Hours by Tag',     href: adminPath('reports/hours-by-tag'),     tooltip: 'View hours breakdown by tag category' },
] as const;
