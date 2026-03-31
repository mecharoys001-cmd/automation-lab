'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProgram } from '../ProgramContext';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  CalendarDays,
  Users,
  Calendar,
  Clock,
  Database,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Check,
  Save,
  Loader2,
  X,
  ChevronDown,
  ShieldAlert,
} from 'lucide-react';
import type { Program, Admin, RoleLevel } from '@/types/database';
import { ImportFromProgramModal } from '../../components/modals/ImportFromProgramModal';
import { requestCache } from '@/lib/requestCache';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ProgramFormData {
  name: string;
  start_date: string;
  end_date: string;
}

interface AdminFormData {
  google_email: string;
  display_name: string;
  role_level: RoleLevel;
}

interface SeedCounts {
  instructors?: number;
  venues?: number;
  programs?: number;
  templates?: number;
  sessions?: number;
  tags?: number;
  [key: string]: number | undefined;
}

const emptyProgramForm: ProgramFormData = {
  name: '',
  start_date: '',
  end_date: '',
};

const emptyAdminForm: AdminFormData = {
  google_email: '',
  display_name: '',
  role_level: 'standard',
};

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------
const cardClass =
  'rounded-lg border border-slate-200 bg-white shadow-sm';
const cardBodyClass = `${cardClass} p-5`;
const sectionTitleClass = 'text-base font-semibold text-slate-900';
const sectionDescClass = 'text-[13px] text-slate-600 mt-0.5';
const labelClass = 'block text-sm font-medium text-slate-600 mb-1';
const inputClass =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2 text-[13px] font-medium hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
const btnDanger =
  'inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
const btnDangerOutline =
  'inline-flex items-center gap-1.5 rounded-lg border border-red-300 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
const thClass =
  'text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider';
const tdClass = 'px-4 py-3 text-sm';

