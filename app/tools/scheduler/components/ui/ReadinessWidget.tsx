'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Tooltip } from './Tooltip';

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
  ready: 'text-emerald-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
};

const StatusIcon = {
  ready: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

function ReadinessIcon({ check }: { check: ValidationCheck }) {
  const Icon = StatusIcon[check.status];
  const tooltipLines = [check.label + ': ' + (check.summary || `${check.count}/${check.total}`)];
  if (check.details.length > 0) {
    tooltipLines.push(...check.details.map(d => `• ${d}`));
  }

  return (
    <Tooltip text={tooltipLines.join('\n')}>
      <div className="inline-flex items-center justify-center cursor-default">
        <Icon className={`w-5 h-5 ${STATUS_ICON_CLASS[check.status]}`} />
      </div>
    </Tooltip>
  );
}

export function ReadinessWidget({ programId }: ReadinessWidgetProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

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

  if (!programId || !validation) return null;

  const checks = [
    validation.checks.templates,
    validation.checks.instructors,
    validation.checks.venues,
  ];

  return (
    <div className="inline-flex items-center gap-2">
      {checks.map((check) => (
        <ReadinessIcon key={check.label} check={check} />
      ))}
    </div>
  );
}
