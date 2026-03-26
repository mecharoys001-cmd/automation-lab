'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProgram } from '../ProgramContext';
import { Tooltip } from '../../components/ui/Tooltip';
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  Check,
  Search,
  X,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
} from 'lucide-react';
import type { Admin, Instructor } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppRole = 'master_admin' | 'admin' | 'editor' | 'instructor';

interface UnifiedUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  source: 'admin' | 'instructor';
  createdAt: string;
}

interface UserFormData {
  email: string;
  name: string;
  role: AppRole;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_META: Record<AppRole, { label: string; description: string; color: string; icon: typeof Shield }> = {
  master_admin: {
    label: 'Master Admin',
    description: 'Full system access — manage users, settings, and all data',
    color: 'bg-violet-100 text-violet-600',
    icon: ShieldAlert,
  },
  admin: {
    label: 'Admin',
    description: 'Manage schedules, templates, and staff',
    color: 'bg-blue-100 text-blue-600',
    icon: ShieldCheck,
  },
  editor: {
    label: 'Editor',
    description: 'Edit schedules and sessions within existing programs',
    color: 'bg-amber-100 text-amber-800',
    icon: Shield,
  },
  instructor: {
    label: 'Staff',
    description: 'View own schedule and availability only',
    color: 'bg-emerald-100 text-emerald-800',
    icon: GraduationCap,
  },
};

const emptyForm: UserFormData = { email: '', name: '', role: 'editor' };

const cardBodyClass = 'rounded-lg border border-slate-200 bg-white shadow-sm p-5';
const sectionTitleClass = 'text-base font-semibold text-slate-900';
const sectionDescClass = 'text-[13px] text-slate-600 mt-0.5';
const labelClass = 'block text-sm font-medium text-slate-600 mb-1';
const inputClass =
  'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-colors';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-blue-500 text-white px-4 py-2 text-[13px] font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-slate-900 px-4 py-2 text-[13px] font-medium hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
const btnDanger =
  'inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-3 py-1.5 text-xs font-medium hover:bg-red-600 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus:outline-none';
const thClass =
  'text-left px-4 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider';
const tdClass = 'px-4 py-3 text-sm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get allowed role options based on current user's role */
function getAllowedRoleOptions(currentRole: AppRole | null): AppRole[] {
  // Master Admin can assign any role
  if (currentRole === 'master_admin') {
    return ['master_admin', 'admin', 'editor', 'instructor'];
  }
  // Non-Master Admin users cannot grant Master Admin privileges
  // They can only assign Admin, Editor, or Staff roles
  return ['admin', 'editor', 'instructor'];
}

/** Map DB admin role_level to our unified role */
function adminRoleToAppRole(roleLevel: string): AppRole {
  if (roleLevel === 'master') return 'master_admin';
  if (roleLevel === 'editor') return 'editor';
  return 'admin'; // 'standard' maps to admin
}

/** Map our unified role back to admin role_level for the API */
function appRoleToAdminLevel(role: AppRole): string {
  if (role === 'master_admin') return 'master';
  if (role === 'editor') return 'editor';
  return 'standard';
}

function normalizeAdmins(admins: Admin[]): UnifiedUser[] {
  return admins.map((a) => ({
    id: a.id,
    name: a.display_name || a.google_email.split('@')[0],
    email: a.google_email,
    role: adminRoleToAppRole(a.role_level),
    source: 'admin' as const,
    createdAt: a.created_at,
  }));
}

/** Title-case a word: 'ROY' → 'Roy', 'da' stays 'da' if short */
function titleCase(s: string): string {
  if (!s) return s;
  // If all-caps and longer than 1 char, title-case it
  if (s.length > 1 && s === s.toUpperCase()) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  return s;
}

function formatInstructorName(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.trim() ? titleCase(firstName.trim()) : '';
  const l = lastName?.trim() ? titleCase(lastName.trim()) : '';
  if (f && l) return `${f} ${l}`;
  if (f) return f;
  if (l) return l;
  return '';
}

function normalizeInstructors(instructors: Instructor[]): UnifiedUser[] {
  return instructors.map((i) => ({
    id: i.id,
    name: formatInstructorName(i.first_name, i.last_name) || i.email || 'Unknown',
    email: i.email || '',
    role: 'instructor' as AppRole,
    source: 'instructor' as const,
    createdAt: i.created_at,
  }));
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

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
// Main Page
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const { selectedProgramId } = useProgram();
  // ---- Data state ----
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- Search & filter ----
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AppRole | null>(null);

  // ---- Add user modal ----
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ---- Inline edit ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('editor');

  // ---- Remove confirmation ----
  const [removeUser, setRemoveUser] = useState<UnifiedUser | null>(null);
  const [removing, setRemoving] = useState(false);

  // ---- Toast ----
  const [toast, setToast] = useState<ToastState | null>(null);

  // ---- Current user ----
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.email) setCurrentUserEmail(data.email.toLowerCase());
      });
  }, []);

  // Derive current user's role from admins list
  const currentUserRole = useMemo((): AppRole | null => {
    if (!currentUserEmail) return null;
    const currentAdmin = admins.find(a => a.google_email.toLowerCase() === currentUserEmail);
    return currentAdmin ? adminRoleToAppRole(currentAdmin.role_level) : null;
  }, [currentUserEmail, admins]);

  // =========================================================================
  // Fetch
  // =========================================================================

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [adminsRes, instructorsRes] = await Promise.all([
        fetch('/api/admins'),
        fetch(`/api/instructors?program_id=${selectedProgramId}`),
      ]);
      const adminsData = await adminsRes.json();
      const instructorsData = await instructorsRes.json();
      setAdmins(adminsData.admins ?? []);
      setInstructors(instructorsData.instructors ?? []);
    } catch {
      setAdmins([]);
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  useEffect(() => {
    if (selectedProgramId) fetchAll();
  }, [fetchAll]);

  // =========================================================================
  // Unified user list
  // =========================================================================

  const users = useMemo(() => {
    let all = [...normalizeAdmins(admins), ...normalizeInstructors(instructors)];
    if (roleFilter) {
      all = all.filter((u) => u.role === roleFilter);
    }
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_META[u.role].label.toLowerCase().includes(q)
    );
  }, [admins, instructors, search, roleFilter]);

  // =========================================================================
  // Add user
  // =========================================================================

  function openAddModal() {
    setForm(emptyForm);
    setFormError(null);
    setShowAddModal(true);
  }

  function closeAddModal() {
    setShowAddModal(false);
    setForm(emptyForm);
    setFormError(null);
  }

  async function handleAddUser() {
    if (!form.email.trim()) {
      setFormError('Email is required.');
      return;
    }
    if (!form.name.trim()) {
      setFormError('Name is required.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (form.role === 'instructor') {
        const nameParts = form.name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        const res = await fetch('/api/instructors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: selectedProgramId,
            first_name: firstName,
            last_name: lastName,
            email: form.email.trim().toLowerCase(),
            is_active: true,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create instructor');
        }
      } else {
        const res = await fetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            google_email: form.email.trim().toLowerCase(),
            display_name: form.name.trim(),
            role_level: appRoleToAdminLevel(form.role),
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create admin');
        }
      }

      await fetchAll();
      closeAddModal();
      setToast({ message: `${form.name} added as ${ROLE_META[form.role].label}`, type: 'success', id: Date.now() });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  }

  // =========================================================================
  // Edit role
  // =========================================================================

  function startEdit(user: UnifiedUser) {
    setEditingId(user.id);
    setEditRole(user.role);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(user: UnifiedUser) {
    console.log('[SAVE_EDIT] editRole:', editRole, 'user.role:', user.role, 'user.id:', user.id, 'user.source:', user.source);
    if (editRole === user.role) {
      console.log('[SAVE_EDIT] Roles match, cancelling edit');
      cancelEdit();
      return;
    }

    const wasInstructor = user.source === 'instructor';
    const becomingInstructor = editRole === 'instructor';
    console.log('[SAVE_EDIT] wasInstructor:', wasInstructor, 'becomingInstructor:', becomingInstructor);

    try {
      if (wasInstructor && !becomingInstructor) {
        // Create admin first, then delete instructor (safe order — no data loss on failure)
        const createRes = await fetch('/api/admins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            google_email: user.email,
            display_name: user.name,
            role_level: appRoleToAdminLevel(editRole),
          }),
        });
        if (!createRes.ok) throw new Error('Failed to create admin record');
        await fetch(`/api/instructors/${user.id}`, { method: 'DELETE' });
      } else if (!wasInstructor && becomingInstructor) {
        // Create instructor first, then delete admin (safe order — no data loss on failure)
        const nameParts = user.name.split(/\s+/);
        const createRes = await fetch('/api/instructors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: selectedProgramId,
            first_name: nameParts[0],
            last_name: nameParts.slice(1).join(' ') || '',
            email: user.email,
            is_active: true,
          }),
        });
        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => ({}));
          throw new Error(errBody.error || 'Failed to create instructor record');
        }
        await fetch(`/api/admins?id=${user.id}`, { method: 'DELETE' });
      } else {
        // Same source, just update role level via PATCH
        const res = await fetch('/api/admins?id=' + user.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role_level: appRoleToAdminLevel(editRole),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to update role');
        }
      }

      await fetchAll();
      setEditingId(null);
      setToast({ message: `${user.name} updated to ${ROLE_META[editRole].label}`, type: 'success', id: Date.now() });
    } catch {
      setToast({ message: 'Failed to update role', type: 'error', id: Date.now() });
    }
  }

  // =========================================================================
  // Remove user
  // =========================================================================

  async function handleRemove() {
    if (!removeUser) return;

    const userToRemove = removeUser;

    // Optimistic update: immediately remove from UI and close modal
    if (userToRemove.source === 'instructor') {
      setInstructors((prev) => prev.filter((i) => i.id !== userToRemove.id));
    } else {
      setAdmins((prev) => prev.filter((a) => a.id !== userToRemove.id));
    }
    setRemoveUser(null);
    setRemoving(false);

    // Show optimistic success (will be replaced if error occurs)
    setToast({ message: `Removing ${userToRemove.name}...`, type: 'success', id: Date.now() });

    // Make API call in background
    try {
      const endpoint = userToRemove.source === 'instructor'
        ? `/api/instructors/${userToRemove.id}`
        : `/api/admins?id=${userToRemove.id}`;
      
      const res = await fetch(endpoint, { method: 'DELETE' });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove user');
      }

      // Success - update toast
      setToast({ message: `${userToRemove.name} removed`, type: 'success', id: Date.now() });
    } catch (err) {
      // Rollback optimistic update on error
      if (userToRemove.source === 'instructor') {
        // Refetch to restore the user
        fetchAll();
      } else {
        fetchAll();
      }
      setToast({ 
        message: err instanceof Error ? err.message : 'Failed to remove user. Please try again.',
        type: 'error',
        id: Date.now()
      });
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6 p-6 lg:p-8 overflow-y-auto h-full bg-slate-50">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Role Management</h1>
          <p className="text-[13px] text-slate-600 mt-1">
            Manage user access levels for the Symphonix scheduler.
          </p>
        </div>
        <Tooltip text="Add a new user with a specific role">
          <button onClick={openAddModal} className={btnPrimary}>
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </Tooltip>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(ROLE_META) as [AppRole, typeof ROLE_META[AppRole]][]).map(([role, meta]) => {
          const Icon = meta.icon;
          const isActive = roleFilter === role;
          return (
            <Tooltip key={role} text={isActive ? 'Click to clear filter' : `Filter by ${meta.label}`}>
              <button
                onClick={() => setRoleFilter(isActive ? null : role)}
                aria-pressed={isActive}
                className={`w-full rounded-lg border px-3 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors text-left ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                <div className={`flex items-center justify-center w-7 h-7 rounded-md ${meta.color.split(' ')[0]}`}>
                  <Icon className={`w-3.5 h-3.5 ${meta.color.split(' ')[1]}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">{meta.label}</p>
                  <p className="text-[11px] text-slate-700 leading-tight">{meta.description}</p>
                </div>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* Search & table */}
      <section className={cardBodyClass}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className={sectionTitleClass}>All Users</h2>
            <p className={sectionDescClass}>
              {users.length} user{users.length !== 1 ? 's' : ''}{roleFilter ? ` with ${ROLE_META[roleFilter].label} role` : ' total'}
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
              placeholder="Search by name, email, or role..."
              className={`${inputClass} pl-9`}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-700 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse bg-slate-100 rounded-lg" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 py-10 text-center">
            <p className="text-sm text-slate-700">
              {search ? 'No users match your search.' : 'No users found. Add one to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col" className={thClass}>Name</th>
                  <th scope="col" className={thClass}>Email</th>
                  <th scope="col" className={thClass}>Role</th>
                  <th scope="col" className={`${thClass} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const meta = ROLE_META[user.role];
                  const Icon = meta.icon;
                  const isEditing = editingId === user.id;
                  const isSelf = !!(currentUserEmail && user.email && user.email.toLowerCase() === currentUserEmail);
                  const masterAdminCount = users.filter((u) => u.role === 'master_admin').length;
                  const isLastMaster = user.role === 'master_admin' && masterAdminCount <= 1;
                  const cannotRemove = isSelf || isLastMaster;

                  return (
                    <tr key={`${user.source}-${user.id}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className={`${tdClass} text-slate-900 font-medium`}>
                        {user.name}
                        {isSelf && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 text-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            You
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-slate-600`}>{user.email || '—'}</td>
                      <td className={tdClass}>
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as AppRole)}
                            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500"
                          >
                            {getAllowedRoleOptions(currentUserRole).map((roleValue) => (
                              <option key={roleValue} value={roleValue}>
                                {ROLE_META[roleValue].label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Tooltip text={meta.description}>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                              <Icon className="w-3 h-3" />
                              {meta.label}
                            </span>
                          </Tooltip>
                        )}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        {isEditing ? (
                          <div className="inline-flex items-center gap-2">
                            <Tooltip text="Save role change">
                              <button
                                onClick={() => saveEdit(user)}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 px-3 py-1.5 text-xs font-medium transition-colors"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                            </Tooltip>
                            <Tooltip text="Cancel">
                              <button
                                onClick={cancelEdit}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium transition-colors"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </Tooltip>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2">
                            <Tooltip text="Change this user's role">
                              <button
                                onClick={() => startEdit(user)}
                                aria-label={`Edit ${user.name}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 text-xs font-medium transition-colors"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>
                            </Tooltip>
                            <Tooltip text={isSelf ? "You can't remove yourself" : isLastMaster ? "Cannot remove the last Master Admin" : "Remove this user's access"}>
                              <button
                                onClick={() => !cannotRemove && setRemoveUser(user)}
                                disabled={cannotRemove}
                                aria-label={`Remove ${user.name}`}
                                className={`${btnDanger} ${cannotRemove ? 'opacity-40 cursor-not-allowed' : ''}`}
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            </Tooltip>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ================================================================= */}
      {/* Add User Modal                                                     */}
      {/* ================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={closeAddModal}>
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <h3 className="text-base font-semibold text-slate-900">Add User</h3>
              <button onClick={closeAddModal} className="text-slate-700 hover:text-slate-600 transition-colors" aria-label="Close modal">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label htmlFor="scheduler-add-user-email" className={labelClass}>Email</label>
                <Tooltip text="The email address used to sign in" position="bottom">
                  <input
                    id="scheduler-add-user-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className={inputClass}
                    placeholder="user@example.com"
                  />
                </Tooltip>
              </div>
              <div>
                <label htmlFor="scheduler-add-user-name" className={labelClass}>Name</label>
                <Tooltip text="Display name shown in the system" position="bottom">
                  <input
                    id="scheduler-add-user-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className={inputClass}
                    placeholder="Jane Doe"
                  />
                </Tooltip>
              </div>
              <div>
                <label htmlFor="scheduler-add-user-role" className={labelClass}>Role</label>
                <Tooltip text="Determines what level of access this user has" position="bottom">
                  <select
                    id="scheduler-add-user-role"
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
                    className={inputClass}
                  >
                    {getAllowedRoleOptions(currentUserRole).map((roleValue) => (
                      <option key={roleValue} value={roleValue}>
                        {ROLE_META[roleValue].label} — {ROLE_META[roleValue].description}
                      </option>
                    ))}
                  </select>
                </Tooltip>
              </div>

              {formError && (
                <p role="alert" className="text-xs text-red-700 font-medium">{formError}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button onClick={closeAddModal} className={btnSecondary}>
                Cancel
              </button>
              <button onClick={handleAddUser} disabled={saving} className={btnPrimary}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* Remove Confirmation Modal                                          */}
      {/* ================================================================= */}
      {removeUser && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => !removing && setRemoveUser(null)}>
          <div
            className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-0">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100">
                  <AlertTriangle className="w-5 h-5 text-red-700" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">Remove User</h3>
              </div>
              {!removing && (
                <button onClick={() => setRemoveUser(null)} className="text-slate-700 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to remove <strong>{removeUser.name}</strong> ({removeUser.email})?
                They will lose all access to the scheduler.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 px-5 pb-5">
              <button
                onClick={() => setRemoveUser(null)}
                disabled={removing}
                className={`${btnSecondary} disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 text-white px-4 py-2 text-[13px] font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {removing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {removing ? 'Removing...' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
