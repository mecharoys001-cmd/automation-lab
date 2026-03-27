'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ProgramProvider, useProgram } from './ProgramContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Tooltip } from '../components/ui/Tooltip';

const OnboardingChecklist = dynamic(
  () => import('../components/OnboardingChecklist').then((m) => m.OnboardingChecklist),
  { ssr: false }
);
import {
  CalendarDays,
  LayoutDashboard,
  GraduationCap,
  Tags,
  Users,
  ShieldCheck,
  Calendar,
  BarChart3,
  GitBranch,
  Settings,
  Upload,
  Menu,
} from 'lucide-react';

import type { RoleLevel } from '@/types/database';

interface AdminNavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  tooltip: string;
  /** Minimum role_level required to see this item. Defaults to 'editor' (all admins). */
  minRole?: RoleLevel;
}

const ROLE_RANK: Record<RoleLevel, number> = { master: 3, standard: 2, editor: 1 };

const adminNavItems: AdminNavItem[] = [
  { href: '/admin', label: 'Calendar', icon: LayoutDashboard, tooltip: 'Calendar' },
  { href: '/admin/event-templates', label: 'Event Templates', icon: GraduationCap, tooltip: 'Event Templates' },
  { href: '/admin/tags', label: 'Tags', icon: Tags, tooltip: 'Tags' },
  { href: '/admin/people', label: 'Staff & Venues', icon: Users, tooltip: 'Staff & Venues' },
  { href: '/admin/calendar', label: 'School Calendar', icon: Calendar, tooltip: 'School Calendar' },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, tooltip: 'Reports', minRole: 'standard' },
  { href: '/admin/versions', label: 'Versions', icon: GitBranch, tooltip: 'Versions', minRole: 'standard' },
  { href: '/admin/import', label: 'Import Data', icon: Upload, tooltip: 'Import Data', minRole: 'standard' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, tooltip: 'Settings', minRole: 'master' },
  { href: '/admin/roles', label: 'Role Management', icon: ShieldCheck, tooltip: 'Role Management', minRole: 'master' },
];

function getNavItemsForRole(roleLevel: RoleLevel): AdminNavItem[] {
  const userRank = ROLE_RANK[roleLevel] ?? 0;
  return adminNavItems.filter((item) => {
    const requiredRank = ROLE_RANK[item.minRole ?? 'editor'] ?? 0;
    return userRank >= requiredRank;
  });
}

function SidebarProgramSelector() {
  const { programs, selectedProgramId, setSelectedProgramId, loading } = useProgram();

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <CalendarDays className="w-6 h-6 text-blue-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Symphonix
        </span>
      </div>
      {loading ? (
        <div className="h-9 w-full rounded-lg bg-slate-700 animate-pulse" />
      ) : programs.length === 0 ? (
        <span className="text-sm text-slate-700">No programs found</span>
      ) : (
        <Tooltip text="Switch program" position="right">
          <select
            value={selectedProgramId ?? ''}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full h-9 rounded-lg bg-slate-700 border border-slate-600 px-3 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 cursor-pointer appearance-none"
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

interface UserProfile {
  name: string;
  initials: string;
  role: string;
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { selectedProgram, selectedProgramId } = useProgram();
  const [user, setUser] = useState<UserProfile | undefined>();
  const [roleLevel, setRoleLevel] = useState<RoleLevel>('editor');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const prevProgramIdRef = useRef<string | null>(null);

  // Show/hide onboarding based on per-program wizard_completed state
  useEffect(() => {
    if (!selectedProgram) return;

    const programChanged = prevProgramIdRef.current !== null && prevProgramIdRef.current !== selectedProgramId;
    prevProgramIdRef.current = selectedProgramId;

    if (!selectedProgram.wizard_completed) {
      // Program's wizard is incomplete — show the checklist
      setShowOnboarding(true);
    } else if (programChanged) {
      // Switched to a completed program — hide the checklist
      setShowOnboarding(false);
    }
  }, [selectedProgram, selectedProgramId]);

  // Listen for custom events
  useEffect(() => {
    const handleReopenOnboarding = () => {
      setShowOnboarding(true);
    };
    const handleNewProgramCreated = () => {
      // New program created — wizard will auto-show via the effect above
      // since the new program has wizard_completed=false
      setShowOnboarding(true);
    };
    window.addEventListener('reopen-onboarding', handleReopenOnboarding);
    window.addEventListener('new-program-created', handleNewProgramCreated);
    return () => {
      window.removeEventListener('reopen-onboarding', handleReopenOnboarding);
      window.removeEventListener('new-program-created', handleNewProgramCreated);
    };
  }, []);

  // Fetch the current authenticated user via server API (cookies are httpOnly)
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.google_email) return;
        const fullName = data.display_name || data.google_email.split('@')[0] || 'User';
        const parts = fullName.trim().split(/\s+/);
        const initials =
          parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : fullName.slice(0, 2).toUpperCase();
        const rl = (data.role_level as RoleLevel) || 'editor';
        setRoleLevel(rl);
        const roleLabel = rl === 'master' ? 'Master Admin' : rl === 'standard' ? 'Admin' : 'Editor';
        setUser({ name: fullName, initials, role: roleLabel });
      });
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    router.push('/tools/scheduler');
  }, [router]);

  const handleCloseOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  return (
    <div className="flex h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[999] focus:bg-white focus:px-4 focus:py-2 focus:rounded focus:shadow"
      >
        Skip to main content
      </a>
      {/* Dark sidebar with program selector */}
      <Sidebar
        navItems={getNavItemsForRole(roleLevel)}
        header={<SidebarProgramSelector />}
        onLogout={handleLogout}
        user={user}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content — light theme matching design spec */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        {/* Mobile hamburger header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <CalendarDays className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-semibold text-slate-800">Symphonix</span>
        </div>
        <main id="main-content" className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>

      {/* Onboarding Checklist (bottom-right corner) — per-program */}
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
