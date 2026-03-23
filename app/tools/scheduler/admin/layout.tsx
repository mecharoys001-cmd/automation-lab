'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProgramProvider, useProgram } from './ProgramContext';
import { Sidebar } from '../components/layout/Sidebar';
import { Tooltip } from '../components/ui/Tooltip';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
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
} from 'lucide-react';

const adminNavItems = [
  { href: '/admin', label: 'Calendar', icon: LayoutDashboard, tooltip: 'Calendar' },
  { href: '/admin/event-templates', label: 'Event Templates', icon: GraduationCap, tooltip: 'Event Templates' },
  { href: '/admin/tags', label: 'Tags', icon: Tags, tooltip: 'Tags' },
  { href: '/admin/people', label: 'Staff & Venues', icon: Users, tooltip: 'Staff & Venues' },
  { href: '/admin/calendar', label: 'School Calendar', icon: Calendar, tooltip: 'School Calendar' },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, tooltip: 'Reports' },
  { href: '/admin/versions', label: 'Versions', icon: GitBranch, tooltip: 'Versions' },
  { href: '/admin/import', label: 'Import Data', icon: Upload, tooltip: 'Import Data' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, tooltip: 'Settings' },
  { href: '/admin/roles', label: 'Role Management', icon: ShieldCheck, tooltip: 'Role Management' },
];

function SidebarProgramSelector() {
  const { programs, selectedProgramId, setSelectedProgramId, loading } = useProgram();

  return (
    <div className="pb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <CalendarDays className="w-6 h-6 text-blue-400 flex-shrink-0" />
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

interface UserProfile {
  name: string;
  initials: string;
  role: string;
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { selectedProgram, selectedProgramId } = useProgram();
  const [user, setUser] = useState<UserProfile | undefined>();
  const [showOnboarding, setShowOnboarding] = useState(false);
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

  // Fetch the current authenticated user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      console.log('[AdminLayout] authUser:', JSON.stringify(authUser, null, 2));
      if (!authUser) return;
      const fullName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.email?.split('@')[0] ||
        'User';
      console.log('[AdminLayout] fullName:', fullName);
      const parts = fullName.trim().split(/\s+/);
      const initials =
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : fullName.slice(0, 2).toUpperCase();
      console.log('[AdminLayout] initials:', initials);
      const role = authUser.user_metadata?.role || 'Administrator';
      const userObj = { name: fullName, initials, role };
      console.log('[AdminLayout] setting user:', userObj);
      setUser(userObj);
    });
  }, []);

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/tools/scheduler');
  }, [router]);

  const handleCloseOnboarding = useCallback(() => {
    setShowOnboarding(false);
  }, []);

  return (
    <div className="flex h-screen">
      {/* Dark sidebar with program selector */}
      <Sidebar navItems={adminNavItems} header={<SidebarProgramSelector />} onLogout={handleLogout} user={user} />

      {/* Main content — light theme matching design spec */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <main className="flex-1 overflow-hidden">
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
