'use client';

import { X, Mail, Phone, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Pill } from '../ui/Pill';
import { Tooltip } from '../ui/Tooltip';

/* ── Types ──────────────────────────────────────────────────── */

export interface InstructorSkill {
  name: string;
  emoji?: string;
  bgColor?: string;
  textColor?: string;
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface AvailabilitySlot {
  day: DayOfWeek;
  start: string;
  end: string;
}

export type SessionStatus = 'active' | 'pending' | 'cancelled';

export interface AssignedSession {
  id: string;
  name: string;
  day: string;
  time: string;
  status: SessionStatus;
}

export interface InstructorDetailData {
  name: string;
  isActive: boolean;
  email?: string;
  phone?: string;
  skills: InstructorSkill[];
  availability: AvailabilitySlot[];
  sessions: AssignedSession[];
  totalActiveSessions: number;
}

export interface InstructorDetailModalProps {
  open: boolean;
  onClose: () => void;
  data: InstructorDetailData;
  onEdit?: () => void;
  onViewCalendar?: () => void;
}

/* ── Session status mapping ─────────────────────────────────── */

const sessionStatusConfig: Record<SessionStatus, { color: 'green' | 'amber' | 'red'; label: string }> = {
  active:    { color: 'green', label: 'Active' },
  pending:   { color: 'amber', label: 'Pending' },
  cancelled: { color: 'red',   label: 'Cancelled' },
};

/* ── Availability helpers ───────────────────────────────────── */

const ALL_DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function groupByDay(slots: AvailabilitySlot[]): Record<DayOfWeek, string[]> {
  const grouped: Record<DayOfWeek, string[]> = {
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
  };
  for (const s of slots) {
    grouped[s.day].push(`${s.start} – ${s.end}`);
  }
  return grouped;
}

/* ── Component ──────────────────────────────────────────────── */

export function InstructorDetailModal({
  open,
  onClose,
  data,
  onEdit,
  onViewCalendar,
}: InstructorDetailModalProps) {
  if (!open) return null;

  const byDay = groupByDay(data.availability);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-50 w-[700px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl">
        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center h-14 px-6 gap-2.5">
          <h2 className="text-[22px] font-bold text-slate-900">{data.name}</h2>
          <Tooltip text={data.isActive ? 'Active instructor' : 'Inactive instructor'}>
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                data.isActive ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
          </Tooltip>
          <div className="flex-1" />
          <Tooltip text="Close details">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </Tooltip>
        </div>

        <div className="h-px bg-slate-200" />

        {/* ── Contact Info ─────────────────────────────────── */}
        <div className="flex items-center px-6 py-3 gap-6">
          {data.email && (
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <Tooltip text="Send email">
                <a
                  href={`mailto:${data.email}`}
                  className="text-[13px] text-blue-500 hover:text-blue-600 transition-colors"
                >
                  {data.email}
                </a>
              </Tooltip>
            </div>
          )}
          {data.phone && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              <Tooltip text="Call phone number">
                <a
                  href={`tel:${data.phone}`}
                  className="text-[13px] text-slate-500 hover:text-slate-600 transition-colors"
                >
                  {data.phone}
                </a>
              </Tooltip>
            </div>
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* ── Skills ───────────────────────────────────────── */}
        <div className="flex items-center flex-wrap gap-2 px-6 py-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Skills</span>
          {data.skills.length > 0 ? (
            data.skills.map((skill) => (
              <Pill
                key={skill.name}
                variant="skill"
                bgColor={skill.bgColor ?? 'bg-blue-100'}
                textColor={skill.textColor ?? 'text-blue-500'}
                tooltip={`Skill: ${skill.name}`}
              >
                {skill.emoji ? `${skill.emoji} ` : ''}{skill.name}
              </Pill>
            ))
          ) : (
            <span className="text-sm text-slate-400">No skills listed</span>
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* ── Availability ─────────────────────────────────── */}
        <div className="px-6 py-3 space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">Availability</h3>
          <div className="space-y-0.5">
            {ALL_DAYS.map((day) => {
              const slots = byDay[day];
              return (
                <div key={day} className="flex items-center gap-3 py-1">
                  <span className="w-10 text-xs font-medium text-slate-500">{day}</span>
                  {slots.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map((slot, i) => (
                        <span
                          key={i}
                          className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        {/* ── Assigned Sessions ────────────────────────────── */}
        <div className="px-6 py-3 space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-900">
            {data.totalActiveSessions} Active Sessions
          </h3>
          {data.sessions.length > 0 ? (
            data.sessions.map((session) => {
              const sc = sessionStatusConfig[session.status];
              return (
                <div
                  key={session.id}
                  className="flex items-center bg-slate-100 rounded-lg h-9 px-3 gap-2"
                >
                  <span className="text-xs font-medium text-slate-900 truncate">
                    {session.name}
                  </span>
                  <span className="text-[11px] text-slate-400 ml-auto whitespace-nowrap">
                    {session.day} {session.time}
                  </span>
                  <Badge
                    variant="status"
                    color={sc.color}
                    tooltip={`Session status: ${sc.label}`}
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  >
                    {sc.label}
                  </Badge>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-400">No sessions assigned yet.</p>
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center justify-between h-14 px-6">
          <Tooltip text="Jump to calendar filtered to this instructor">
            <button
              onClick={onViewCalendar}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
            >
              View on Calendar
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Button variant="secondary" tooltip="Edit instructor profile" onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}
