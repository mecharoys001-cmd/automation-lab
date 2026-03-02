'use client';

import { usePathname } from 'next/navigation';
import { ProgramProvider, useProgram } from './ProgramContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Tooltip } from '../components/ui/Tooltip';
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

const adminNavItems: { label: string; href: string; icon: LucideIcon; tooltip: string }[] = [
  { label: 'Calendar', href: '/admin', icon: Calendar, tooltip: 'View and manage the session calendar' },
  { label: 'Templates', href: '/admin/templates', icon: LayoutTemplate, tooltip: 'Define session templates for automated generation' },
  { label: 'Tags', href: '/admin/tags', icon: Tags, tooltip: 'Create and manage session tags and categories' },
  { label: 'People & Places', href: '/admin/people', icon: Users, tooltip: 'Manage instructors and their availability' },
  { label: 'School Calendar', href: '/admin/calendar', icon: Clock, tooltip: 'View and manage school calendar and special dates' },
  { label: 'Exceptions', href: '/admin/exceptions', icon: AlertTriangle, tooltip: 'Review and resolve scheduling conflicts' },
  { label: 'Reports', href: '/admin/reports', icon: BarChart2, tooltip: 'View usage reports and export data' },
  { label: 'Versions', href: '/admin/versions', icon: History, tooltip: 'Save, publish, and revert schedule versions' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, tooltip: 'Configure programs, admins, and system settings' },
];

function ProgramSelector() {
  const { programs, selectedProgramId, setSelectedProgramId, loading } = useProgram();

  return (
    <div className="border-b border-slate-200 bg-white px-6 py-3 flex items-center gap-4">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Program
      </label>
      {loading ? (
        <div className="h-9 w-48 rounded-lg border border-slate-200 bg-slate-50 animate-pulse" />
      ) : programs.length === 0 ? (
        <span className="text-sm text-slate-400">No programs found</span>
      ) : (
        <Tooltip text="Select the active program">
          <select
            value={selectedProgramId ?? ''}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          >
            {programs.map((prog) => (
              <option key={prog.id} value={prog.id}>
                {prog.name}
              </option>
            ))}
          </select>
        </Tooltip>
      )}
    </div>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100vh-68px)]">
      {/* Dark sidebar from design system */}
      <Sidebar navItems={adminNavItems} />

      {/* Main content — light theme matching design spec */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <ProgramSelector />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProgramProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </ProgramProvider>
  );
}
