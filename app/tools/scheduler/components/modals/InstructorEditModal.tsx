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
  public_notes: string;
  admin_notes: string;
  bio: string;
  start_year: string;
  is_active: boolean;
  on_call: boolean;
  skills: string[];
  additional_tags: string[];
  availability_json: AvailabilityJson | null;
}

export const EMPTY_INSTRUCTOR_FORM: InstructorFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  public_notes: '',
  admin_notes: '',
  bio: '',
  start_year: '',
  is_active: true,
  on_call: false,
  skills: [],
  additional_tags: [],
  availability_json: null,
};

export interface InstructorEditModalProps {
  instructor: Instructor | null;
  saving: boolean;
  deleting: boolean;
  onSave: (data: InstructorFormData) => void;
  onDelete: (() => void) | null;
  onClose: () => void;
  existingInstructors?: { id: string; first_name: string; last_name: string }[];
}

/* ── Helpers ───────────────────────────────────────────────── */

const isValidEmail = (v: string): boolean => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v.trim());
const isValidPhone = (v: string): boolean => {
  const trimmed = v.trim();
  if (!/^[0-9\s\-()+.]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

/* ── Component ─────────────────────────────────────────────── */

export function InstructorEditModal({
  instructor,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
  existingInstructors = [],
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
          public_notes: instructor.public_notes ?? '',
          admin_notes: instructor.admin_notes ?? '',
          bio: instructor.bio ?? '',
          start_year: instructor.start_year != null ? String(instructor.start_year) : '',
          is_active: instructor.is_active,
          on_call: instructor.on_call,
          skills: instructor.skills ?? [],
          additional_tags: (instructor as unknown as Record<string, unknown>).additional_tags as string[] ?? [],
          availability_json: instructor.availability_json ?? null,
        }
      : { ...EMPTY_INSTRUCTOR_FORM },
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [startYearError, setStartYearError] = useState('');

  // Duplicate name warning (non-blocking) — checks on both add and edit
  const duplicateName = form.first_name.trim() && form.last_name.trim()
    ? existingInstructors.some(
        (i) =>
          i.first_name.toLowerCase() === form.first_name.trim().toLowerCase() &&
          i.last_name.toLowerCase() === form.last_name.trim().toLowerCase() &&
          // When editing, exclude the current instructor from the check
          (!instructor || i.id !== instructor.id)
      )
    : false;

  function setField<K extends keyof InstructorFormData>(key: K, value: InstructorFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'email') setEmailError('');
    if (key === 'phone') setPhoneError('');
    if (key === 'start_year') setStartYearError('');
  }

  const staffTypeTags = form.additional_tags.filter((tag) => tag !== '' && tag != null);

  function setStaffTypeTags(tags: string[]) {
    setForm((prev) => {
      const otherTags = prev.additional_tags.filter((tag) => !staffTypeTags.includes(tag));
      return { ...prev, additional_tags: [...tags, ...otherTags] };
    });
  }

  const validateAndSave = () => {
    if (form.email.trim() && !isValidEmail(form.email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (form.phone.trim() && !isValidPhone(form.phone)) {
      setPhoneError('Enter a valid phone number (7–15 digits, may include spaces, dashes, parentheses, dots, and +)');
      return;
    }
    // start_year validation is handled by the dropdown (only valid years or empty)
    onSave(form);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndSave();
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
                <span className="text-xs text-red-700">Are you sure?</span>
                <Tooltip text="Confirm deletion — this cannot be undone">
                  <button
                    onClick={onDelete}
                    disabled={deleting}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
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
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip text="Delete this staff member permanently">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-700 border border-red-200 hover:bg-red-50 transition-colors"
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
            onClick={validateAndSave}
            disabled={saving || !form.first_name.trim() || !form.last_name.trim() || !!emailError || !!phoneError || !!startYearError}
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
          <label htmlFor="instructor-first-name" className="block text-sm font-semibold text-slate-600 mb-1.5">First Name<span className="text-red-700 ml-0.5">*</span></label>
          <Tooltip text="Staff member's first name" className="w-full">
            <input
              id="instructor-first-name"
              type="text"
              required
              aria-required="true"
              value={form.first_name}
              onChange={(e) => setField('first_name', e.target.value)}
              maxLength={100}
              placeholder="e.g. Sarah"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
          </Tooltip>
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="instructor-last-name" className="block text-sm font-semibold text-slate-600 mb-1.5">Last Name<span className="text-red-700 ml-0.5">*</span></label>
          <Tooltip text="Staff member's last name" className="w-full">
            <input
              id="instructor-last-name"
              type="text"
              required
              aria-required="true"
              value={form.last_name}
              onChange={(e) => setField('last_name', e.target.value)}
              maxLength={100}
              placeholder="e.g. Johnson"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 transition-colors"
            />
          </Tooltip>
        </div>

        {/* Duplicate name warning */}
        {duplicateName && (
          <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>A staff member with this name already exists. You can still save if this is intentional.</span>
          </div>
        )}

        {/* Email */}
        <div>
          <label htmlFor="instructor-email" className="block text-sm font-semibold text-slate-600 mb-1.5">Email</label>
          <Tooltip text="Contact email for this staff member" className="w-full">
            <input
              id="instructor-email"
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              onBlur={() => {
                if (form.email.trim() && !isValidEmail(form.email)) {
                  setEmailError('Please enter a valid email address');
                }
              }}
              maxLength={255}
              placeholder="sarah@example.com"
              className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-700 outline-none focus-visible:ring-1 transition-colors ${emailError ? 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500' : 'border-slate-200 focus-visible:border-blue-500 focus-visible:ring-blue-500'}`}
            />
          </Tooltip>
          {emailError && <p role="alert" className="text-xs text-red-700 mt-1">{emailError}</p>}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="instructor-phone" className="block text-sm font-semibold text-slate-600 mb-1.5">Phone</label>
          <Tooltip text="Contact phone number" className="w-full">
            <input
              id="instructor-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => {
                const filtered = e.target.value.replace(/[^0-9\s\-()+.]/g, '');
                setField('phone', filtered);
              }}
              onBlur={() => {
                if (form.phone.trim() && !isValidPhone(form.phone)) {
                  setPhoneError('Enter a valid phone number (7–15 digits, may include spaces, dashes, parentheses, dots, and +)');
                }
              }}
              maxLength={30}
              placeholder="(555) 123-4567"
              className={`w-full border rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-700 outline-none focus-visible:ring-1 transition-colors ${phoneError ? 'border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500' : 'border-slate-200 focus-visible:border-blue-500 focus-visible:ring-blue-500'}`}
            />
          </Tooltip>
          {phoneError && <p role="alert" className="text-xs text-red-700 mt-1">{phoneError}</p>}
        </div>

        {/* Start Year */}
        <div>
          <label htmlFor="instructor-start-year" className="block text-sm font-semibold text-slate-600 mb-1.5">Start Year</label>
          <Tooltip text="The year this staff member started working in this field" className="w-full">
            <select
              id="instructor-start-year"
              value={form.start_year}
              onChange={(e) => {
                setField('start_year', e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-1 transition-colors border-slate-200 focus-visible:border-blue-500 focus-visible:ring-blue-500"
            >
              <option value="">Select year (optional)</option>
              {Array.from({ length: new Date().getFullYear() - 1970 + 1 }, (_, i) => new Date().getFullYear() - i).map((yr) => (
                <option key={yr} value={String(yr)}>{yr}</option>
              ))}
            </select>
          </Tooltip>
        </div>

        {/* Staff Type */}
        <div>
          <label htmlFor="instructor-staff-type" className="block text-xs font-semibold text-slate-600 mb-2">Staff Type</label>
          <Tooltip text="Select the staff type tags for this staff member">
            <TagSelector
              id="instructor-staff-type"
              value={staffTypeTags}
              onChange={setStaffTypeTags}
              programId={selectedProgramId ?? ''}
              category="Staff Type"
              placeholder="Select staff type..."
            />
          </Tooltip>
        </div>

        {/* Event Type */}
        <div>
          <label htmlFor="instructor-event-type" className="block text-xs font-semibold text-slate-600 mb-2">Event Type</label>
          <Tooltip text="Select the event types this staff member teaches">
            <TagSelector
              id="instructor-event-type"
              value={form.skills}
              onChange={(skills) => setForm(prev => ({ ...prev, skills }))}
              programId={selectedProgramId ?? ''}
              category="Event Type"
              placeholder="Select staff event types..."
            />
          </Tooltip>
        </div>

        {/* Additional Tags */}
        <div>
          <label htmlFor="instructor-additional-tags" className="block text-xs font-semibold text-slate-600 mb-2">Additional Tags</label>
          <TagSelector
            id="instructor-additional-tags"
            value={form.additional_tags}
            onChange={(tags) => setField('additional_tags', tags)}
            programId={selectedProgramId ?? ''}
            excludeCategories={['Space Types', 'Staff Type']}
            placeholder="Select optional tags..."
          />
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="instructor-bio" className="block text-sm font-semibold text-slate-600 mb-1.5">Bio</label>
          <Tooltip text="Public bio — background, interests, teaching style" className="w-full">
            <textarea
              id="instructor-bio"
              value={form.bio}
              onChange={(e) => setField('bio', e.target.value)}
              maxLength={1000}
              placeholder="A short bio about this staff member…"
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 resize-none transition-colors"
            />
          </Tooltip>
        </div>

        {/* Public Notes */}
        <div>
          <label htmlFor="instructor-public-notes" className="block text-sm font-semibold text-slate-600 mb-1.5">Public Notes</label>
          <Tooltip text="Visible to staff in the portal" className="w-full">
            <textarea
              id="instructor-public-notes"
              value={form.public_notes}
              onChange={(e) => setField('public_notes', e.target.value)}
              maxLength={500}
              placeholder="Notes visible to this staff member…"
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 resize-none transition-colors"
            />
          </Tooltip>
          <p className="text-[11px] text-slate-500 mt-1">Use [text](url) to add links</p>
        </div>

        {/* Admin Notes */}
        <div>
          <label htmlFor="instructor-admin-notes" className="block text-sm font-semibold text-slate-600 mb-1.5">Admin Notes</label>
          <Tooltip text="Only visible to admins" className="w-full">
            <textarea
              id="instructor-admin-notes"
              value={form.admin_notes}
              onChange={(e) => setField('admin_notes', e.target.value)}
              maxLength={500}
              placeholder="Internal admin-only notes…"
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500 resize-none transition-colors"
            />
          </Tooltip>
          <p className="text-[11px] text-slate-500 mt-1">Use [text](url) to add links</p>
        </div>

        {/* Availability */}
        <div>
          <label htmlFor="instructor-availability" className="block text-xs font-semibold text-slate-600 mb-2">Availability</label>
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
            id="instructor-availability"
            value={form.availability_json}
            onChange={(v) => setField('availability_json', v)}
          />
        </div>

        {/* Active Toggle — only shown when editing, not creating */}
        {!isNew && (
        <div>
          <label htmlFor="instructor-status" className="block text-sm font-semibold text-slate-600 mb-1.5">Status</label>
          <Tooltip text={form.is_active ? 'Staff member is active and can be scheduled' : 'Staff member is inactive and will not appear in scheduling'}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="instructor-status"
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setField('is_active', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500 cursor-pointer accent-blue-500"
              />
              <span className="text-sm text-slate-700">
                {form.is_active ? 'Active' : 'Inactive'}
              </span>
            </label>
          </Tooltip>
        </div>
        )}

        {/* On Call Toggle */}
        <div>
          <label htmlFor="instructor-on-call" className="block text-sm font-semibold text-slate-600 mb-1.5">On Call</label>
          <Tooltip text={form.on_call ? 'Available for last-minute substitutions' : 'Mark as available for substitutions'}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="instructor-on-call"
                type="checkbox"
                checked={form.on_call}
                onChange={(e) => setField('on_call', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus-visible:ring-emerald-500 cursor-pointer accent-emerald-500"
              />
              <span className="text-sm text-slate-700">
                {form.on_call ? 'On Call' : 'Not On Call'}
              </span>
            </label>
          </Tooltip>
        </div>
      </form>
    </Modal>
  );
}
