'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CalendarOff,
  Clock,
  CalendarRange,
  CalendarDays,
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Tooltip } from './Tooltip';
import type { StaffTimeOffRequest, TimeOffRequestType } from '@/types/staff-time-off';

// ── Constants ─────────────────────────────────────────────────────────────

const REQUEST_TYPES: { value: TimeOffRequestType; label: string; icon: typeof CalendarDays; tip: string }[] = [
  { value: 'full_day', label: 'Full Day', icon: CalendarDays, tip: 'Request a full day off' },
  { value: 'partial_day', label: 'Partial Day', icon: Clock, tip: 'Request part of a day off' },
  { value: 'multi_day', label: 'Multi-Day', icon: CalendarRange, tip: 'Request multiple consecutive days off' },
];

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertCircle },
  approved: { label: 'Approved', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  denied: { label: 'Denied', className: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

const TYPE_LABELS: Record<TimeOffRequestType, string> = {
  full_day: 'Full Day',
  partial_day: 'Partial Day',
  multi_day: 'Multi-Day',
};

// ── Component ─────────────────────────────────────────────────────────────

interface TimeOffTabProps {
  staffId: string;
}

export function TimeOffTab({ staffId }: TimeOffTabProps) {
  // Form state
  const [requestType, setRequestType] = useState<TimeOffRequestType>('full_day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // History state
  const [requests, setRequests] = useState<StaffTimeOffRequest[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/staff-time-off');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  function resetForm() {
    setRequestType('full_day');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setNote('');
    setFormError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Client-side validation
    if (!startDate) { setFormError('Please select a date.'); return; }
    if (requestType === 'partial_day' && (!startTime || !endTime)) {
      setFormError('Partial-day requests require start and end times.');
      return;
    }
    if (requestType === 'partial_day' && endTime <= startTime) {
      setFormError('End time must be after start time.');
      return;
    }
    if (requestType === 'multi_day' && !endDate) {
      setFormError('Multi-day requests require an end date.');
      return;
    }
    if (requestType === 'multi_day' && endDate < startDate) {
      setFormError('End date must be on or after start date.');
      return;
    }
    if (!note.trim()) { setFormError('A note explaining your request is required.'); return; }

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        request_type: requestType,
        start_date: startDate,
        note: note.trim(),
      };
      if (requestType === 'multi_day') payload.end_date = endDate;
      if (requestType === 'partial_day') {
        payload.start_time = startTime;
        payload.end_time = endTime;
      }

      const res = await fetch('/api/staff-time-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || 'Failed to submit request.');
        return;
      }

      setFormSuccess('Time off request submitted successfully.');
      resetForm();
      loadHistory();
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarOff className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-900">Time Off</h2>
        </div>
        <p className="text-sm text-slate-500">
          Submit a time off request. Your request will be reviewed by an admin before it takes effect.
        </p>
      </div>

      {/* Submission form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        {/* Request type selector */}
        <div>
          <label className="block text-[12px] font-medium text-slate-700 mb-1.5">Request Type</label>
          <div className="flex gap-2">
            {REQUEST_TYPES.map(({ value, label, icon: Icon, tip }) => (
              <Tooltip key={value} text={tip}>
                <button
                  type="button"
                  onClick={() => setRequestType(value)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    requestType === value
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Date fields */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[140px]">
            <Tooltip text={requestType === 'multi_day' ? 'First day of your time off' : 'Date of your time off'}>
              <label className="block text-[12px] font-medium text-slate-700 mb-1">
                {requestType === 'multi_day' ? 'Start Date' : 'Date'}
              </label>
            </Tooltip>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {requestType === 'multi_day' && (
            <div className="flex-1 min-w-[140px]">
              <Tooltip text="Last day of your time off">
                <label className="block text-[12px] font-medium text-slate-700 mb-1">End Date</label>
              </Tooltip>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Time fields (partial day only) */}
        {requestType === 'partial_day' && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Tooltip text="Time your absence begins">
                <label className="block text-[12px] font-medium text-slate-700 mb-1">Start Time</label>
              </Tooltip>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <Tooltip text="Time your absence ends">
                <label className="block text-[12px] font-medium text-slate-700 mb-1">End Time</label>
              </Tooltip>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* Note */}
        <div>
          <Tooltip text="Explain the reason for your time off request">
            <label className="block text-[12px] font-medium text-slate-700 mb-1">Note</label>
          </Tooltip>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Briefly explain your time off request..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Error / success messages */}
        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
            {formError}
          </div>
        )}
        {formSuccess && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-[12px] text-emerald-700">
            {formSuccess}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <Tooltip text="Submit your time off request for admin review">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Request
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </form>

      {/* Request history */}
      <div>
        <h3 className="text-[13px] font-semibold text-slate-700 mb-3">Request History</h3>
        {loadingHistory ? (
          <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No time off requests yet.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              const dateLabel = req.start_date === req.end_date
                ? req.start_date
                : `${req.start_date} \u2013 ${req.end_date}`;
              const timeLabel = req.request_type === 'partial_day' && req.start_time && req.end_time
                ? ` \u00B7 ${req.start_time}\u2013${req.end_time}`
                : '';

              return (
                <div
                  key={req.id}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Tooltip text={`Request type: ${TYPE_LABELS[req.request_type]}`}>
                        <span className="text-[12px] font-medium text-slate-700">
                          {TYPE_LABELS[req.request_type]}
                        </span>
                      </Tooltip>
                      <span className="text-[11px] text-slate-400">\u00B7</span>
                      <Tooltip text="Date(s) of your time off request">
                        <span className="text-[12px] text-slate-600 tabular-nums">
                          {dateLabel}{timeLabel}
                        </span>
                      </Tooltip>
                    </div>
                    <p className="text-[12px] text-slate-500 truncate">{req.note}</p>
                    {req.reviewed_at && (
                      <Tooltip text="When this request was reviewed">
                        <p className="text-[10px] text-slate-400 mt-1">
                          Reviewed {new Date(req.reviewed_at).toLocaleDateString()}
                        </p>
                      </Tooltip>
                    )}
                    {req.review_note && (
                      <p className="text-[11px] text-slate-500 mt-0.5 italic">
                        Admin note: {req.review_note}
                      </p>
                    )}
                  </div>
                  <Tooltip text={`Status: ${statusCfg.label}`}>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0 ${statusCfg.className}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusCfg.label}
                    </span>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
