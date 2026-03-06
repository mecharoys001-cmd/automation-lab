'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Users,
  LayoutTemplate,
  Sparkles,
  X,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface TemplateStats {
  template_id: string;
  day_of_week: number;
  grade_groups: string[];
  sessions_generated: number;
  sessions_unassigned: number;
}

interface SkippedDate {
  date: string;
  template_id: string;
  reason: string;
  detail?: string;
}

interface SchedulerResult {
  success: boolean;
  sessions_created: number;
  unassigned_count: number;
  sessions_with_warnings: number;
  drafts_cleared: number;
  template_stats: TemplateStats[];
  skipped_dates: SkippedDate[];
  summary: string;
  error?: string;
}

interface SchedulerResultModalProps {
  open: boolean;
  onClose: () => void;
  result: SchedulerResult;
  /** When true, shows "Confirm" button to proceed with actual generation */
  isPreview?: boolean;
  onConfirm?: () => void;
  isConfirming?: boolean;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const REASON_LABELS: Record<string, string> = {
  no_school: 'No School',
  early_dismissal: 'Early Dismissal',
  blackout_rule: 'Blackout Rule',
  venue_unavailable: 'Venue Unavailable',
  venue_conflict: 'Venue Conflict',
  venue_at_capacity: 'Venue at Capacity',
  venue_blackout: 'Venue Blackout',
  no_instructor: 'No Instructor',
  no_qualified_instructor: 'No Qualified Instructor',
  week_cycle_skip: 'Week Cycle Skip',
};

function SkippedDatesSection({ skippedDates }: { skippedDates: SkippedDate[] }) {
  const [expanded, setExpanded] = useState(false);

  // Group skipped dates by reason
  const byReason = new Map<string, SkippedDate[]>();
  for (const sd of skippedDates) {
    const group = byReason.get(sd.reason) ?? [];
    group.push(sd);
    byReason.set(sd.reason, group);
  }

  if (skippedDates.length === 0) return null;

  return (
    <div className="border-t border-slate-100 pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left hover:bg-slate-50 rounded px-1 -mx-1 py-1 transition-colors cursor-pointer"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[12px] font-medium text-slate-700 flex-1">
          {skippedDates.length} date(s) skipped
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 max-h-[200px] overflow-y-auto">
          {Array.from(byReason.entries()).map(([reason, dates]) => (
            <div key={reason}>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                {REASON_LABELS[reason] ?? reason} ({dates.length})
              </p>
              <div className="space-y-0.5 ml-2">
                {dates.slice(0, 5).map((sd, i) => (
                  <p key={i} className="text-[11px] text-slate-500">
                    {sd.date}{sd.detail ? ` - ${sd.detail}` : ''}
                  </p>
                ))}
                {dates.length > 5 && (
                  <p className="text-[11px] text-slate-400 italic">
                    ...and {dates.length - 5} more
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchedulerResultModal({
  open,
  onClose,
  result,
  isPreview = false,
  onConfirm,
  isConfirming = false,
}: SchedulerResultModalProps) {
  if (!open) return null;

  const headerIcon = isPreview ? (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50">
      <Sparkles className="w-5 h-5 text-blue-500" />
    </div>
  ) : result.success ? (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-emerald-50">
      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    </div>
  ) : (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-50">
      <XCircle className="w-5 h-5 text-red-500" />
    </div>
  );

  const title = isPreview
    ? 'Schedule Preview'
    : result.success
      ? 'Schedule Generated'
      : 'Generation Failed';

  const subtitle = isPreview
    ? 'Review what will be created before confirming'
    : result.success
      ? `${result.sessions_created} session${result.sessions_created !== 1 ? 's' : ''} created`
      : result.error ?? 'An error occurred';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-50 w-[500px] max-h-[80vh] bg-white rounded-2xl shadow-[0_8px_32px_#00000033] overflow-hidden flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-2">
          {headerIcon}
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
            <p className="text-[12px] text-slate-500">{subtitle}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<Calendar className="w-4 h-4 text-blue-500" />}
              label={isPreview ? 'Will Create' : 'Created'}
              value={result.sessions_created}
            />
            <StatCard
              icon={<Users className="w-4 h-4 text-amber-500" />}
              label="Unassigned"
              value={result.unassigned_count}
              warn={result.unassigned_count > 0}
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4 text-slate-400" />}
              label="Warnings"
              value={result.sessions_with_warnings}
              warn={result.sessions_with_warnings > 0}
            />
          </div>

          {/* Drafts cleared info */}
          {result.drafts_cleared > 0 && !isPreview && (
            <p className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Cleared {result.drafts_cleared} previous draft{result.drafts_cleared !== 1 ? 's' : ''} before regeneration.
            </p>
          )}

          {/* Template breakdown */}
          {result.template_stats.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <LayoutTemplate className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[12px] font-semibold text-slate-600">
                  Template Breakdown
                </span>
              </div>
              <div className="space-y-1">
                {result.template_stats.map((ts) => (
                  <div
                    key={`${ts.template_id}-${ts.day_of_week}`}
                    className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-500 w-8">
                        {DAY_NAMES[ts.day_of_week]}
                      </span>
                      <span className="text-[12px] text-slate-700">
                        {ts.grade_groups.length > 0
                          ? ts.grade_groups.join(', ')
                          : 'All grades'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-slate-900 tabular-nums">
                        {ts.sessions_generated}
                      </span>
                      {ts.sessions_unassigned > 0 && (
                        <Tooltip text={`${ts.sessions_unassigned} session(s) without instructor`}>
                          <span className="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            {ts.sessions_unassigned} unassigned
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skipped dates */}
          <SkippedDatesSection skippedDates={result.skipped_dates} />

          {/* Error message */}
          {result.error && !result.success && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-[12px] text-red-700">{result.error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-6 pt-2 border-t border-slate-100">
          {isPreview && onConfirm ? (
            <>
              <button
                onClick={onClose}
                disabled={isConfirming}
                className="px-4 py-2 text-[13px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isConfirming}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isConfirming ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Confirm & Generate
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  warn = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${
      warn ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'
    }`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-slate-500">{label}</span>
      </div>
      <p className={`text-[18px] font-semibold tabular-nums ${
        warn ? 'text-amber-700' : 'text-slate-900'
      }`}>
        {value}
      </p>
    </div>
  );
}
