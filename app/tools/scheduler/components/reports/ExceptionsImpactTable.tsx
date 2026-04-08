'use client';

import { useEffect, useState } from 'react';
import {
  CalendarOff,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';
import type { StaffTimeOffRequest, TimeOffImpactWarning } from '@/types/staff-time-off';
import { calculateTimeOffImpact, type ScheduledSession, type StaffInfo } from '@/lib/scheduler/time-off-impact';

// ── Constants ─────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  low: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Low' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', label: 'Medium' },
  high: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'High' },
};

// ── Component ─────────────────────────────────────────────────────────────

interface ExceptionsImpactTableProps {
  programId: string;
}

export function ExceptionsImpactTable({ programId }: ExceptionsImpactTableProps) {
  const [warnings, setWarnings] = useState<TimeOffImpactWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        // Fetch approved time off requests and draft sessions in parallel
        const [timeOffRes, sessRes, staffRes] = await Promise.all([
          fetch(`/api/staff-time-off/review?program_id=${programId}`),
          fetch(`/api/sessions?program_id=${programId}&status=draft`),
          fetch('/api/staff?is_active=true'),
        ]);

        if (!timeOffRes.ok || !sessRes.ok || !staffRes.ok) {
          throw new Error('Failed to fetch impact data');
        }

        const [timeOffData, sessData, staffData] = await Promise.all([
          timeOffRes.json(),
          sessRes.json(),
          staffRes.json(),
        ]);

        if (cancelled) return;

        const requests: StaffTimeOffRequest[] = timeOffData.requests ?? [];
        const rawSessions = sessData.sessions ?? [];
        const rawStaff = staffData.instructors ?? [];

        // Map sessions to ScheduledSession format
        const sessions: ScheduledSession[] = rawSessions
          .filter((s: Record<string, unknown>) => s.staff_id)
          .map((s: Record<string, unknown>) => ({
            date: s.date as string,
            start_time: (s.start_time as string)?.substring(0, 5) ?? '',
            end_time: (s.end_time as string)?.substring(0, 5) ?? '',
            template_id: (s.template_id as string) ?? '',
            template_name: (s.name as string) ?? 'Unknown',
            staff_id: s.staff_id as string,
          }));

        const staffList: StaffInfo[] = rawStaff.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        }));

        const impact = calculateTimeOffImpact(requests, sessions, staffList);
        setWarnings(impact);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load time off data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [programId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[12px] text-slate-500">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Checking time off impact...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-[12px] text-red-600 py-2">{error}</div>
    );
  }

  if (warnings.length === 0) return null;

  return (
    <div className="bg-violet-50/50 border border-violet-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-violet-100/50 border-b border-violet-200">
        <CalendarOff className="w-3.5 h-3.5 text-violet-700" />
        <Tooltip text="Staff with approved time off that overlaps scheduled sessions">
          <span className="text-[12px] font-semibold text-violet-800">
            Exceptions Impact ({warnings.length})
          </span>
        </Tooltip>
      </div>

      <div className="divide-y divide-violet-100 max-h-[240px] overflow-y-auto">
        {warnings.map((w, i) => {
          const sev = SEVERITY_STYLES[w.severity] ?? SEVERITY_STYLES.low;
          const pctStr = `${Math.round(w.missedPercentage * 100)}%`;
          const dateLabel = w.timeOffStart === w.timeOffEnd
            ? w.timeOffStart
            : `${w.timeOffStart} \u2013 ${w.timeOffEnd}`;

          return (
            <div key={`${w.timeOffId}-${w.templateId}-${i}`} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Tooltip text="Affected staff member">
                    <span className="text-[12px] font-medium text-slate-800">{w.staffName}</span>
                  </Tooltip>
                  <Tooltip text="Affected event template">
                    <span className="text-[11px] text-slate-500 truncate">{w.templateName}</span>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500">
                  <Tooltip text="Approved time off dates">
                    <span className="tabular-nums">{dateLabel}</span>
                  </Tooltip>
                  <Tooltip text="Sessions missed out of total for this template">
                    <span className="tabular-nums">
                      {w.missedSessions}/{w.totalSessions} sessions missed
                    </span>
                  </Tooltip>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Tooltip text={`${pctStr} of sessions will be missed`}>
                  <span className="text-[12px] font-semibold tabular-nums text-slate-700">{pctStr}</span>
                </Tooltip>
                <Tooltip text={`Severity: ${sev.label}`}>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sev.bg} ${sev.text} ${sev.border}`}>
                    {w.severity === 'high' && <AlertTriangle className="w-2.5 h-2.5" />}
                    {sev.label}
                  </span>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
