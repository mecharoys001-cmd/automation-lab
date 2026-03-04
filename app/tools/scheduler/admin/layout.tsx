'use client';

import { ProgramProvider, useProgram } from './ProgramContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Tooltip } from '../components/ui/Tooltip';
import {
  Music,
  LayoutDashboard,
  FileText,
  Tags,
  Users,
  Calendar,
  AlertTriangle,
  BarChart3,
  GitBranch,
  Settings,
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/templates', label: 'Templates', icon: FileText },
  { href: '/admin/tags', label: 'Tags', icon: Tags },
  { href: '/admin/people', label: 'People', icon: Users },
  { href: '/admin/calendar', label: 'Calendar', icon: Calendar },
  { href: '/admin/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/versions', label: 'Versions', icon: GitBranch },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

function SidebarProgramSelector() {
  const { programs, selectedProgramId, setSelectedProgramId, loading } = useProgram();

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <Music className="w-6 h-6 text-blue-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Symphonix
        </span>
      </div>
      {loading ? (
        <div className="h-9 w-full rounded-lg bg-slate-700 animate-pulse" />
      ) : programs.length === 0 ? (
        <span className="text-sm text-slate-400">No programs found</span>
      ) : (
        <Tooltip text="Switch program" position="right">
          <select
            value={selectedProgramId ?? ''}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full h-9 rounded-lg bg-slate-700 border border-slate-600 px-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 cursor-pointer appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 0.5rem center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '1.25rem 1.25rem',
              paddingRight: '2rem',
            }}
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
    <div className="flex h-screen">
      {/* Dark sidebar with program selector */}
      <Sidebar navItems={adminNavItems} header={<SidebarProgramSelector />} />

      {/* Main content — light theme matching design spec */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
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
