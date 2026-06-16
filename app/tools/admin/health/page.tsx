'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HealthCheck, HealthGroup, HealthReport, HealthStatus } from '@/lib/external-health-types';

const STATUS_COLOR: Record<HealthStatus, { bg: string; border: string; fg: string }> = {
  ok: { bg: '#0f3a2a', border: '#1f8a5a', fg: '#7ee2b3' },
  warn: { bg: '#3a2e0f', border: '#a07a1f', fg: '#ffd273' },
  fail: { bg: '#3a1414', border: '#a02a2a', fg: '#ff9a9a' },
};

const STATUS_LABEL: Record<HealthStatus, string> = {
  ok: 'OK',
  warn: 'WARN',
  fail: 'FAIL',
};

const STATUS_TOOLTIP: Record<HealthStatus, string> = {
  ok: 'Working as expected — no action needed.',
  warn: 'Degraded or unconfigured — review the mitigation steps before this becomes user-facing.',
  fail: 'Broken or unreachable — almost certainly user-facing. Take the mitigation step now.',
};

const GROUP_LABEL: Record<HealthGroup, string> = {
  app: 'Application',
  supabase: 'Supabase',
  redis: 'Redis',
  integrations: 'Third-party integrations',
  assets: 'External assets',
  packages: 'Package risk',
};

const GROUP_ORDER: HealthGroup[] = ['app', 'supabase', 'redis', 'integrations', 'assets', 'packages'];

function StatusBadge({ status }: { status: HealthStatus }) {
  const c = STATUS_COLOR[status];
  return (
    <span
      title={STATUS_TOOLTIP[status]}
      aria-label={`Status: ${STATUS_LABEL[status]} — ${STATUS_TOOLTIP[status]}`}
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontFamily: 'monospace',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function SummaryPill({
  label,
  count,
  status,
  tooltip,
}: {
  label: string;
  count: number;
  status: HealthStatus | 'total';
  tooltip: string;
}) {
  const c =
    status === 'total'
      ? { bg: '#1a1f2e', border: '#2a3142', fg: '#cbd5e1' }
      : STATUS_COLOR[status];
  return (
    <div
      title={tooltip}
      aria-label={tooltip}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 96,
      }}
    >
      <div style={{ color: c.fg, fontSize: 26, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </div>
      <div style={{ color: c.fg, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: HealthCheck }) {
  return (
    <div
      style={{
        background: '#0f1320',
        border: '1px solid #1f2940',
        borderRadius: 8,
        padding: '14px 16px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: '10px 14px',
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            title={`Check ID: ${check.id}`}
            style={{ color: '#e5e7eb', fontWeight: 600, fontSize: 14 }}
          >
            {check.label}
          </span>
          <code
            title="Stable identifier — safe to grep for in code or logs."
            style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}
          >
            {check.id}
          </code>
        </div>
        <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>
          {check.message}
        </div>
        {check.mitigation && (
          <div
            title="What to do if this check is failing or warning."
            style={{
              color: '#a8b3c7',
              fontSize: 12,
              marginTop: 6,
              borderLeft: '2px solid #2a3142',
              paddingLeft: 10,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: '#cbd5e1', fontWeight: 600 }}>Mitigation:</strong> {check.mitigation}
          </div>
        )}
        {check.metadata && Object.keys(check.metadata).length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary
              title="Raw metadata returned by this probe"
              style={{ color: '#7e8aa6', fontSize: 11, cursor: 'pointer', listStyle: 'none' }}
            >
              metadata
            </summary>
            <pre
              style={{
                fontSize: 11,
                color: '#a8b3c7',
                background: '#070b15',
                padding: 10,
                borderRadius: 6,
                marginTop: 6,
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(check.metadata, null, 2)}
            </pre>
          </details>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <StatusBadge status={check.status} />
        {typeof check.durationMs === 'number' && (
          <span
            title="Probe duration in milliseconds"
            style={{ color: '#7e8aa6', fontSize: 11, fontFamily: 'monospace' }}
          >
            {check.durationMs}ms
          </span>
        )}
      </div>
    </div>
  );
}

export default function HealthPage() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health/external', { cache: 'no-store' });
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      const data = (await res.json()) as HealthReport;
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health report');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const grouped = useMemo(() => {
    const map = new Map<HealthGroup, HealthCheck[]>();
    for (const c of report?.checks ?? []) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return map;
  }, [report]);

  if (forbidden) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#070b15',
          color: '#e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 22, marginBottom: 12 }}>Access denied</h1>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>
            Site admin access is required to view the external dependency health dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#070b15', color: '#e5e7eb', paddingTop: 80 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#64748b', marginBottom: 6 }}>
              Automation Lab · Operations
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              External Dependency Health
            </h1>
            <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 8, maxWidth: 720, lineHeight: 1.5 }}>
              Live probes against everything the platform depends on outside its own database. A failure here is almost
              always user-facing. See{' '}
              <code style={{ color: '#cbd5e1' }}>docs/EXTERNAL_DEPENDENCY_HEALTH.md</code> for what each check means.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {report && (
              <span
                title="Time the report was generated server-side"
                style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}
              >
                {new Date(report.generatedAt).toLocaleString()}
              </span>
            )}
            <button
              onClick={fetchReport}
              disabled={loading}
              title="Re-run all health checks against external dependencies"
              aria-label="Refresh external dependency health report"
              style={{
                background: loading ? '#1a1f2e' : '#1f6feb',
                border: '1px solid #2563eb',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: 6,
                cursor: loading ? 'wait' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: '#3a1414',
              border: '1px solid #a02a2a',
              color: '#ff9a9a',
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {report && (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
              <SummaryPill label="OK" count={report.summary.ok} status="ok" tooltip="Checks that returned a healthy status." />
              <SummaryPill label="Warn" count={report.summary.warn} status="warn" tooltip="Checks that are degraded or have missing configuration." />
              <SummaryPill label="Fail" count={report.summary.fail} status="fail" tooltip="Checks that failed — likely user-facing impact." />
              <SummaryPill label="Total" count={report.summary.total} status="total" tooltip="Total checks performed in this report." />
            </div>

            {GROUP_ORDER.map((group) => {
              const checks = grouped.get(group);
              if (!checks || checks.length === 0) return null;
              return (
                <section key={group} style={{ marginBottom: 28 }}>
                  <h2
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: '#94a3b8',
                      margin: '0 0 12px',
                      fontWeight: 600,
                    }}
                  >
                    {GROUP_LABEL[group]}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {checks.map((c) => (
                      <CheckRow key={c.id} check={c} />
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}

        {!report && !error && loading && (
          <div style={{ color: '#94a3b8', fontSize: 14 }}>Loading health report…</div>
        )}
      </div>
    </div>
  );
}
