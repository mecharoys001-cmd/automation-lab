'use client';

import { X, Mail, Phone, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Pill } from '../ui/Pill';
import { Tooltip } from '../ui/Tooltip';
import { ClickToCopy } from '../ui/ClickToCopy';
import { getStatusConfig } from '../../lib/statusConfig';

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

export interface AssignedSession {
  id: string;
  name: string;
  day: string;
  time: string;
  status: string;
}

export interface InstructorDetailData {
  id?: string;
  name: string;
  isActive: boolean;
  onCall?: boolean;
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
  onToggleStatus?: () => void;
  onToggleOnCall?: () => void;
  togglingStatus?: boolean;
  togglingOnCall?: boolean;
  onSubjectClick?: (subject: string) => void;
}

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
  onToggleStatus,
  onToggleOnCall,
  togglingStatus = false,
  togglingOnCall = false,
  onSubjectClick,
}: InstructorDetailModalProps) {
  if (!open) return null;

  const byDay = groupByDay(data.availability);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center py-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-[70] w-[700px] max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-xl">
        {/* ── Header ───────────────────────────────────────── */}
        <div className="flex items-center h-14 px-6 gap-2.5">
          <h2 className="text-[22px] font-bold text-slate-900">{data.name}</h2>
          <Tooltip text={data.isActive ? 'Active staff member' : 'Inactive staff member'}>
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                data.isActive ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
          </Tooltip>
          {data.onCall && (
            <Badge variant="status" color="green" tooltip="Available for last-minute substitutions">
              On-Call
            </Badge>
          )}
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

        {/* ── Contact Info (click-to-copy) ─────────────────── */}
        <div className="flex items-center px-6 py-3 gap-6">
          {data.email && (
            <ClickToCopy
              text={data.email}
              label="email"
              icon={Mail}
              textClassName="text-[13px] text-blue-500"
              buttonClassName="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            />
          )}
          {data.phone && (
            <ClickToCopy
              text={data.phone}
              label="phone"
              icon={Phone}
              textClassName="text-[13px] text-slate-500"
              buttonClassName="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            />
          )}
        </div>

        <div className="h-px bg-slate-200" />

        {/* ── Subjects ───────────────────────────────────────── */}
        <div className="flex items-center flex-wrap gap-2 px-6 py-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Subjects</span>
          {data.skills.length > 0 ? (
            data.skills.map((skill) => (
              <Pill
                key={skill.name}
                variant="skill"
                bgColor={skill.bgColor ?? 'bg-blue-100'}
                textColor={skill.textColor ?? 'text-blue-500'}
                tooltip={onSubjectClick ? `Click to view calendar filtered by ${skill.name}` : `Subject: ${skill.name}`}
                onClick={onSubjectClick ? () => onSubjectClick(skill.name) : undefined}
              >
                {skill.emoji ? `${skill.emoji} ` : ''}{skill.name}
              </Pill>
            ))
          ) : (
            <span className="text-sm text-slate-400">No subjects listed</span>
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
              const sc = getStatusConfig(session.status);
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
          {onViewCalendar && (
            <Tooltip text="Jump to calendar filtered to this instructor">
              <button
                onClick={onViewCalendar}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-blue-500 hover:text-blue-600 transition-colors"
              >
                View on Calendar
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
          <div className="flex items-center gap-3 ml-auto">
            {onToggleOnCall && (
              <Tooltip text={data.onCall ? 'Remove from on-call list' : 'Mark as available for substitutions'}>
                <button
                  onClick={onToggleOnCall}
                  disabled={togglingOnCall}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors disabled:opacity-50 ${
                    data.onCall
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {togglingOnCall ? 'Updating\u2026' : data.onCall ? 'On-Call \u2713' : 'Set On-Call'}
                </button>
              </Tooltip>
            )}
            {onToggleStatus && (
              <Tooltip text={data.isActive ? 'Make this staff member inactive' : 'Activate this staff member'}>
                <button
                  onClick={onToggleStatus}
                  disabled={togglingStatus}
                  className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors disabled:opacity-50 ${
                    data.isActive
                      ? 'border-red-300 text-red-500 hover:bg-red-50'
                      : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                  }`}
                >
                  {togglingStatus ? 'Updating\u2026' : data.isActive ? 'Make Inactive' : 'Activate'}
                </button>
              </Tooltip>
            )}
            {onEdit && (
              <Button variant="secondary" tooltip="Edit staff member profile" onClick={onEdit}>Edit</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
