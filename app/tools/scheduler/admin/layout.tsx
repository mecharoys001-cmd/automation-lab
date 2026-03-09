'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProgramProvider, useProgram } from './ProgramContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Tooltip } from '../components/ui/Tooltip';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import {
  Music,
  LayoutDashboard,
  FileText,
  GraduationCap,
  Tags,
  Users,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  BarChart3,
  GitBranch,
  Settings,
  Upload,
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin', label: 'Calendar', icon: LayoutDashboard, tooltip: 'View and manage the session calendar' },
  { href: '/admin/templates', label: 'Schedule Builder', icon: FileText, tooltip: 'Build weekly schedule templates and configure day times' },
  { href: '/admin/event-templates', label: 'Event Templates', icon: GraduationCap, tooltip: 'Create and manage event templates for scheduling' },
  { href: '/admin/tags', label: 'Tags', icon: Tags, tooltip: 'Create and manage session tags and categories' },
  { href: '/admin/people', label: 'Staff & Venues', icon: Users, tooltip: 'Manage instructors, their availability, and venue spaces' },
  { href: '/admin/calendar', label: 'School Calendar', icon: Calendar, tooltip: 'View and manage school calendar and special dates' },
  { href: '/admin/exceptions', label: 'Exceptions', icon: AlertTriangle, tooltip: 'Review and resolve scheduling conflicts' },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, tooltip: 'View usage reports and export data' },
  { href: '/admin/versions', label: 'Versions', icon: GitBranch, tooltip: 'Save, publish, and revert schedule versions' },
  { href: '/admin/import', label: 'Import Data', icon: Upload, tooltip: 'Import venues, tags, and event templates from CSV data' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, tooltip: 'Configure programs, admins, and system settings' },
  { href: '/admin/roles', label: 'Role Management', icon: ShieldCheck, tooltip: 'Manage user roles and access levels' },
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
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if onboarding has been dismissed
    const dismissed = localStorage.getItem('onboarding_dismissed');
    if (!dismissed) {
      setShowOnboarding(true);
    }

    // Listen for custom event to re-open onboarding from Settings
    const handleReopenOnboarding = () => setShowOnboarding(true);
    window.addEventListener('reopen-onboarding', handleReopenOnboarding);
    return () => window.removeEventListener('reopen-onboarding', handleReopenOnboarding);
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/tools/scheduler');
  }, [router]);

  const handleCloseOnboarding = useCallback(() => {
    localStorage.setItem('onboarding_dismissed', 'true');
    setShowOnboarding(false);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Dark sidebar with program selector */}
      <Sidebar navItems={adminNavItems} header={<SidebarProgramSelector />} onLogout={handleLogout} />

      {/* Main content — light theme matching design spec */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Onboarding Checklist (bottom-right corner) */}
      {showOnboarding && <OnboardingChecklist onClose={handleCloseOnboarding} />}
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
