'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Loader2, Check, AlertTriangle, GraduationCap } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';


// ── Toast Notification ───────────────────────────────────────

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

interface Class {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes?: number | null;
  default_instructor_id?: string | null;
  color?: string | null;
  created_at: string;
}

interface Person {
  id: string;
  name: string;
  role: string;
}

const PRESET_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Indigo', value: '#6366F1' },
];

export default function ClassesPage() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [instructors, setInstructors] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formInstructor, setFormInstructor] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0].value);
  const [saving, setSaving] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<ToastState | null>(null);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch event templates: ${res.status}`);
      const { classes: data } = (await res.json()) as { classes: Class[] };
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event templates');
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInstructors = useCallback(async () => {
    try {
      const res = await fetch('/api/people?_t=${Date.now()}', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch instructors: ${res.status}`);
      const { people } = (await res.json()) as { people: Person[] };
      setInstructors(people.filter((p) => p.role === 'instructor'));
    } catch (err) {
      console.error('Failed to load instructors:', err);
      setInstructors([]);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
    fetchInstructors();
  }, [fetchClasses, fetchInstructors]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormDuration('');
    setFormInstructor('');
    setFormColor(PRESET_COLORS[0].value);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        duration_minutes: formDuration ? parseInt(formDuration, 10) : null,
        default_instructor_id: formInstructor || null,
        color: formColor,
      };

      const url = editingId ? `/api/classes/${editingId}` : '/api/classes';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save event template');
        setToast({ message: data.error || 'Failed to save event template', type: 'error', id: Date.now() });
        return;
      }

      setToast({
        message: editingId ? 'Event template updated successfully' : 'Event template created successfully',
        type: 'success',
        id: Date.now(),
      });
      resetForm();
      await fetchClasses();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save event template';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (classItem: Class) => {
    setEditingId(classItem.id);
    setFormName(classItem.name);
    setFormDescription(classItem.description ?? '');
    setFormDuration(classItem.duration_minutes ? String(classItem.duration_minutes) : '');
    setFormInstructor(classItem.default_instructor_id ?? '');
    setFormColor(classItem.color ?? PRESET_COLORS[0].value);
    setIsAdding(true);
    setDeleteConfirmId(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Failed to delete event template';
        setError(msg);
        setToast({ message: msg, type: 'error', id: Date.now() });
        setDeleteConfirmId(null);
        return;
      }
      setDeleteConfirmId(null);
      await fetchClasses();
      setToast({ message: 'Event template deleted successfully', type: 'success', id: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete event template';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="overflow-y-auto h-full"
      style={{ backgroundColor: '#F8FAFC', padding: 32 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Event Templates
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            Create and manage event templates for schedule building
          </p>
        </div>

        {/* Add Button */}
        {!isAdding && (
          <div>
            <Tooltip text="Create a new event template">
              <Button
                variant="primary"
                onClick={() => {
                  resetForm();
                  setIsAdding(true);
                }}
                style={{
                  height: 40,
                  borderRadius: 8,
                  padding: '0 20px',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <GraduationCap className="w-4 h-4" />
                Add Event Template
              </Button>
            </Tooltip>
          </div>
        )}

        {/* Add/Edit Form */}
        {isAdding && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              {editingId ? 'Edit Event Template' : 'New Event Template'}
            </h2>

            {/* Template Name */}
            <div>
              <Tooltip text="Enter the template name (required)">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
                  Template Name *
                </label>
              </Tooltip>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Beginner Piano, Advanced Strings"
                style={{
                  width: '100%',
                  height: 40,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  padding: '0 12px',
                  fontSize: 14,
                  color: '#0F172A',
                  outline: 'none',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <Tooltip text="Optional description of the event template">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
                  Description
                </label>
              </Tooltip>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of what this event template covers..."
                rows={3}
                style={{
                  width: '100%',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  padding: '8px 12px',
                  fontSize: 14,
                  color: '#0F172A',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Duration and Color - Side by Side */}
            <div style={{ display: 'flex', gap: 16 }}>
              {/* Duration */}
              <div style={{ flex: 1 }}>
                <Tooltip text="Default duration in minutes for this event template">
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
                    Duration (minutes)
                  </label>
                </Tooltip>
                <input
                  type="number"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="e.g. 60"
                  min="1"
                  style={{
                    width: '100%',
                    height: 40,
                    backgroundColor: '#FFFFFF',
                    borderRadius: 8,
                    border: '1px solid #E2E8F0',
                    padding: '0 12px',
                    fontSize: 14,
                    color: '#0F172A',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Color */}
              <div style={{ flex: 1 }}>
                <Tooltip text="Choose a color for this event template in the schedule">
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
                    Color
                  </label>
                </Tooltip>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((preset) => (
                    <Tooltip key={preset.value} text={preset.name}>
                      <button
                        onClick={() => setFormColor(preset.value)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          backgroundColor: preset.value,
                          border: formColor === preset.value ? '2px solid #0F172A' : '2px solid transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      />
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>

            {/* Default Instructor */}
            <div>
              <Tooltip text="Optional default instructor for this event template">
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
                  Default Instructor
                </label>
              </Tooltip>
              <select
                value={formInstructor}
                onChange={(e) => setFormInstructor(e.target.value)}
                style={{
                  width: '100%',
                  height: 40,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  padding: '0 12px',
                  fontSize: 14,
                  color: '#0F172A',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="">No default instructor</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
              <Tooltip text="Cancel and discard changes">
                <Button
                  variant="secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </Tooltip>
              <Tooltip text={editingId ? "Save changes to this event template" : "Create this event template"}>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving || !formName.trim()}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving…
                    </>
                  ) : editingId ? 'Save Changes' : 'Create Event Template'}
                </Button>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            padding: '8px 12px',
            fontSize: 13,
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {error}
            <Tooltip text="Dismiss this error">
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  fontSize: 12,
                  textDecoration: 'underline',
                  opacity: 0.7,
                }}
              >
                dismiss
              </button>
            </Tooltip>
          </div>
        )}

        {/* Event Templates List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 100,
                  borderRadius: 12,
                  backgroundColor: '#E2E8F0',
                  opacity: 0.4,
                }}
              />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <div style={{
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            padding: 48,
            textAlign: 'center',
            color: '#94A3B8',
            fontSize: 14,
          }}>
            No event templates yet. Click &quot;Add Event Template&quot; to create your first one.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {classes.map((classItem) => {
              const instructor = instructors.find((i) => i.id === classItem.default_instructor_id);
              return (
                <div
                  key={classItem.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Color Indicator */}
                  <div
                    style={{
                      width: 8,
                      height: 60,
                      borderRadius: 4,
                      backgroundColor: classItem.color ?? '#94A3B8',
                      flexShrink: 0,
                    }}
                  />

                  {/* Template Info */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
                      {classItem.name}
                    </span>
                    {classItem.description && (
                      <span style={{ fontSize: 13, color: '#64748B', lineHeight: 1.4 }}>
                        {classItem.description}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                      {classItem.duration_minutes && (
                        <span>⏱️ {classItem.duration_minutes} min</span>
                      )}
                      {instructor && (
                        <span>👤 {instructor.name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tooltip text="Edit this event template">
                      <button
                        onClick={() => handleEdit(classItem)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 8,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 6,
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <Pencil size={16} color="#94A3B8" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Delete this event template">
                      <button
                        onClick={() => setDeleteConfirmId(classItem.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 8,
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: 6,
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (() => {
        const classItem = classes.find((c) => c.id === deleteConfirmId);
        if (!classItem) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <Tooltip text="Click outside to cancel">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setDeleteConfirmId(null)}
              />
            </Tooltip>
            <div style={{
              position: 'relative',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              maxWidth: 400,
              width: '100%',
              margin: '0 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Delete Event Template
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
                Are you sure you want to delete{' '}
                <span style={{ fontWeight: 600, color: '#0F172A' }}>
                  {classItem.name}
                </span>
                ? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
                <Button
                  variant="secondary"
                  onClick={() => setDeleteConfirmId(null)}
                  tooltip="Cancel deletion"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(classItem.id)}
                  disabled={deleting}
                  tooltip="Permanently delete this event template"
                  style={{
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    borderColor: '#EF4444',
                  }}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Deleting…
                    </>
                  ) : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