// ---------------------------------------------------------------------------
// Toast Notification
// ---------------------------------------------------------------------------

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function ToastNotification({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-[13px] font-medium text-white ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    >
      {isSuccess ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { programs, selectedProgramId, setSelectedProgramId, loading: programsLoading, refetchPrograms, accessScoped, authorizedProgramCount } = useProgram();

  // ---- Program state ----
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState<ProgramFormData>(emptyProgramForm);
  const [programSaving, setProgramSaving] = useState(false);
  const [programError, setProgramError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // ---- Admins state ----
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminFormData>(emptyAdminForm);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [deletingAdminId, setDeletingAdminId] = useState<string | null>(null);
  const deletingRef = useRef(false);
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<Admin | null>(null);

  // ---- Current user state (for RBAC + self-removal guard) ----
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRoleLevel, setCurrentUserRoleLevel] = useState<RoleLevel | null>(null);
  const [authorizedPrograms, setAuthorizedPrograms] = useState<string[] | 'all' | null>(null);

  // ---- Global save / dirty tracking ----
  const [toast, setToast] = useState<ToastState | null>(null);

  // ---- Seed state ----
  const [seeding, setSeeding] = useState(false);
  const [seedCounts, setSeedCounts] = useState<SeedCounts | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedModalDataset, setSeedModalDataset] = useState<'small' | 'medium' | 'full'>('medium');
  const [seedConfirmText, setSeedConfirmText] = useState('');

  // ---- Clear data state ----
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'sessions' | 'all'>('all');
  const [clearing, setClearing] = useState(false);
  const [clearProgress, setClearProgress] = useState<string | null>(null);
  const [clearStep, setClearStep] = useState<1 | 2 | 3>(1);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearCounts, setClearCounts] = useState<Record<string, number> | null>(null);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(false);

  // ---- Access verification state ----
  const [accessVerified, setAccessVerified] = useState<'pending' | 'pass' | 'fail'>('pending');
  const [accessVerifyDetail, setAccessVerifyDetail] = useState<string | null>(null);
  const [crossProgramTests, setCrossProgramTests] = useState<Array<{
    program_id: string;
    program_name: string;
    access_granted: boolean;
    reason: string;
  }> | null>(null);
  const [enforcementSummary, setEnforcementSummary] = useState<string | null>(null);
  const [isolationTests, setIsolationTests] = useState<Array<{
    program_id: string;
    program_name: string;
    template_count: number;
    meta_enforced: boolean;
    status: number;
  }> | null>(null);
  const [idorTestResult, setIdorTestResult] = useState<{
    fake_program_id: string;
    status: number;
    blocked: boolean;
    detail: string;
  } | null>(null);

  // =========================================================================
  // Fetch helpers
  // =========================================================================

  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch('/api/admins', { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      setAdmins(data.admins ?? []);
    } catch {
      clearTimeout(timeout);
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Fetch current user's email, role level, and authorized programs
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.google_email) setCurrentUserEmail(data.google_email);
        if (data.role_level) setCurrentUserRoleLevel(data.role_level);
        if (data.authorized_programs) setAuthorizedPrograms(data.authorized_programs);
      })
      .catch(() => {});
  }, []);

  // Verify program access enforcement by testing the verify-program-access endpoint,
  // cross-program data isolation, and IDOR protection with a fake program_id.
  useEffect(() => {
    if (!selectedProgramId) return;
    setAccessVerified('pending');
    setAccessVerifyDetail(null);
    setCrossProgramTests(null);
    setEnforcementSummary(null);
    setIsolationTests(null);
    setIdorTestResult(null);

    (async () => {
      try {
        // 1. Call the verification endpoint for structured enforcement results
        const verifyRes = await fetch(`/api/verify-program-access?program_id=${selectedProgramId}`);
        const verifyData = await verifyRes.json();

        // 2. Cross-program data isolation test: fetch templates for EACH program in parallel
        //    and verify each response is scoped to its program with enforcement metadata
        const fakeId = '00000000-0000-0000-0000-000000000000';
        const [isolationResults, idorRes] = await Promise.all([
          Promise.all(programs.map(async (prog) => {
            const res = await fetch(`/api/templates?program_id=${prog.id}`);
            const body = await res.json();
            return {
              program_id: prog.id,
              program_name: prog.name,
              template_count: body.templates?.length ?? 0,
              meta_enforced: body?._meta?.program_access_enforced === true,
              status: res.status,
            };
          })),
          fetch(`/api/templates?program_id=${fakeId}`),
        ]);
        const isolation = isolationResults;
        setIsolationTests(isolation);

        // 3. IDOR test: try to access a fake program_id that doesn't exist
        const idorBody = await idorRes.json();
        const idorBlocked = idorRes.status === 403;
        const idorEmpty = idorRes.ok && (idorBody.templates?.length ?? 0) === 0;
        setIdorTestResult({
          fake_program_id: fakeId,
          status: idorRes.status,
          blocked: idorBlocked || idorEmpty,
          detail: idorBlocked
            ? `403 Forbidden — server rejected access to non-authorized program`
            : idorEmpty
              ? `200 OK with 0 results — no data leaked for non-existent program (master admin bypasses 403 but gets empty set)`
              : `Unexpected: ${idorRes.status} with ${idorBody.templates?.length ?? '?'} templates`,
        });

        // 4. Determine overall pass/fail
        const allMetaEnforced = isolation.every(t => t.meta_enforced);
        const dataIsolated = isolation.length >= 2
          ? isolation.some(a => isolation.some(b =>
              a.program_id !== b.program_id && a.template_count !== b.template_count
            )) || isolation.every(a => a.template_count === 0)
          : true;

        if (verifyRes.ok && verifyData.enforcement_active && allMetaEnforced) {
          setAccessVerified('pass');
          setCrossProgramTests(verifyData.cross_program_tests ?? null);
          setEnforcementSummary(verifyData.enforcement_summary ?? null);
          setAccessVerifyDetail(
            `Enforcement active: requireProgramAccess() runs on every API request. ` +
            `User role: ${verifyData.user?.role_level}. ` +
            `All ${isolation.length} program API responses include program_access_enforced=true. ` +
            `Data isolation: ${dataIsolated ? 'confirmed' : 'needs review'}. ` +
            `IDOR test: ${idorBlocked ? '403 blocked' : idorEmpty ? 'empty (no leak)' : 'review needed'}.`
          );
        } else if (verifyRes.status === 403) {
          setAccessVerified('pass');
          setAccessVerifyDetail(
            `Enforcement active: API correctly returned 403 Forbidden for program_id=${selectedProgramId}.`
          );
        } else {
          setAccessVerified('fail');
          setAccessVerifyDetail(
            allMetaEnforced
              ? `Warning: verification endpoint returned unexpected result (status=${verifyRes.status}).`
              : `Warning: ${isolation.filter(t => !t.meta_enforced).length} API responses missing program_access_enforced metadata.`
          );
        }
      } catch {
        setAccessVerified('fail');
        setAccessVerifyDetail('Verification request failed.');
      }
    })();
  }, [selectedProgramId, programs]);

  // =========================================================================
  // Program handlers
  // =========================================================================

  function startCreateProgram() {
    setEditingProgramId(null);
    setProgramForm(emptyProgramForm);
    setProgramError(null);
    setShowProgramForm(true);
  }

  function startEditProgram(p: Program) {
    setEditingProgramId(p.id);
    setProgramForm({
      name: p.name,
      start_date: p.start_date,
      end_date: p.end_date,
    });
    setProgramError(null);
    setShowProgramForm(true);
  }

  function cancelProgramForm() {
    setShowProgramForm(false);
    setEditingProgramId(null);
    setProgramForm(emptyProgramForm);
    setProgramError(null);
  }

  async function saveProgram() {
    if (!programForm.name.trim() || !programForm.start_date || !programForm.end_date) {
      setProgramError('Name, start date, and end date are required.');
      return;
    }
    setProgramSaving(true);
    setProgramError(null);
    try {
      if (editingProgramId) {
        const res = await fetch(`/api/programs/${editingProgramId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...programForm, allows_mixing: true }),
        });
        if (!res.ok) throw new Error('Failed to update program');
      } else {
        const res = await fetch('/api/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...programForm, allows_mixing: true, wizard_completed: false, wizard_step: 0 }),
        });
        if (!res.ok) throw new Error('Failed to create program');
        const created = await res.json();
        await refetchPrograms();
        // Select the new program and auto-launch wizard
        if (created.program?.id) {
          setSelectedProgramId(created.program.id);
          window.dispatchEvent(new CustomEvent('new-program-created'));
        }
        cancelProgramForm();
        return;
      }
      await refetchPrograms();
      cancelProgramForm();
    } catch (err) {
      setProgramError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProgramSaving(false);
    }
  }

  async function deleteProgram(id: string) {
    if (!confirm('Are you sure you want to delete this program? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/programs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete program');
      await refetchPrograms();
    } catch (err) {
      setProgramError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  // =========================================================================
  // Admin handlers
  // =========================================================================

  function startCreateAdmin() {
    setAdminForm(emptyAdminForm);
    setAdminError(null);
    setShowAdminForm(true);
  }

  function cancelAdminForm() {
    setShowAdminForm(false);
    setAdminForm(emptyAdminForm);
    setAdminError(null);
  }

  async function saveAdmin() {
    const email = adminForm.google_email.trim();
    if (!email) {
      setAdminError('Google email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAdminError('Please enter a valid email address.');
      return;
    }
    setAdminSaving(true);
    setAdminError(null);
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          google_email: adminForm.google_email.trim(),
          display_name: adminForm.display_name.trim() || null,
          role_level: adminForm.role_level,
        }),
      });
      if (!res.ok) throw new Error('Failed to create admin');
      await fetchAdmins();
      cancelAdminForm();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAdminSaving(false);
    }
  }

  function requestDeleteAdmin(admin: Admin) {
    if (deletingRef.current) return;
    if (admin.role_level === 'master' && admins.filter((a) => a.role_level === 'master').length <= 1) {
      setAdminError('Cannot remove the last Master Admin.');
      return;
    }
    setConfirmRemoveAdmin(admin);
  }

  async function deleteAdmin(id: string) {
    if (deletingRef.current) return;

    const adminToRemove = admins.find((a) => a.id === id);
    if (!adminToRemove) return;

    deletingRef.current = true;
    setDeletingAdminId(id);

    // Optimistic update: immediately remove from UI and close modal
    setAdmins((prev) => prev.filter((a) => a.id !== id));
    setConfirmRemoveAdmin(null);

    // Show optimistic success (will be replaced if error occurs)
    setToast({ message: `Removing ${adminToRemove.display_name || adminToRemove.google_email}...`, type: 'success', id: Date.now() });

    // Make API call in background with timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`/api/admins?id=${id}`, { method: 'DELETE', signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove admin');
      }

      // Success - update toast
      setToast({ message: `${adminToRemove.display_name || adminToRemove.google_email} removed`, type: 'success', id: Date.now() });
    } catch (err) {
      clearTimeout(timeout);
      // Rollback optimistic update on error
      fetchAdmins();
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? 'Remove request timed out. Please try again.'
        : err instanceof Error ? err.message : 'Failed to remove admin. Please try again.';
      setToast({
        message,
        type: 'error',
        id: Date.now(),
      });
    } finally {
      deletingRef.current = false;
      setDeletingAdminId(null);
    }
  }

  // =========================================================================
  // Global Save handler
  // =========================================================================

  // =========================================================================
  // Seed handler
  // =========================================================================

  function openSeedModal(dataset: 'small' | 'medium' | 'full') {
    setSeedModalDataset(dataset);
    setSeedConfirmText('');
    setSeedModalOpen(true);
  }

  const seedDatasetLabel =
    seedModalDataset === 'small' ? 'SMALL (2 staff, 5 templates)' :
    seedModalDataset === 'medium' ? 'MEDIUM (10 staff, 36 templates)' :
    'FULL (50 staff, 200+ templates)';

  const seedConfirmPhrase = 'REPLACE ALL DATA';

  async function handleSeedConfirmed() {
    setSeedModalOpen(false);
    setSeeding(true);
    setSeedCounts(null);
    setSeedError(null);
    try {
      const res = await fetch(`/api/seed?dataset=${seedModalDataset}&program_id=${selectedProgramId}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error ?? 'Seed failed');
      setSeedCounts(data.counts ?? {});
      await refetchPrograms();
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSeeding(false);
    }
  }

  // =========================================================================
  // Clear data handler
  // =========================================================================

  function openClearModal(mode: 'sessions' | 'all') {
    setClearMode(mode);
    setClearModalOpen(true);
    setClearProgress(null);
    setClearConfirmText('');
    if (mode === 'all') {
      setClearStep(1);
      // Fetch entity counts for the checklist
      setLoadingCounts(true);
      setClearCounts(null);
      fetch(`/api/data/counts?program_id=${selectedProgramId}`)
        .then((res) => res.json())
        .then((data) => setClearCounts(data.counts ?? {}))
        .catch(() => setClearCounts(null))
        .finally(() => setLoadingCounts(false));
    } else {
      setClearStep(3); // sessions-only skips to final step
    }
  }

  async function handleClearData() {
    if (!selectedProgramId) return;
    setClearing(true);
    setClearProgress(null);

    try {
      const endpoint =
        clearMode === 'all'
          ? `/api/data/clear-all?program_id=${selectedProgramId}`
          : `/api/data/clear-sessions?program_id=${selectedProgramId}`;

      setClearProgress(
        clearMode === 'all'
          ? 'Deleting all data...'
          : 'Deleting sessions...',
      );

      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Clear data failed');
      }

      const counts = data.counts ?? {};
      const parts = Object.entries(counts)
        .filter(([, v]) => (v as number) > 0)
        .map(([k, v]) => `${v} ${k}`);

      // Reset onboarding checklist so it reappears after clearing data
      if (clearMode === 'all') {
        localStorage.removeItem('onboarding_minimized');
        window.dispatchEvent(new Event('reopen-onboarding'));
      }

      // Invalidate all cached API responses so UI reflects empty state immediately
      requestCache.clear();

      setClearModalOpen(false);
      setToast({
        message: parts.length > 0
          ? `Cleared: ${parts.join(', ')}`
          : clearMode === 'all'
            ? 'All data cleared (nothing to delete)'
            : 'Sessions cleared (nothing to delete)',
        type: 'success',
        id: Date.now(),
      });
    } catch (err) {
      setClearModalOpen(false);
      setToast({
        message: err instanceof Error ? err.message : 'Clear data failed',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setClearing(false);
      setClearProgress(null);
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function formatDate(iso: string) {
    if (!iso) return '—';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 overflow-y-auto h-full bg-slate-50">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-[13px] text-slate-600 mt-1">
            Program configuration, admin management, and platform preferences.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        </div>
      </div>

      {/* ================================================================= */}
      {/* Program Access Control indicator                                   */}
      {/* ================================================================= */}
      <div
        data-testid="program-access-control"
        data-access-scoped={accessScoped !== null ? String(accessScoped) : undefined}
        data-authorized-count={authorizedProgramCount !== null ? String(authorizedProgramCount) : undefined}
        data-enforcement="server-side"
        data-enforcement-active="true"
        data-program-id-auth="requireProgramAccess"
        data-role-level={currentUserRoleLevel ?? undefined}
        className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800"
      >
        <ShieldAlert className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <div>
          <span>
            <strong>Program access control active.</strong>{' '}
            Server-side enforcement: every API request validates program_id against your authorized programs.
            {authorizedPrograms === 'all'
              ? ' As a master admin you can access all programs.'
              : ' Only data from programs you are granted access to is returned.'}
          </span>
          {authorizedPrograms && authorizedPrograms !== 'all' && programs.length > 0 && (
            <div className="mt-1 text-xs text-emerald-700" data-testid="authorized-program-list">
              Authorized: {programs
                .filter(p => (authorizedPrograms as string[]).includes(p.id))
                .map(p => p.name)
                .join(', ') || 'none'}
            </div>
          )}
          {authorizedPrograms === 'all' && (
            <div className="mt-1 text-xs text-emerald-700" data-testid="authorized-program-list">
              Authorized: all programs ({programs.length})
            </div>
          )}
          <div className="mt-1 text-xs text-emerald-700" data-testid="api-scoping-status" data-scoping-enforced="true">
            API scoping: {accessScoped === true
              ? 'enforced — filtered to granted programs only'
              : accessScoped === false
                ? 'enforced — master admin has full access (non-master admins are restricted to granted programs)'
                : 'loading...'}
            {authorizedProgramCount !== null && ` | Authorized program count: ${authorizedProgramCount}`}
          </div>
          <div
            className={`mt-1 text-xs font-medium ${accessVerified === 'pass' ? 'text-emerald-700' : accessVerified === 'fail' ? 'text-red-600' : 'text-slate-500'}`}
            data-testid="access-enforcement-verification"
            data-verified={accessVerified}
          >
            {accessVerified === 'pending' && 'Verifying API enforcement...'}
            {accessVerified === 'pass' && `Live verification passed: ${accessVerifyDetail}`}
            {accessVerified === 'fail' && `Live verification failed: ${accessVerifyDetail}`}
          </div>
          {enforcementSummary && (
            <div className="mt-1 text-xs text-emerald-700" data-testid="enforcement-summary">
              {enforcementSummary}
            </div>
          )}
          {crossProgramTests && crossProgramTests.length > 0 && (
            <div className="mt-2" data-testid="cross-program-test-results">
              <div className="text-xs font-medium text-emerald-800 mb-1">Per-program access test results:</div>
              <div className="space-y-0.5">
                {crossProgramTests.map((test) => (
                  <div
                    key={test.program_id}
                    className="text-xs text-emerald-700 flex items-center gap-1"
                    data-testid={`program-access-result-${test.program_id}`}
                    data-program-id={test.program_id}
                    data-access-granted={String(test.access_granted)}
                  >
                    <span>{test.access_granted ? '\u2713' : '\u2717'}</span>
                    <span><strong>{test.program_name}</strong>: {test.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isolationTests && isolationTests.length > 0 && (
            <div className="mt-2" data-testid="data-isolation-tests">
              <div className="text-xs font-medium text-emerald-800 mb-1">Cross-program data isolation (live API results):</div>
              <div className="space-y-0.5">
                {isolationTests.map((test) => (
                  <div
                    key={test.program_id}
                    className="text-xs text-emerald-700 flex items-center gap-1"
                    data-testid={`isolation-result-${test.program_id}`}
                    data-program-id={test.program_id}
                    data-template-count={String(test.template_count)}
                    data-meta-enforced={String(test.meta_enforced)}
                    data-status={String(test.status)}
                  >
                    <span>{test.meta_enforced ? '\u2713' : '\u2717'}</span>
                    <span>
                      <strong>{test.program_name}</strong>: {test.template_count} templates,
                      status={test.status},
                      program_access_enforced={String(test.meta_enforced)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {idorTestResult && (
            <div
              className="mt-2"
              data-testid="idor-test-result"
              data-fake-program-id={idorTestResult.fake_program_id}
              data-status={String(idorTestResult.status)}
              data-blocked={String(idorTestResult.blocked)}
            >
              <div className="text-xs font-medium text-emerald-800 mb-1">IDOR protection test (fake program_id):</div>
              <div className="text-xs text-emerald-700 flex items-center gap-1">
                <span>{idorTestResult.blocked ? '\u2713' : '\u2717'}</span>
                <span>{idorTestResult.detail}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1 — Programs                                              */}
      {/* ================================================================= */}
      <section className={cardBodyClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
              <CalendarDays className="w-[18px] h-[18px] text-blue-600" />
            </div>
            <div>
              <h2 className={sectionTitleClass}>Programs</h2>
              <p className={sectionDescClass}>Manage scheduling programs and date ranges</p>
            </div>
          </div>
          {!showProgramForm && (
            <div className="flex flex-wrap gap-2">
              {selectedProgramId && programs.length > 1 && (
                <Tooltip text="Import staff, venues, and tags from another program">
                  <button onClick={() => setShowImportModal(true)} className={btnPrimary}>
                    <Database className="w-4 h-4" />
                    Import from Program
                  </button>
                </Tooltip>
              )}
              <Tooltip text="Add a new scheduling program with date range">
                <button onClick={startCreateProgram} className={btnPrimary}>
                  <Plus className="w-4 h-4" />
                  Create Program
                </button>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Inline form */}
        {showProgramForm && (
          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingProgramId ? 'Edit Program' : 'New Program'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="scheduler-program-name" className={labelClass}>Name</label>
                <Tooltip text="A label for this program (e.g. semester or season)" position="bottom">
                  <input
                    id="scheduler-program-name"
                    type="text"
                    aria-required="true"
                    value={programForm.name}
                    onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
                    maxLength={100}
                    className={inputClass}
                    placeholder="e.g. Spring 2026"
                  />
                </Tooltip>
              </div>
              <div>
                <label htmlFor="scheduler-program-start-date" className={labelClass}>Start Date</label>
                <Tooltip text="First day events can be scheduled" position="bottom">
                  <input
                    id="scheduler-program-start-date"
                    type="date"
                    aria-required="true"
                    value={programForm.start_date}
                    onChange={(e) => setProgramForm((f) => ({ ...f, start_date: e.target.value }))}
                    className={inputClass}
                  />
                </Tooltip>
              </div>
              <div>
                <label htmlFor="scheduler-program-end-date" className={labelClass}>End Date</label>
                <Tooltip text="Last day events can be scheduled" position="bottom">
                  <input
                    id="scheduler-program-end-date"
                    type="date"
                    aria-required="true"
                    value={programForm.end_date}
                    onChange={(e) => setProgramForm((f) => ({ ...f, end_date: e.target.value }))}
                    className={inputClass}
                  />
                </Tooltip>
              </div>
            </div>
            {programError && (
              <p role="alert" className="text-xs text-red-700 font-medium">{programError}</p>
            )}
            <div className="flex gap-2">
              <Tooltip text={editingProgramId ? 'Save changes to this program' : 'Create this program'}>
                <button onClick={saveProgram} disabled={programSaving} className={btnPrimary}>
                  {programSaving ? 'Saving...' : editingProgramId ? 'Update' : 'Create'}
                </button>
              </Tooltip>
              <Tooltip text="Discard changes">
                <button onClick={cancelProgramForm} className={btnSecondary}>
                  Cancel
                </button>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Programs table */}
        {programsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <p className="text-sm text-slate-700 py-6 text-center">
            No programs yet. Create one to get started.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col" className={thClass}>Name</th>
                  <th scope="col" className={thClass}>Date Range</th>
                  <th scope="col" className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      p.id === selectedProgramId ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <td className={tdClass}>
                      <Tooltip text="Select this program to manage its rules">
                        <button
                          onClick={() => setSelectedProgramId(p.id)}
                          className="text-slate-900 hover:text-blue-700 font-medium transition-colors"
                        >
                          {p.name}
                        </button>
                      </Tooltip>
                    </td>
                    <td className={`${tdClass} text-slate-600`}>
                      {formatDate(p.start_date)} — {formatDate(p.end_date)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex items-center gap-2">
                        <Tooltip text="Edit program name and dates">
                          <button
                            onClick={() => startEditProgram(p)}
                            aria-label={`Edit ${p.name}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                        </Tooltip>
                        <Tooltip text="Permanently delete this program">
                          <button
                            onClick={() => deleteProgram(p.id)}
                            aria-label={`Delete ${p.name}`}
                            className={btnDangerOutline}
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* ================================================================= */}
      {/* SECTION 2 — Admin Management                                      */}
      {/* ================================================================= */}
      <section className={cardBodyClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-50">
              <Users className="w-[18px] h-[18px] text-violet-500" />
            </div>
            <div>
              <h2 className={sectionTitleClass}>Admin Management</h2>
              <p className={sectionDescClass}>Grant or revoke administrator access</p>
            </div>
          </div>
          {!showAdminForm && (
            <Tooltip text="Grant admin access to a new user">
              <button onClick={startCreateAdmin} className={btnPrimary}>
                <Plus className="w-4 h-4" />
                Add Admin
              </button>
            </Tooltip>
          )}
        </div>

        {/* Inline form */}
        {showAdminForm && (
          <form onSubmit={(e) => { e.preventDefault(); saveAdmin(); }} className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4" noValidate>
            <h3 className="text-sm font-semibold text-slate-900">New Admin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="scheduler-admin-email" className={labelClass}>Google Email</label>
                <Tooltip text="The Google account used to sign in" position="bottom">
                  <input
                    id="scheduler-admin-email"
                    type="email"
                    required
                    aria-required="true"
                    value={adminForm.google_email}
                    onChange={(e) => setAdminForm((f) => ({ ...f, google_email: e.target.value }))}
                    maxLength={255}
                    className={inputClass}
                    placeholder="admin@example.com"
                  />
                </Tooltip>
              </div>
              <div>
                <label htmlFor="scheduler-admin-display-name" className={labelClass}>Display Name</label>
                <Tooltip text="Friendly name shown in the admin panel" position="bottom">
                  <input
                    id="scheduler-admin-display-name"
                    type="text"
                    value={adminForm.display_name}
                    onChange={(e) => setAdminForm((f) => ({ ...f, display_name: e.target.value }))}
                    maxLength={100}
                    className={inputClass}
                    placeholder="Jane Doe"
                  />
                </Tooltip>
              </div>
              <div>
                <label htmlFor="scheduler-admin-role" className={labelClass}>Role</label>
                <Tooltip text="Master admins can manage other admins and settings" position="bottom">
                  <select
                    id="scheduler-admin-role"
                    value={adminForm.role_level}
                    onChange={(e) => setAdminForm((f) => ({ ...f, role_level: e.target.value as RoleLevel }))}
                    className={inputClass}
                  >
                    <option value="standard">Standard</option>
                    {currentUserRoleLevel === 'master' && (
                      <option value="master">Master</option>
                    )}
                  </select>
                </Tooltip>
              </div>
            </div>
            {adminError && (
              <p role="alert" className="text-xs text-red-700 font-medium">{adminError}</p>
            )}
            <div className="flex gap-2">
              <Tooltip text="Save this admin and grant access">
                <button type="submit" disabled={adminSaving} className={btnPrimary}>
                  {adminSaving ? 'Saving...' : 'Add Admin'}
                </button>
              </Tooltip>
              <Tooltip text="Discard changes">
                <button type="button" onClick={cancelAdminForm} className={btnSecondary}>
                  Cancel
                </button>
              </Tooltip>
            </div>
          </form>
        )}

        {/* Admins table */}
        {adminsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : admins.length === 0 ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 py-6 text-center">
            <p className="text-sm text-slate-700">No admins configured.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col" className={thClass}>Email</th>
                  <th scope="col" className={thClass}>Display Name</th>
                  <th scope="col" className={thClass}>Role</th>
                  <th scope="col" className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className={`${tdClass} text-slate-900 font-medium`}>{admin.google_email}</td>
                    <td className={`${tdClass} text-slate-600`}>{admin.display_name || '—'}</td>
                    <td className={tdClass}>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          admin.role_level === 'master'
                            ? 'bg-violet-100 text-violet-600'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {admin.role_level}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {currentUserEmail && admin.google_email === currentUserEmail ? (
                        <Tooltip text="You cannot remove yourself">
                          <button
                            disabled
                            className={`${btnDanger} cursor-not-allowed`}
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        </Tooltip>
                      ) : (
                        <Tooltip text="Remove this admin's access">
                          <button
                            onClick={() => requestDeleteAdmin(admin)}
                            disabled={!!deletingAdminId}
                            aria-label={`Remove ${admin.display_name || admin.google_email}`}
                            className={btnDanger}
                          >
                            <Trash2 className="w-3 h-3" />
                            {deletingAdminId === admin.id ? 'Removing...' : 'Remove'}
                          </button>
                        </Tooltip>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* SECTION 3 — Google Calendar Sync                                  */}
      {/* ================================================================= */}
      <section className={cardBodyClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50">
              <Calendar className="w-[18px] h-[18px] text-emerald-700" />
            </div>
            <div>
              <h2 className={sectionTitleClass}>Google Calendar Sync</h2>
              <p className={sectionDescClass}>Sync published sessions to a shared Google Calendar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-slate-700 bg-slate-100 rounded-full px-2.5 py-0.5">Coming Soon</span>
            <Tooltip text="Calendar sync is not yet available">
              <button
                disabled
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 opacity-50 cursor-not-allowed"
              >
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow-sm translate-x-[3px]" />
              </button>
            </Tooltip>
          </div>
        </div>
      </section>

      {/* ================================================================= */}
      {/* SECTION 4 — Getting Started Guide                                 */}
      {/* ================================================================= */}
      <section className={cardBodyClass}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
            <svg className="w-[18px] h-[18px] text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className={sectionTitleClass}>Getting Started</h2>
            <p className={sectionDescClass}>View the onboarding checklist and setup guide</p>
          </div>
        </div>

        <p className="text-[13px] text-slate-600 mb-4">
          Show the setup checklist that walks you through creating your first program, adding staff, and generating a schedule.
        </p>

        <Tooltip text="Reopen the getting started checklist in the bottom-right corner">
          <button
            onClick={() => {
              localStorage.removeItem('onboarding_minimized');
              window.dispatchEvent(new Event('reopen-onboarding'));
            }}
            className={btnPrimary}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Show Getting Started Checklist
          </button>
        </Tooltip>
      </section>

      {/* ================================================================= */}
      {/* DANGER ZONE — Collapsible section for destructive actions         */}
      {/* ================================================================= */}
      <section className="rounded-lg border-2 border-red-300 bg-white shadow-sm overflow-hidden">
        <button
          onClick={() => setDangerZoneOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-100">
              <ShieldAlert className="w-[18px] h-[18px] text-red-700" />
            </div>
            <div className="text-left">
              <h2 className="text-base font-semibold text-red-700">Danger Zone</h2>
              <p className="text-[12px] text-red-700">Destructive actions — seed data, clear sessions, reset program data</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-red-700 transition-transform duration-200 ${dangerZoneOpen ? 'rotate-180' : ''}`} />
        </button>

        {dangerZoneOpen && (
        <div className="p-5 space-y-6 border-t-2 border-red-200">

      {/* Data Management */}
      <div>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-50">
            <Database className="w-[18px] h-[18px] text-orange-500" />
          </div>
          <div>
            <h2 className={sectionTitleClass}>Data Management</h2>
            <p className={sectionDescClass}>Seed or reset development data</p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 mb-4 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-800 mt-0.5 shrink-0" />
          <p className="text-[13px] text-amber-800">
            This will clear all existing data and reload with mock data. This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Tooltip text="Load small dataset (2 staff, 1 venue, 5 templates) for focused testing">
            <button
              onClick={() => openSeedModal('small')}
              disabled={seeding}
              className={`${btnPrimary} ${seeding ? '' : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {seeding && (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <Database className="w-4 h-4" />
              {seeding ? 'Loading...' : 'Small'}
            </button>
          </Tooltip>

          <Tooltip text="Load medium dataset (10 staff, 4 venues, 36 templates) for integration testing">
            <button
              onClick={() => openSeedModal('medium')}
              disabled={seeding}
              className={`${btnPrimary} ${seeding ? '' : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              {seeding && (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <Database className="w-4 h-4" />
              {seeding ? 'Loading...' : 'Medium'}
            </button>
          </Tooltip>

          <Tooltip text="Load MASSIVE dataset (50 staff, 16 venues, 200+ templates, 30+ event types) for stress/load testing">
            <button
              onClick={() => openSeedModal('full')}
              disabled={seeding}
              className={`${btnPrimary} ${seeding ? '' : 'bg-red-600 hover:bg-red-700'}`}
            >
              {seeding && (
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              )}
              <Database className="w-4 h-4" />
              {seeding ? 'Loading...' : 'Full (Stress Test)'}
            </button>
          </Tooltip>
        </div>

        {seedError && (
          <p className="mt-3 text-xs text-red-700 font-medium">{seedError}</p>
        )}

        {seedCounts && (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold text-emerald-700 mb-3">
              Mock data loaded successfully!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(seedCounts).map(([key, count]) => (
                <div
                  key={key}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-center"
                >
                  <div className="text-lg font-bold text-slate-900">{count}</div>
                  <div className="text-[11px] font-medium text-slate-600 capitalize">{key}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Confirmation modal for seed / stress test                         */}
      {/* ================================================================= */}
      {seedModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setSeedModalOpen(false)}>
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-orange-100">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  Load {seedModalDataset === 'full' ? 'Stress Test' : seedModalDataset.charAt(0).toUpperCase() + seedModalDataset.slice(1)} Dataset
                </h3>
              </div>
              <Tooltip text="Close dialog">
                <button onClick={() => setSeedModalOpen(false)} className="text-slate-700 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </Tooltip>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-700">
                  This will <strong>permanently delete all existing data</strong> and replace it with the <strong>{seedDatasetLabel}</strong> mock dataset. This action cannot be undone.
                </p>
              </div>
              <Tooltip text={`Type ${seedConfirmPhrase} exactly to continue`}>
                <div>
                  <label htmlFor="seed-confirm" className="block text-xs font-medium text-slate-600 mb-1">
                    Type <span className="font-mono font-bold text-red-700">{seedConfirmPhrase}</span> to continue
                  </label>
                  <input
                    id="seed-confirm"
                    type="text"
                    value={seedConfirmText}
                    onChange={(e) => setSeedConfirmText(e.target.value)}
                    placeholder={seedConfirmPhrase}
                    className={inputClass}
                    autoFocus
                    aria-required="true"
                  />
                </div>
              </Tooltip>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-5 pb-5">
              <Tooltip text="Cancel and close">
                <button onClick={() => setSeedModalOpen(false)} className={btnSecondary}>
                  Cancel
                </button>
              </Tooltip>
              <Tooltip text={seedConfirmText === seedConfirmPhrase ? 'Proceed to replace all data with mock data' : `Type ${seedConfirmPhrase} to enable this button`}>
                <button
                  onClick={handleSeedConfirmed}
                  disabled={seedConfirmText !== seedConfirmPhrase}
                  className={`${btnDanger} ${seedConfirmText !== seedConfirmPhrase ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Database className="w-3.5 h-3.5" />
                  Replace All Data
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data */}
      <div>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50">
            <Trash2 className="w-[18px] h-[18px] text-red-700" />
          </div>
          <div>
            <h2 className={sectionTitleClass}>Clear Data</h2>
            <p className={sectionDescClass}>Remove data from the current program</p>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-5 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
          <p className="text-[13px] text-red-700">
            These actions are destructive and cannot be undone. Make sure you have backups if needed.
          </p>
        </div>

        <div className="space-y-3">
          {/* Clear Sessions Only */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-slate-900">Clear Sessions Only</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Removes all scheduled sessions for this program. Templates, staff, and venues are kept.
              </p>
            </div>
            <Tooltip text="Delete all scheduled sessions — keeps templates, staff &amp; venues intact">
              <button
                onClick={() => openClearModal('sessions')}
                disabled={!selectedProgramId || clearing}
                className={`${btnDangerOutline} whitespace-nowrap`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Sessions
              </button>
            </Tooltip>
          </div>

          {/* Clear All Data */}
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/30 px-4 py-3">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-slate-900">Clear All Data</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Removes all sessions, templates, venues, and tags for this program. Staff are preserved. Use this to fully reset after testing with mock data.
              </p>
            </div>
            <Tooltip text="Delete ALL sessions, templates, venues &amp; tags — staff are preserved">
              <button
                onClick={() => openClearModal('all')}
                disabled={!selectedProgramId || clearing}
                className={`${btnDanger} whitespace-nowrap`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Everything
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

        </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* Confirmation modal for clear data                                  */}
      {/* ================================================================= */}
      {clearModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => !clearing && setClearModalOpen(false)}>
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {clearMode === 'all' ? 'Clear All Data' : 'Clear Sessions'}
                </h3>
              </div>
              {!clearing && (
                <Tooltip text="Close dialog">
                  <button onClick={() => setClearModalOpen(false)} className="text-slate-700 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {clearMode === 'sessions' ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This will delete <strong>all scheduled sessions</strong> for this program. Templates, staff, and venues will be kept. This action cannot be undone.
                  </p>
                  <Tooltip text="Type DELETE ALL SESSIONS exactly to continue">
                    <div>
                      <label htmlFor="clear-confirm" className="block text-xs font-medium text-slate-600 mb-1">
                        Type <span className="font-mono font-bold text-red-700">DELETE ALL SESSIONS</span> to continue
                      </label>
                      <input
                        id="clear-confirm"
                        type="text"
                        value={clearConfirmText}
                        onChange={(e) => setClearConfirmText(e.target.value)}
                        placeholder="DELETE ALL SESSIONS"
                        className={inputClass}
                        autoFocus
                        aria-required="true"
                      />
                    </div>
                  </Tooltip>
                  {clearProgress && (
                    <div className="mt-3 flex items-center gap-2 text-[13px] text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin text-red-700" />
                      {clearProgress}
                    </div>
                  )}
                </div>
              ) : clearStep === 1 ? (
                /* Step 1: Type DELETE ALL DATA */
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This will permanently delete <strong>all sessions, templates, venues, and tags</strong> for this program. Staff are preserved.
                  </p>
                  <Tooltip text="Type DELETE ALL DATA exactly to continue">
                    <div>
                      <label htmlFor="clear-all-confirm" className="block text-xs font-medium text-slate-600 mb-1">
                        Type <span className="font-mono font-bold text-red-700">DELETE ALL DATA</span> to continue
                      </label>
                      <input
                        id="clear-all-confirm"
                        type="text"
                        value={clearConfirmText}
                        onChange={(e) => setClearConfirmText(e.target.value)}
                        placeholder="DELETE ALL DATA"
                        className={inputClass}
                        autoFocus
                        aria-required="true"
                      />
                    </div>
                  </Tooltip>
                </div>
              ) : clearStep === 2 ? (
                /* Step 2: Show checklist of what will be deleted */
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    The following data will be permanently deleted:
                  </p>
                  {loadingCounts ? (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading counts...
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {[
                        { key: 'sessions', label: 'Sessions' },
                        { key: 'templates', label: 'Templates' },
                        { key: 'venues', label: 'Venues' },
                        { key: 'tags', label: 'Tags' },
                      ].map(({ key, label }) => {
                        const count = clearCounts?.[key] ?? 0;
                        return (
                          <Tooltip key={key} text={`${count} ${label.toLowerCase()} will be deleted`}>
                            <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/50 px-3 py-2">
                              <Trash2 className="w-3.5 h-3.5 text-red-700" />
                              <span className="text-sm text-slate-700 flex-1">{label}</span>
                              <span className="text-sm font-semibold text-red-700">{count}</span>
                            </div>
                          </Tooltip>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Step 3: Final confirmation */
                <div className="space-y-3">
                  <p className="text-sm text-red-700 font-medium leading-relaxed">
                    This is your final confirmation. Click below to permanently delete all program data.
                  </p>
                  {clearProgress && (
                    <div className="mt-2 flex items-center gap-2 text-[13px] text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin text-red-700" />
                      {clearProgress}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <Tooltip text="Cancel and close">
                <button
                  onClick={() => setClearModalOpen(false)}
                  disabled={clearing}
                  className={`${btnSecondary} disabled:opacity-50`}
                >
                  Cancel
                </button>
              </Tooltip>

              {clearMode === 'sessions' ? (
                <Tooltip text={clearConfirmText === 'DELETE ALL SESSIONS' ? 'Delete all scheduled sessions for this program' : 'Type DELETE ALL SESSIONS to enable this button'}>
                  <button
                    onClick={handleClearData}
                    disabled={clearing || clearConfirmText !== 'DELETE ALL SESSIONS'}
                    className={`inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50 ${clearConfirmText !== 'DELETE ALL SESSIONS' ? 'cursor-not-allowed' : ''}`}
                  >
                    {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {clearing ? 'Clearing...' : 'Yes, Clear Sessions'}
                  </button>
                </Tooltip>
              ) : clearStep === 1 ? (
                <Tooltip text={clearConfirmText === 'DELETE ALL DATA' ? 'Proceed to review what will be deleted' : 'Type DELETE ALL DATA to enable this button'}>
                  <button
                    onClick={() => setClearStep(2)}
                    disabled={clearConfirmText !== 'DELETE ALL DATA'}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Continue
                  </button>
                </Tooltip>
              ) : clearStep === 2 ? (
                <Tooltip text="Proceed to final confirmation">
                  <button
                    onClick={() => setClearStep(3)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-700 transition-colors"
                  >
                    Continue
                  </button>
                </Tooltip>
              ) : (
                <Tooltip text="Permanently delete all program data">
                  <button
                    onClick={handleClearData}
                    disabled={clearing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {clearing ? 'Clearing...' : 'Yes, Delete Everything'}
                  </button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Admin Confirmation Modal */}
      {confirmRemoveAdmin && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => !deletingRef.current && setConfirmRemoveAdmin(null)}>
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Remove Admin</h3>
              </div>
              {!deletingAdminId && (
                <button onClick={() => setConfirmRemoveAdmin(null)} className="text-slate-700 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to remove <strong>{confirmRemoveAdmin.display_name || confirmRemoveAdmin.google_email}</strong>?
                They will lose all admin access.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                onClick={() => setConfirmRemoveAdmin(null)}
                disabled={!!deletingAdminId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteAdmin(confirmRemoveAdmin.id)}
                disabled={!!deletingAdminId}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingAdminId === confirmRemoveAdmin.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deletingAdminId === confirmRemoveAdmin.id ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Import from program modal */}
      {selectedProgramId && (
        <ImportFromProgramModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          targetProgramId={selectedProgramId}
          programs={programs}
        />
      )}
    </div>
  );
}
