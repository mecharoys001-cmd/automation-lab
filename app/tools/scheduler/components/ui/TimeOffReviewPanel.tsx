'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CalendarOff,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import type { TimeOffRequestWithStaff, TimeOffRequestType } from '@/types/staff-time-off';

// ── Constants ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<TimeOffRequestType, string> = {
  full_day: 'Full Day',
  partial_day: 'Partial Day',
  multi_day: 'Multi-Day',
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertCircle },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  denied: { label: 'Denied', className: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

// ── Component ─────────────────────────────────────────────────────────────

interface TimeOffReviewPanelProps {
  programId: string;
  /** Called after an approve/deny action so parent can refresh counts */
  onReviewAction?: () => void;
}

export function TimeOffReviewPanel({ programId, onReviewAction }: TimeOffReviewPanelProps) {
  const [requests, setRequests] = useState<TimeOffRequestWithStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!programId) return;
    try {
      const res = await fetch(`/api/staff-time-off/review?program_id=${programId}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      } else {
        setError('Failed to load time off requests.');
      }
    } catch {
      setError('Network error loading time off requests.');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    loadRequests();
  }, [loadRequests]);

  async function handleReview(id: string, status: 'approved' | 'denied') {
    setActionLoading(id);
    try {
      const res = await fetch('/api/staff-time-off/review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, program_id: programId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update request.');
        return;
      }

      // Refresh list
      await loadRequests();
      onReviewAction?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  }

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading time off requests...
      </div>
    );
  }

  if (requests.length === 0 && !error) {
    return null; // Don't render anything if there are no requests
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200 bg-amber-100/50">
            <CalendarOff className="w-4 h-4 text-amber-800" />
            <Tooltip text="Time off requests awaiting your review">
              <h3 className="text-[13px] font-semibold text-amber-800">
                Pending Time Off ({pending.length})
              </h3>
            </Tooltip>
          </div>
          <div className="divide-y divide-amber-100">
            {pending.map((req) => (
              <RequestRow
                key={req.id}
                request={req}
                actionLoading={actionLoading}
                onApprove={() => handleReview(req.id, 'approved')}
                onDeny={() => handleReview(req.id, 'denied')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved requests (collapsible) */}
      {resolved.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
          >
            <CalendarOff className="w-4 h-4 text-slate-400" />
            <Tooltip text="Previously reviewed time off requests">
              <span className="text-[13px] font-semibold text-slate-600 flex-1">
                Resolved Time Off ({resolved.length})
              </span>
            </Tooltip>
            {showResolved
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showResolved && (
            <div className="divide-y divide-slate-100 border-t border-slate-200">
              {resolved.map((req) => (
                <RequestRow key={req.id} request={req} readonly />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── RequestRow ────────────────────────────────────────────────────────────

function RequestRow({
  request: req,
  actionLoading,
  onApprove,
  onDeny,
  readonly = false,
}: {
  request: TimeOffRequestWithStaff;
  actionLoading?: string | null;
  onApprove?: () => void;
  onDeny?: () => void;
  readonly?: boolean;
}) {
  const statusCfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const dateLabel = req.start_date === req.end_date
    ? req.start_date
    : `${req.start_date} \u2013 ${req.end_date}`;
  const timeLabel = req.request_type === 'partial_day' && req.start_time && req.end_time
    ? ` \u00B7 ${req.start_time}\u2013${req.end_time}`
    : '';
  const isLoading = actionLoading === req.id;

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Tooltip text="Staff member who submitted this request">
            <span className="text-[13px] font-medium text-slate-800">
              {req.staff_first_name} {req.staff_last_name}
            </span>
          </Tooltip>
          <Tooltip text={`Request type: ${TYPE_LABELS[req.request_type]}`}>
            <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {TYPE_LABELS[req.request_type]}
            </span>
          </Tooltip>
        </div>
        <Tooltip text="Requested time off dates">
          <p className="text-[12px] text-slate-600 tabular-nums">
            {dateLabel}{timeLabel}
          </p>
        </Tooltip>
        <p className="text-[12px] text-slate-500 mt-0.5">{req.note}</p>
        {req.reviewed_at && (
          <p className="text-[10px] text-slate-400 mt-1">
            Reviewed {new Date(req.reviewed_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {readonly ? (
        <Tooltip text={`Status: ${statusCfg.label}`}>
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0 ${statusCfg.className}`}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </span>
        </Tooltip>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <Tooltip text="Approve this time off request">
            <button
              onClick={onApprove}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Approve
            </button>
          </Tooltip>
          <Tooltip text="Deny this time off request">
            <button
              onClick={onDeny}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Deny
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
