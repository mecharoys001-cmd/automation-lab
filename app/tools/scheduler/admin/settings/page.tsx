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
} from 'lucide-react';
import type { Program, Admin, RoleLevel } from '@/types/database';

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
const sectionDescClass = 'text-[13px] text-slate-500 mt-0.5';
const labelClass = 'block text-xs font-medium text-slate-500 mb-1';
const inputClass =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-blue-500 text-white px-4 py-2 text-[13px] font-medium hover:bg-blue-600 transition-colors disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2 text-[13px] font-medium hover:bg-slate-50 transition-colors';
const btnDanger =
  'inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50';
const btnDangerOutline =
  'inline-flex items-center gap-1.5 rounded-lg border border-red-300 text-red-500 px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition-colors';
const thClass =
  'text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider';
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
  const { programs, selectedProgramId, setSelectedProgramId, loading: programsLoading, refetchPrograms } = useProgram();

  // ---- Program state ----
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState<ProgramFormData>(emptyProgramForm);
  const [programSaving, setProgramSaving] = useState(false);
  const [programError, setProgramError] = useState<string | null>(null);

  // ---- Admins state ----
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminFormData>(emptyAdminForm);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [deletingAdminId, setDeletingAdminId] = useState<string | null>(null);

  // ---- Global save / dirty tracking ----
  const [toast, setToast] = useState<ToastState | null>(null);

  // ---- Seed state ----
  const [seeding, setSeeding] = useState(false);
  const [seedCounts, setSeedCounts] = useState<SeedCounts | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // ---- Clear data state ----
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearMode, setClearMode] = useState<'sessions' | 'all'>('all');
  const [clearing, setClearing] = useState(false);
  const [clearProgress, setClearProgress] = useState<string | null>(null);
  const [clearStep, setClearStep] = useState<1 | 2 | 3>(1);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearCounts, setClearCounts] = useState<Record<string, number> | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(false);

  // =========================================================================
  // Fetch helpers
  // =========================================================================

  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true);
    try {
      const res = await fetch('/api/admins');
      const data = await res.json();
      setAdmins(data.admins ?? []);
    } catch {
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

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
          body: JSON.stringify({ ...programForm, allows_mixing: true }),
        });
        if (!res.ok) throw new Error('Failed to create program');
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
    if (!adminForm.google_email.trim()) {
      setAdminError('Google email is required.');
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

  async function deleteAdmin(id: string) {
    if (!confirm('Remove this admin? They will lose access.')) return;
    setDeletingAdminId(id);
    try {
      const res = await fetch(`/api/admins?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete admin');
      await fetchAdmins();
    } catch {
      // no-op
    } finally {
      setDeletingAdminId(null);
    }
  }

  // =========================================================================
  // Global Save handler
  // =========================================================================

  // =========================================================================
  // Seed handler
  // =========================================================================

  async function handleSeed(dataset: 'small' | 'medium' | 'full' = 'medium') {
    const datasetName = 
      dataset === 'small' ? 'SMALL (2 instructors, 5 templates)' :
      dataset === 'medium' ? 'MEDIUM (10 instructors, 36 templates)' :
      'FULL (50 instructors, 200+ templates)';
    if (!confirm(`This will clear ALL existing data and reload with ${datasetName} mock data. Continue?`)) return;
    setSeeding(true);
    setSeedCounts(null);
    setSeedError(null);
    try {
      const res = await fetch(`/api/seed?dataset=${dataset}`, { method: 'POST' });
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
    <div className="space-y-6 p-6 lg:p-8 overflow-y-auto h-full bg-slate-50">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            Program configuration, admin management, and platform preferences.
          </p>
        </div>
        <div className="flex items-center gap-3">
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1 — Programs                                              */}
      {/* ================================================================= */}
      <section className={cardBodyClass}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
              <CalendarDays className="w-[18px] h-[18px] text-blue-500" />
            </div>
            <div>
              <h2 className={sectionTitleClass}>Programs</h2>
              <p className={sectionDescClass}>Manage scheduling programs and date ranges</p>
            </div>
          </div>
          {!showProgramForm && (
            <Tooltip text="Add a new scheduling program with date range">
              <button onClick={startCreateProgram} className={btnPrimary}>
                <Plus className="w-4 h-4" />
                Create Program
              </button>
            </Tooltip>
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
                <label className={labelClass}>Name</label>
                <Tooltip text="A label for this program (e.g. semester or season)" position="bottom">
                  <input
                    type="text"
                    value={programForm.name}
                    onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. Spring 2026"
                  />
                </Tooltip>
              </div>
              <div>
                <label className={labelClass}>Start Date</label>
                <Tooltip text="First day sessions can be scheduled" position="bottom">
                  <input
                    type="date"
                    value={programForm.start_date}
                    onChange={(e) => setProgramForm((f) => ({ ...f, start_date: e.target.value }))}
                    className={inputClass}
                  />
                </Tooltip>
              </div>
              <div>
                <label className={labelClass}>End Date</label>
                <Tooltip text="Last day sessions can be scheduled" position="bottom">
                  <input
                    type="date"
                    value={programForm.end_date}
                    onChange={(e) => setProgramForm((f) => ({ ...f, end_date: e.target.value }))}
                    className={inputClass}
                  />
                </Tooltip>
              </div>
            </div>
            {programError && (
              <p className="text-xs text-red-500 font-medium">{programError}</p>
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
          <p className="text-sm text-slate-400 py-6 text-center">
            No programs yet. Create one to get started.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={thClass}>Name</th>
                  <th className={thClass}>Date Range</th>
                  <th className={`${thClass} text-right`}>Actions</th>
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
                          className="text-slate-900 hover:text-blue-500 font-medium transition-colors"
                        >
                          {p.name}
                        </button>
                      </Tooltip>
                    </td>
                    <td className={`${tdClass} text-slate-500`}>
                      {formatDate(p.start_date)} — {formatDate(p.end_date)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <div className="inline-flex items-center gap-2">
                        <Tooltip text="Edit program name and dates">
                          <button
                            onClick={() => startEditProgram(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit
                          </button>
                        </Tooltip>
                        <Tooltip text="Permanently delete this program">
                          <button
                            onClick={() => deleteProgram(p.id)}
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
        <div className="flex items-center justify-between mb-5">
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
          <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">New Admin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Google Email</label>
                <Tooltip text="The Google account used to sign in" position="bottom">
                  <input
                    type="email"
                    value={adminForm.google_email}
                    onChange={(e) => setAdminForm((f) => ({ ...f, google_email: e.target.value }))}
                    className={inputClass}
                    placeholder="admin@example.com"
                  />
                </Tooltip>
              </div>
              <div>
                <label className={labelClass}>Display Name</label>
                <Tooltip text="Friendly name shown in the admin panel" position="bottom">
                  <input
                    type="text"
                    value={adminForm.display_name}
                    onChange={(e) => setAdminForm((f) => ({ ...f, display_name: e.target.value }))}
                    className={inputClass}
                    placeholder="Jane Doe"
                  />
                </Tooltip>
              </div>
              <div>
                <label className={labelClass}>Role</label>
                <Tooltip text="Master admins can manage other admins and settings" position="bottom">
                  <select
                    value={adminForm.role_level}
                    onChange={(e) => setAdminForm((f) => ({ ...f, role_level: e.target.value as RoleLevel }))}
                    className={inputClass}
                  >
                    <option value="standard">Standard</option>
                    <option value="master">Master</option>
                  </select>
                </Tooltip>
              </div>
            </div>
            {adminError && (
              <p className="text-xs text-red-500 font-medium">{adminError}</p>
            )}
            <div className="flex gap-2">
              <Tooltip text="Save this admin and grant access">
                <button onClick={saveAdmin} disabled={adminSaving} className={btnPrimary}>
                  {adminSaving ? 'Saving...' : 'Add Admin'}
                </button>
              </Tooltip>
              <Tooltip text="Discard changes">
                <button onClick={cancelAdminForm} className={btnSecondary}>
                  Cancel
                </button>
              </Tooltip>
            </div>
          </div>
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
            <p className="text-sm text-slate-400">No admins configured.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className={thClass}>Email</th>
                  <th className={thClass}>Display Name</th>
                  <th className={thClass}>Role</th>
                  <th className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className={`${tdClass} text-slate-900 font-medium`}>{admin.google_email}</td>
                    <td className={`${tdClass} text-slate-500`}>{admin.display_name || '—'}</td>
                    <td className={tdClass}>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                          admin.role_level === 'master'
                            ? 'bg-violet-100 text-violet-600'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {admin.role_level}
                      </span>
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Tooltip text="Remove this admin's access">
                        <button
                          onClick={() => deleteAdmin(admin.id)}
                          disabled={deletingAdminId === admin.id}
                          className={btnDanger}
                        >
                          <Trash2 className="w-3 h-3" />
                          {deletingAdminId === admin.id ? 'Removing...' : 'Remove'}
                        </button>
                      </Tooltip>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50">
              <Calendar className="w-[18px] h-[18px] text-emerald-500" />
            </div>
            <div>
              <h2 className={sectionTitleClass}>Google Calendar Sync</h2>
              <p className={sectionDescClass}>Sync published sessions to a shared Google Calendar</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">Coming Soon</span>
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
            <svg className="w-[18px] h-[18px] text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className={sectionTitleClass}>Getting Started</h2>
            <p className={sectionDescClass}>View the onboarding checklist and setup guide</p>
          </div>
        </div>

        <p className="text-[13px] text-slate-600 mb-4">
          Show the setup checklist that walks you through creating your first program, adding instructors, and generating a schedule.
        </p>

        <Tooltip text="Reopen the getting started checklist in the bottom-right corner">
          <button
            onClick={() => window.dispatchEvent(new Event('reopen-onboarding'))}
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
      {/* SECTION 5 — Data Management                                       */}
      {/* ================================================================= */}
      <section className={cardBodyClass}>
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
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[13px] text-amber-700">
            This will clear all existing data and reload with mock data. This action cannot be undone.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Tooltip text="Load small dataset (2 instructors, 1 venue, 5 templates) for focused testing">
            <button
              onClick={() => handleSeed('small')}
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

          <Tooltip text="Load medium dataset (10 instructors, 4 venues, 36 templates) for integration testing">
            <button
              onClick={() => handleSeed('medium')}
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

          <Tooltip text="Load MASSIVE dataset (50 instructors, 16 venues, 200+ templates, 30+ subjects) for stress/load testing">
            <button
              onClick={() => handleSeed('full')}
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
          <p className="mt-3 text-xs text-red-500 font-medium">{seedError}</p>
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
                  <div className="text-[11px] font-medium text-slate-500 capitalize">{key}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* SECTION 6 — Clear Data (Danger Zone)                              */}
      {/* ================================================================= */}
      <section className="rounded-lg border border-red-200 bg-white shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-red-50">
            <Trash2 className="w-[18px] h-[18px] text-red-500" />
          </div>
          <div>
            <h2 className={sectionTitleClass}>Clear Data</h2>
            <p className={sectionDescClass}>Remove data from the current program</p>
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 mb-5 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-[13px] text-red-700">
            These actions are destructive and cannot be undone. Make sure you have backups if needed.
          </p>
        </div>

        <div className="space-y-3">
          {/* Clear Sessions Only */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-slate-900">Clear Sessions Only</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Removes all generated sessions for this program. Templates, instructors, and venues are kept.
              </p>
            </div>
            <Tooltip text="Delete all sessions — keeps templates, instructors &amp; venues intact">
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
              <p className="text-xs text-slate-500 mt-0.5">
                Removes all sessions, templates, venues, and tags for this program. Instructors are preserved. Use this to fully reset after testing with mock data.
              </p>
            </div>
            <Tooltip text="Delete ALL sessions, templates, venues &amp; tags — instructors are preserved">
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
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {clearMode === 'all' ? 'Clear All Data' : 'Clear Sessions'}
                </h3>
              </div>
              {!clearing && (
                <Tooltip text="Close dialog">
                  <button onClick={() => setClearModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Tooltip>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {clearMode === 'sessions' ? (
                <>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This will delete <strong>all sessions</strong> for this program. Templates, instructors, and venues will be kept. This action cannot be undone.
                  </p>
                  {clearProgress && (
                    <div className="mt-3 flex items-center gap-2 text-[13px] text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      {clearProgress}
                    </div>
                  )}
                </>
              ) : clearStep === 1 ? (
                /* Step 1: Type DELETE ALL DATA */
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 leading-relaxed">
                    This will permanently delete <strong>all sessions, templates, venues, and tags</strong> for this program. Instructors are preserved.
                  </p>
                  <Tooltip text="Type DELETE ALL DATA exactly to continue">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Type <span className="font-mono font-bold text-red-500">DELETE ALL DATA</span> to continue
                      </label>
                      <input
                        type="text"
                        value={clearConfirmText}
                        onChange={(e) => setClearConfirmText(e.target.value)}
                        placeholder="DELETE ALL DATA"
                        className={inputClass}
                        autoFocus
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
                    <div className="flex items-center gap-2 text-sm text-slate-400">
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
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              <span className="text-sm text-slate-700 flex-1">{label}</span>
                              <span className="text-sm font-semibold text-red-600">{count}</span>
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
                  <p className="text-sm text-red-600 font-medium leading-relaxed">
                    This is your final confirmation. Click below to permanently delete all program data.
                  </p>
                  {clearProgress && (
                    <div className="mt-2 flex items-center gap-2 text-[13px] text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
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
                <Tooltip text="Delete all sessions for this program">
                  <button
                    onClick={handleClearData}
                    disabled={clearing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    Continue
                  </button>
                </Tooltip>
              ) : clearStep === 2 ? (
                <Tooltip text="Proceed to final confirmation">
                  <button
                    onClick={() => setClearStep(3)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-600 transition-colors"
                  >
                    Continue
                  </button>
                </Tooltip>
              ) : (
                <Tooltip text="Permanently delete all program data">
                  <button
                    onClick={handleClearData}
                    disabled={clearing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
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

      {/* Toast notifications */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}
