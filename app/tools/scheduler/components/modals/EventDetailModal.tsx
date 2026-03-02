'use client';

import { Calendar, X, Pencil, MapPin, Clock, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Pill } from '../ui/Pill';
import { Avatar } from '../ui/Avatar';
import { Tooltip } from '../ui/Tooltip';

/* ── Types ──────────────────────────────────────────────────── */

export type EventStatus = 'published' | 'draft' | 'conflict';

export interface GradeGroup {
  name: string;
  bgColor?: string;
  textColor?: string;
}

export interface EventTag {
  label: string;
  bgColor?: string;
  textColor?: string;
}

export interface EventInstructor {
  name: string;
  initials: string;
  role?: string;
  avatarColor?: string;
}

export interface EventDetailData {
  title: string;
  status: EventStatus;
  date: string;
  timeRange: string;
  venue: string;
  instructor: EventInstructor;
  gradeGroups: GradeGroup[];
  tags: EventTag[];
  notes?: string;
}

export interface EventDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: EventDetailData;
  onCancel?: () => void;
  onEdit?: () => void;
  onViewProfile?: () => void;
  onAddTag?: () => void;
}

/* ── Status mapping ─────────────────────────────────────────── */

const statusConfig: Record<EventStatus, { color: 'blue' | 'green' | 'amber' | 'red' | 'slate'; label: string }> = {
  published: { color: 'green', label: 'Published' },
  draft:     { color: 'slate', label: 'Draft' },
  conflict:  { color: 'red',   label: 'Conflict' },
};

/* ── Component ──────────────────────────────────────────────── */

export function EventDetailModal({
  open,
  onClose,
  data,
  onCancel,
  onEdit,
  onViewProfile,
  onAddTag,
}: EventDetailModalProps) {
  if (!open) return null;

  const status = statusConfig[data.status];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-50 w-[600px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-[0_8px_32px_#00000033]">
        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-200">
          <Tooltip text="Session type">
            <Calendar className="w-[22px] h-[22px] text-blue-500 flex-shrink-0" />
          </Tooltip>
          <h2 className="text-lg font-semibold text-slate-900 truncate">{data.title}</h2>
          <div className="flex-1" />
          <Badge variant="status" color={status.color} dot tooltip={`Status: ${status.label}`}>
            {status.label}
          </Badge>
          <Tooltip text="Close modal">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </Tooltip>
        </div>

        {/* ── Time & Date ──────────────────────────────────── */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-900">{data.date}</span>
          </div>
          <span className="text-sm text-slate-500 ml-6">{data.timeRange}</span>
        </div>

        {/* ── Venue ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-900">{data.venue}</span>
        </div>

        {/* ── Instructor ───────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <Avatar
            initials={data.instructor.initials}
            size="lg"
            bgColor={data.instructor.avatarColor ?? 'bg-indigo-500'}
            tooltip={data.instructor.name}
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-slate-900">{data.instructor.name}</span>
            {data.instructor.role && (
              <span className="text-xs text-slate-500">{data.instructor.role}</span>
            )}
          </div>
          <div className="flex-1" />
          <Tooltip text="View instructor profile">
            <button
              onClick={onViewProfile}
              className="text-[13px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
            >
              View Profile
            </button>
          </Tooltip>
        </div>

        {/* ── Grade Groups ─────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-200 space-y-2.5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-[0.5px]">
            Grade Groups
          </span>
          <div className="flex flex-wrap gap-2">
            {data.gradeGroups.map((g) => (
              <Pill
                key={g.name}
                variant="grade"
                bgColor={g.bgColor ?? 'bg-blue-100'}
                textColor={g.textColor ?? 'text-blue-700'}
                tooltip={g.name}
              >
                {g.name}
              </Pill>
            ))}
          </div>
        </div>

        {/* ── Tags ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-slate-200 space-y-2.5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-[0.5px]">
            Tags
          </span>
          <div className="flex flex-wrap gap-2">
            {data.tags.map((t) => (
              <Pill
                key={t.label}
                variant="tag"
                bgColor={t.bgColor ?? 'bg-amber-100'}
                textColor={t.textColor ?? 'text-amber-800'}
                tooltip={t.label}
              >
                {t.label}
              </Pill>
            ))}
            <Tooltip text="Add a tag">
              <button
                onClick={onAddTag}
                className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-slate-400 hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Tag
              </button>
            </Tooltip>
          </div>
        </div>

        {/* ── Notes ────────────────────────────────────────── */}
        <div className="px-6 py-4 space-y-2.5">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-[0.5px]">
            Notes
          </span>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-3">
            <p className="text-[13px] text-slate-500 leading-relaxed whitespace-pre-wrap">
              {data.notes || 'No notes added.'}
            </p>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button
            variant="danger"
            size="md"
            tooltip="Cancel this session"
            onClick={onCancel}
            className="px-5 py-2.5 text-[13px]"
          >
            Cancel Session
          </Button>
          <Button
            variant="primary"
            size="md"
            tooltip="Edit session details"
            onClick={onEdit}
            icon={<Pencil className="w-3.5 h-3.5" />}
            className="px-6 py-2.5 text-[13px]"
          >
            Edit Session
          </Button>
        </div>
      </div>
    </div>
  );
}
