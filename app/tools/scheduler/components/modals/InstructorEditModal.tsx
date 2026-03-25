'use client';

import { useState } from 'react';
import { Loader2, Trash2, Save, AlertTriangle } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import { TagSelector } from '../ui/TagSelector';
import { AvailabilityEditor } from '../ui/AvailabilityEditor';
import { Modal, ModalButton } from '../ui/Modal';
import { useProgram } from '../../admin/ProgramContext';
import type { Instructor, AvailabilityJson } from '@/types/database';

/* ── Types ──────────────────────────────────────────────────── */

export interface InstructorFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  is_active: boolean;
  skills: string[];
  availability_json: AvailabilityJson | null;
}

export const EMPTY_INSTRUCTOR_FORM: InstructorFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  notes: '',
  is_active: true,
  skills: [],
  availability_json: null,
};

export interface InstructorEditModalProps {
  instructor: Instructor | null;
  saving: boolean;
  deleting: boolean;
  onSave: (data: InstructorFormData) => void;
  onDelete: (() => void) | null;
  onClose: () => void;
}

/* ── Component ─────────────────────────────────────────────── */

export function InstructorEditModal({
  instructor,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: InstructorEditModalProps) {
  const { programs, selectedProgramId } = useProgram();
  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null;
  const isNew = !instructor;
  const [form, setForm] = useState<InstructorFormData>(() =>
    instructor
      ? {
          first_name: instructor.first_name,
          last_name: instructor.last_name,
          email: instructor.email ?? '',
          phone: instructor.phone ?? '',
          notes: instructor.notes ?? '',
          is_active: instructor.is_active,
          skills: instructor.skills ?? [],
          availability_json: instructor.availability_json ?? null,
        }
      : { ...EMPTY_INSTRUCTOR_FORM },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  function setField<K extends keyof InstructorFormData>(key: K, value: InstructorFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Modal
      open={instructor !== null || isNew}
      onClose={onClose}
      title={isNew ? 'Add Staff Member' : 'Edit Staff Member'}
      width="560px"
      footer={
        <>
          {onDelete && !isNew && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-500">Are you sure?</span>
                <Tooltip text="Confirm deletion — this cannot be undone">
                  <button
                    onClick={onDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Deleting…
                      </span>
                    ) : 'Yes, Delete'}
                  </button>
                </Tooltip>
                <Tooltip text="Cancel deletion">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip text="Delete this staff member permanently">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </Tooltip>
            )
          )}
          <div className="flex-1" />
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalButton
            variant="primary"
            onClick={() => onSave(form)}
            disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
            loading={saving}
            icon={!saving ? <Save className="w-3.5 h-3.5" /> : undefined}
          >
            {isNew ? 'Add Staff' : 'Save Changes'}
          </ModalButton>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
        {/* First Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">First Name<span className="text-red-400 ml-0.5">*</span></label>
          <Tooltip text="Staff member's first name" className="w-full">
            <input
              type="text"
              required
              value={form.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              placeholder="e.g. Sarah"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
          </Tooltip>
        </div>

        {/* Last Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Last Name<span className="text-red-400 ml-0.5">*</span></label>
          <Tooltip text="Staff member's last name" className="w-full">
            <input
              type="text"
              required
              value={form.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              placeholder="e.g. Johnson"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
          </Tooltip>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
          <Tooltip text="Contact email for this staff member" className="w-full">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="sarah@example.com"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
          </Tooltip>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
          <Tooltip text="Contact phone number" className="w-full">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
          </Tooltip>
        </div>

        {/* Event Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">Event Type</label>
          <Tooltip text="Select the event types this staff member teaches">
            <TagSelector
              value={form.skills}
              onChange={(skills) => setForm(prev => ({ ...prev, skills }))}
              programId={selectedProgramId ?? ''}
              category="Event Type"
              placeholder="Select staff event types..."
            />
          </Tooltip>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</label>
          <Tooltip text="Internal notes about this staff member" className="w-full">
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              placeholder="Add notes about this staff member…"
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 resize-none transition-colors"
            />
          </Tooltip>
        </div>

        {/* Availability */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">Availability</label>
          {selectedProgram && (
            <Tooltip text="This availability extends outside your program dates">
              <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Program runs {new Date(selectedProgram.start_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to {new Date(selectedProgram.end_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </Tooltip>
          )}
          <AvailabilityEditor
            value={form.availability_json}
            onChange={(v) => setField('availability_json', v)}
          />
        </div>

        {/* Active Toggle — only shown when editing, not creating */}
        {!isNew && (
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
          <Tooltip text={form.is_active ? 'Staff member is active and can be scheduled' : 'Staff member is inactive and will not appear in scheduling'}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500 cursor-pointer accent-blue-500"
              />
              <span className="text-sm text-slate-700">
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
            </label>
          </Tooltip>
        </div>
        )}
      </form>
    </Modal>
  );
}
