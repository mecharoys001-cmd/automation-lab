'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ExternalLink } from 'lucide-react';

interface ValidationCheck {
  label: string;
  status: 'ready' | 'warning' | 'error';
  count: number;
  total: number;
  details: string[];
  summary: string;
}

interface ValidationResult {
  ready: boolean;
  checks: {
    templates: ValidationCheck;
    instructors: ValidationCheck;
    venues: ValidationCheck;
  };
}

interface ReadinessWidgetProps {
  programId: string | null;
}

const STATUS_ICON_CLASS = {
  ready: 'text-emerald-700',
  warning: 'text-amber-800',
  error: 'text-red-700',
};

const StatusIcon = {
  ready: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const STATUS_BG_CLASS = {
  ready: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  error: 'bg-red-50 border-red-200',
};

const STATUS_TEXT_CLASS = {
  ready: 'text-emerald-700',
  warning: 'text-amber-800',
  error: 'text-red-700',
};

/** Maps detail text patterns to { hint, path } for navigation */
const ACTION_MAP: Array<{ match: string; hint: string; path: string }> = [
  { match: 'No active templates found', hint: 'Create templates', path: '/tools/scheduler/admin/event-templates' },
  { match: 'missing start/end time and duration', hint: 'Edit template times or add duration', path: '/tools/scheduler/admin/event-templates' },
  { match: 'no grade groups assigned', hint: 'Assign grade groups', path: '/tools/scheduler/admin/event-templates' },
  { match: 'No active instructors found', hint: 'Add staff', path: '/tools/scheduler/admin/people' },
  { match: 'None have event types configured', hint: 'Assign event types', path: '/tools/scheduler/admin/people' },
  { match: 'missing event types', hint: 'Assign event types', path: '/tools/scheduler/admin/people' },
  { match: 'None have availability set', hint: 'Set availability', path: '/tools/scheduler/admin/people' },
  { match: 'missing availability', hint: 'Set availability', path: '/tools/scheduler/admin/people' },
  { match: 'No venues configured', hint: 'Add venues', path: '/tools/scheduler/admin/people' },
  { match: 'missing capacity', hint: 'Set venue capacity', path: '/tools/scheduler/admin/people' },
];

/** Category-level navigation paths */
const CATEGORY_PATH: Record<string, string> = {
  'Event Templates': '/tools/scheduler/admin/event-templates',
  'Staff': '/tools/scheduler/admin/people',
  'Venues': '/tools/scheduler/admin/people',
};

function getAction(detail: string): { hint: string; path: string } | null {
  for (const entry of ACTION_MAP) {
    if (detail.includes(entry.match)) return { hint: entry.hint, path: entry.path };
  }
  return null;
}

function CheckSection({ check, onNavigate }: { check: ValidationCheck; onNavigate: (path: string) => void }) {
  if (check.status === 'ready') return null;

  const Icon = StatusIcon[check.status];
  const categoryPath = CATEGORY_PATH[check.label];

  return (
    <div className={`rounded-lg border px-3 py-2 ${STATUS_BG_CLASS[check.status]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 flex-shrink-0 ${STATUS_ICON_CLASS[check.status]}`} />
        <span className={`text-xs font-semibold ${STATUS_TEXT_CLASS[check.status]}`}>
          {check.label}
        </span>
        <span className="text-xs text-slate-600 ml-auto">
          {check.summary}
        </span>
      </div>
      {check.details.length > 0 && (
        <ul className="ml-6 space-y-1 mt-1">
          {check.details.map((detail, i) => {
            const action = getAction(detail);
            return (
              <li key={i} className="text-xs text-slate-700">
                <span>{'• '}{detail}</span>
                {action && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onNavigate(action.path); }}
                    className="ml-1.5 inline-flex items-center gap-0.5 text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
                  >
                    {action.hint}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!check.details.some(d => getAction(d)) && categoryPath && (
        <button
          type="button"
          onClick={() => onNavigate(categoryPath)}
          className="ml-6 mt-1 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
        >
          Go to {check.label}
          <ExternalLink className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function ReadinessWidget({ programId }: ReadinessWidgetProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const router = useRouter();

  const fetchValidation = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/scheduler/validate?program_id=${encodeURIComponent(programId)}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        setValidation(await res.json());
      }
    } catch {
      // Silently fail — widget is informational
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchValidation();
  }, [fetchValidation]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [expanded]);

  if (!programId || !validation) return null;

  const checks = [
    validation.checks.templates,
    validation.checks.instructors,
    validation.checks.venues,
  ];

  const issueChecks = checks.filter(c => c.status !== 'ready');
  const hasErrors = checks.some(c => c.status === 'error');
  const hasWarnings = checks.some(c => c.status === 'warning');
  const hasIssues = hasErrors || hasWarnings;

  // Overall status for the summary pill
  const overallStatus = hasErrors ? 'error' : hasWarnings ? 'warning' : 'ready';

  if (!hasIssues) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
        <span className="text-xs font-medium text-emerald-700">Ready to publish</span>
      </div>
    );
  }

  // Build summary label based on category count, not individual detail items
  const issueNames = issueChecks.map(c => c.label);
  const summaryLabel = issueChecks.length === 1
    ? `${issueNames[0]} needs attention`
    : `${issueChecks.length} issues — click for details`;

  const SummaryIcon = StatusIcon[overallStatus];

  const handleToggle = () => {
    if (!expanded && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelWidth = 320; // w-80
      const margin = 12; // minimum distance from any window edge

      // Center horizontally on button, then clamp to viewport
      let left = rect.left + rect.width / 2 - panelWidth / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - panelWidth - margin));

      // Position below button, but flip above if not enough space below
      let top = rect.bottom + margin;
      const estimatedPanelHeight = 300;
      if (top + estimatedPanelHeight > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - estimatedPanelHeight - margin);
      }

      setDropdownPos({ top, left });
    }
    setExpanded(!expanded);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors
          ${STATUS_TEXT_CLASS[overallStatus]} hover:bg-slate-100 cursor-pointer`}
        aria-expanded={expanded}
      >
        <SummaryIcon className={`w-4 h-4 ${STATUS_ICON_CLASS[overallStatus]}`} />
        <span>{summaryLabel}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <>
          <div className="fixed inset-0 z-[299]" onClick={() => setExpanded(false)} />
          <div
            className="fixed z-[300] w-80 max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl p-4 space-y-3"
            style={{ top: dropdownPos.top, left: Math.max(8, dropdownPos.left) }}
          >
            <div className="text-xs font-semibold text-slate-800 px-1">
              Publish Readiness
            </div>
            {issueChecks.map(check => (
              <CheckSection key={check.label} check={check} onNavigate={(path) => { setExpanded(false); router.push(path); }} />
            ))}
            <p className="text-[10px] text-slate-700 px-1">
              Resolve these before publishing. Click the blue links to fix each issue.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
