'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProgram } from '../ProgramContext';
import Tooltip from '../../components/Tooltip';
import type { Program, ProgramRule, RuleType, Admin, RoleLevel } from '@/types/database';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ProgramFormData {
  name: string;
  start_date: string;
  end_date: string;
  allows_mixing: boolean;
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
  allows_mixing: false,
};

const emptyAdminForm: AdminFormData = {
  google_email: '',
  display_name: '',
  role_level: 'standard',
};

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

  // ---- Program Rules state ----
  const [rules, setRules] = useState<ProgramRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleSaving, setRuleSaving] = useState<string | null>(null); // tracks which cell is saving

  // ---- Admins state ----
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState<AdminFormData>(emptyAdminForm);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [deletingAdminId, setDeletingAdminId] = useState<string | null>(null);

  // ---- Buffer Time state ----
  const [bufferEnabled, setBufferEnabled] = useState(false);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [bufferLoading, setBufferLoading] = useState(true);
  const [bufferSaving, setBufferSaving] = useState(false);
  const [bufferError, setBufferError] = useState<string | null>(null);
  const [bufferSuccess, setBufferSuccess] = useState(false);

  // ---- Seed state ----
  const [seeding, setSeeding] = useState(false);
  const [seedCounts, setSeedCounts] = useState<SeedCounts | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  // =========================================================================
  // Fetch helpers
  // =========================================================================

  const fetchRules = useCallback(async (programId: string) => {
    setRulesLoading(true);
    try {
      const res = await fetch(`/api/program-rules?program_id=${programId}`);
      const data = await res.json();
      setRules(data.rules ?? data.program_rules ?? []);
    } catch {
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, []);

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

  const fetchBufferSettings = useCallback(async () => {
    setBufferLoading(true);
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.settings) {
        setBufferEnabled(data.settings.buffer_time_enabled);
        setBufferMinutes(data.settings.buffer_time_minutes);
      }
    } catch {
      // defaults remain
    } finally {
      setBufferLoading(false);
    }
  }, []);

  // Load admins and buffer settings on mount
  useEffect(() => {
    fetchAdmins();
    fetchBufferSettings();
  }, [fetchAdmins, fetchBufferSettings]);

  // Load rules when selected program changes
  useEffect(() => {
    if (selectedProgramId) {
      fetchRules(selectedProgramId);
    } else {
      setRules([]);
    }
  }, [selectedProgramId, fetchRules]);

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
      allows_mixing: p.allows_mixing,
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
          body: JSON.stringify(programForm),
        });
        if (!res.ok) throw new Error('Failed to update program');
      } else {
        const res = await fetch('/api/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(programForm),
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
  // Program Rules handlers
  // =========================================================================

  function getRuleForDayAndType(dayOfWeek: number, ruleType: RuleType): ProgramRule | undefined {
    return rules.find(
      (r) => r.day_of_week === dayOfWeek && r.rule_type === ruleType
    );
  }

  async function toggleDayRule(dayOfWeek: number, ruleType: RuleType) {
    if (!selectedProgramId) return;

    const cellKey = `${dayOfWeek}-${ruleType}`;
    setRuleSaving(cellKey);

    const existing = getRuleForDayAndType(dayOfWeek, ruleType);

    try {
      if (existing) {
        // Toggle is_active
        await fetch('/api/program-rules', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: existing.id, is_active: !existing.is_active }),
        });
      } else {
        // Create new rule
        await fetch('/api/program-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: selectedProgramId,
            rule_type: ruleType,
            day_of_week: dayOfWeek,
            description: `${ruleType === 'blackout_day' ? 'Blackout' : 'Makeup'} on ${DAY_LABELS[dayOfWeek]}`,
            is_active: true,
          }),
        });
      }
      await fetchRules(selectedProgramId);
    } catch {
      // silently fail — rule state will remain as-is
    } finally {
      setRuleSaving(null);
    }
  }

  async function toggleRuleActive(rule: ProgramRule) {
    if (!selectedProgramId) return;
    try {
      await fetch('/api/program-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      });
      await fetchRules(selectedProgramId);
    } catch {
      // no-op
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
  // Buffer Time handler
  // =========================================================================

  async function saveBufferSettings() {
    setBufferSaving(true);
    setBufferError(null);
    setBufferSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buffer_time_enabled: bufferEnabled,
          buffer_time_minutes: bufferMinutes,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save settings');
      }
      setBufferSuccess(true);
      setTimeout(() => setBufferSuccess(false), 3000);
    } catch (err) {
      setBufferError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBufferSaving(false);
    }
  }

  // =========================================================================
  // Seed handler
  // =========================================================================

  async function handleSeed() {
    if (!confirm('This will clear ALL existing data and reload with mock data. Continue?')) return;
    setSeeding(true);
    setSeedCounts(null);
    setSeedError(null);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Program configuration, admin management, and platform preferences.
        </p>
      </div>

      {/* ================================================================= */}
      {/* SECTION 1 — Programs */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Programs</h2>
          {!showProgramForm && (
            <Tooltip text="Add a new scheduling program with date range">
              <button
                onClick={startCreateProgram}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
              >
                Create Program
              </button>
            </Tooltip>
          )}
        </div>

        {/* Inline form */}
        {showProgramForm && (
          <div className="mb-4 rounded-lg border border-border bg-muted/10 p-4 space-y-3">
            <h3 className="text-sm font-semibold">
              {editingProgramId ? 'Edit Program' : 'New Program'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Name</label>
                <Tooltip text="A label for this program (e.g. semester or season)" position="bottom">
                  <input
                    type="text"
                    value={programForm.name}
                    onChange={(e) => setProgramForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Spring 2026"
                  />
                </Tooltip>
              </div>
              <div className="flex items-end gap-2">
                <Tooltip text="Allow students from different groups to share sessions">
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={programForm.allows_mixing}
                      onChange={(e) => setProgramForm((f) => ({ ...f, allows_mixing: e.target.checked }))}
                      className="rounded border-border"
                    />
                    Allows Mixing
                  </label>
                </Tooltip>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Start Date</label>
                <Tooltip text="First day sessions can be scheduled" position="bottom">
                  <input
                    type="date"
                    value={programForm.start_date}
                    onChange={(e) => setProgramForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">End Date</label>
                <Tooltip text="Last day sessions can be scheduled" position="bottom">
                  <input
                    type="date"
                    value={programForm.end_date}
                    onChange={(e) => setProgramForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Tooltip>
              </div>
            </div>
            {programError && (
              <p className="text-xs text-red-400">{programError}</p>
            )}
            <div className="flex gap-2">
              <Tooltip text={editingProgramId ? 'Save changes to this program' : 'Create this program'}>
                <button
                  onClick={saveProgram}
                  disabled={programSaving}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {programSaving ? 'Saving...' : editingProgramId ? 'Update' : 'Create'}
                </button>
              </Tooltip>
              <Tooltip text="Discard changes">
                <button
                  onClick={cancelProgramForm}
                  className="rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors px-4 py-2"
                >
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
              <div key={i} className="h-10 animate-pulse bg-muted/30 rounded" />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No programs yet. Create one to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date Range</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Allows Mixing</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {programs.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b border-border hover:bg-muted/30 ${
                      p.id === selectedProgramId ? 'bg-muted/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Tooltip text="Select this program to manage its rules">
                        <button
                          onClick={() => setSelectedProgramId(p.id)}
                          className="text-foreground hover:underline font-medium"
                        >
                          {p.name}
                        </button>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(p.start_date)} — {formatDate(p.end_date)}
                    </td>
                    <td className="px-3 py-2">
                      {p.allows_mixing ? (
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-green-900/40 text-green-400">
                          Yes
                        </span>
                      ) : (
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-muted/50 text-muted-foreground">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <Tooltip text="Edit program name, dates, or mixing">
                        <button
                          onClick={() => startEditProgram(p)}
                          className="rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors px-3 py-1.5"
                        >
                          Edit
                        </button>
                      </Tooltip>
                      <Tooltip text="Permanently delete this program">
                        <button
                          onClick={() => deleteProgram(p.id)}
                          className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* SECTION 2 — Program Rules */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">
          Program Rules
          {selectedProgramId && programs.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              — {programs.find((p) => p.id === selectedProgramId)?.name ?? 'Unknown'}
            </span>
          )}
        </h2>

        {!selectedProgramId ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Select a program above to manage its rules.
          </p>
        ) : rulesLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-muted/30 rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* Day-of-week toggle grid */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground mb-3">
                Click a pill to toggle a blackout or makeup rule for that day.
              </p>
              <div className="grid grid-cols-7 gap-2">
                {DAY_LABELS.map((label, dayIdx) => {
                  const blackoutRule = getRuleForDayAndType(dayIdx, 'blackout_day');
                  const makeupRule = getRuleForDayAndType(dayIdx, 'makeup_day');
                  const blackoutActive = blackoutRule?.is_active ?? false;
                  const makeupActive = makeupRule?.is_active ?? false;
                  const blackoutSaving = ruleSaving === `${dayIdx}-blackout_day`;
                  const makeupSavingFlag = ruleSaving === `${dayIdx}-makeup_day`;

                  return (
                    <div key={dayIdx} className="flex flex-col items-center gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      <Tooltip text={blackoutActive ? `Remove ${label} blackout` : `No sessions on ${label}s`}>
                        <button
                          onClick={() => toggleDayRule(dayIdx, 'blackout_day')}
                          disabled={blackoutSaving}
                          className={`w-full rounded-md px-2 py-1 text-xs font-medium transition-colors border ${
                            blackoutActive
                              ? 'bg-red-900/40 border-red-700 text-red-300'
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/30'
                          } ${blackoutSaving ? 'opacity-50' : ''}`}
                        >
                          {blackoutSaving ? '...' : 'Blackout'}
                        </button>
                      </Tooltip>
                      <Tooltip text={makeupActive ? `Remove ${label} makeup day` : `Allow makeup sessions on ${label}s`}>
                        <button
                          onClick={() => toggleDayRule(dayIdx, 'makeup_day')}
                          disabled={makeupSavingFlag}
                          className={`w-full rounded-md px-2 py-1 text-xs font-medium transition-colors border ${
                            makeupActive
                              ? 'bg-green-900/40 border-green-700 text-green-300'
                              : 'bg-card border-border text-muted-foreground hover:bg-muted/30'
                          } ${makeupSavingFlag ? 'opacity-50' : ''}`}
                        >
                          {makeupSavingFlag ? '...' : 'Makeup'}
                        </button>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Existing rules list */}
            {rules.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Active Rules</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Day</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((rule) => (
                      <tr key={rule.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              rule.rule_type === 'blackout_day'
                                ? 'bg-red-900/40 text-red-300'
                                : 'bg-green-900/40 text-green-300'
                            }`}
                          >
                            {rule.rule_type === 'blackout_day' ? 'Blackout' : 'Makeup'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {rule.day_of_week !== null ? DAY_LABELS[rule.day_of_week] : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {rule.description || '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Tooltip text={rule.is_active ? 'Disable this rule' : 'Enable this rule'}>
                            <button
                              onClick={() => toggleRuleActive(rule)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                rule.is_active ? 'bg-primary' : 'bg-muted'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                                  rule.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'
                                }`}
                              />
                            </button>
                          </Tooltip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No rules configured. Use the grid above to add blackout or makeup day rules.
              </p>
            )}
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* SECTION 3 — Admin Management */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Admin Management</h2>
          {!showAdminForm && (
            <Tooltip text="Grant admin access to a new user">
              <button
                onClick={startCreateAdmin}
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90"
              >
                Add Admin
              </button>
            </Tooltip>
          )}
        </div>

        {/* Inline form */}
        {showAdminForm && (
          <div className="mb-4 rounded-lg border border-border bg-muted/10 p-4 space-y-3">
            <h3 className="text-sm font-semibold">New Admin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Google Email</label>
                <Tooltip text="The Google account used to sign in" position="bottom">
                  <input
                    type="email"
                    value={adminForm.google_email}
                    onChange={(e) => setAdminForm((f) => ({ ...f, google_email: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="admin@example.com"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Display Name</label>
                <Tooltip text="Friendly name shown in the admin panel" position="bottom">
                  <input
                    type="text"
                    value={adminForm.display_name}
                    onChange={(e) => setAdminForm((f) => ({ ...f, display_name: e.target.value }))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Jane Doe"
                  />
                </Tooltip>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Role</label>
                <Tooltip text="Master admins can manage other admins and settings" position="bottom">
                  <select
                    value={adminForm.role_level}
                    onChange={(e) => setAdminForm((f) => ({ ...f, role_level: e.target.value as RoleLevel }))}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="standard">Standard</option>
                    <option value="master">Master</option>
                  </select>
                </Tooltip>
              </div>
            </div>
            {adminError && (
              <p className="text-xs text-red-400">{adminError}</p>
            )}
            <div className="flex gap-2">
              <Tooltip text="Save this admin and grant access">
                <button
                  onClick={saveAdmin}
                  disabled={adminSaving}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {adminSaving ? 'Saving...' : 'Add Admin'}
                </button>
              </Tooltip>
              <Tooltip text="Discard changes">
                <button
                  onClick={cancelAdminForm}
                  className="rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors px-4 py-2"
                >
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
              <div key={i} className="h-10 animate-pulse bg-muted/30 rounded" />
            ))}
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No admins configured.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Display Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Role</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-3 py-2 text-foreground">{admin.google_email}</td>
                    <td className="px-3 py-2 text-muted-foreground">{admin.display_name || '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          admin.role_level === 'master'
                            ? 'bg-purple-900/40 text-purple-300'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        {admin.role_level}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Tooltip text="Remove this admin's access">
                        <button
                          onClick={() => deleteAdmin(admin.id)}
                          disabled={deletingAdminId === admin.id}
                          className="rounded-md bg-red-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          {deletingAdminId === admin.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* SECTION 4 — Google Calendar Sync */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Google Calendar Sync</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Sync published sessions to a shared Google Calendar.
            </p>
            <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
          </div>
          <Tooltip text="Calendar sync is not yet available">
            <button
              disabled
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted opacity-50 cursor-not-allowed"
            >
              <span className="inline-block h-4 w-4 rounded-full bg-white translate-x-[3px]" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ================================================================= */}
      {/* SECTION 4.5 — Buffer Time */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Buffer Time</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add padding before and after sessions when detecting scheduling conflicts.
          When enabled, the scheduler treats sessions as longer than their actual
          duration for overlap checks, preventing back-to-back bookings.
        </p>

        {bufferLoading ? (
          <div className="space-y-3">
            <div className="h-6 w-48 animate-pulse bg-muted/30 rounded" />
            <div className="h-10 w-64 animate-pulse bg-muted/30 rounded" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <Tooltip text="Enable or disable buffer time for all conflict checks">
                <span className="text-sm text-foreground">Enable Buffer Time</span>
              </Tooltip>
              <Tooltip text={bufferEnabled ? 'Disable buffer time' : 'Enable buffer time'}>
                <button
                  onClick={() => setBufferEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    bufferEnabled ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      bufferEnabled ? 'translate-x-[24px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>
              </Tooltip>
            </div>

            {/* Duration dropdown */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Buffer Duration</label>
              <Tooltip text="Minutes of padding added before and after each session" position="bottom">
                <select
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(Number(e.target.value))}
                  disabled={!bufferEnabled}
                  className="w-full max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </Tooltip>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <Tooltip text="Persist buffer time settings">
                <button
                  onClick={saveBufferSettings}
                  disabled={bufferSaving}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {bufferSaving ? 'Saving...' : 'Save'}
                </button>
              </Tooltip>
              {bufferSuccess && (
                <span className="text-xs text-green-400">Settings saved!</span>
              )}
            </div>

            {bufferError && (
              <p className="text-xs text-red-400">{bufferError}</p>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* SECTION 5 — Data Management */}
      {/* ================================================================= */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>

        <p className="text-sm text-yellow-400/80 mb-4">
          Warning: This will clear all existing data and reload with mock data.
        </p>

        <Tooltip text="Replace all data with sample records for testing">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
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
          {seeding ? 'Loading Mock Data...' : 'Load Mock Data'}
          </button>
        </Tooltip>

        {seedError && (
          <p className="mt-3 text-xs text-red-400">{seedError}</p>
        )}

        {seedCounts && (
          <div className="mt-4 rounded-lg border border-border bg-muted/10 p-4">
            <p className="text-sm font-medium text-green-400 mb-2">
              Mock data loaded successfully!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {Object.entries(seedCounts).map(([key, count]) => (
                <div
                  key={key}
                  className="rounded-md border border-border bg-card px-3 py-2 text-center"
                >
                  <div className="text-lg font-bold text-foreground">{count}</div>
                  <div className="text-xs text-muted-foreground capitalize">{key}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
