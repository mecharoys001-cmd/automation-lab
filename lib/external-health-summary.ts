import type { HealthCheck, HealthReport, HealthStatus, HealthSummary } from './external-health-types';

const STATUS_RANK: Record<HealthStatus, number> = { ok: 0, warn: 1, fail: 2 };

export function summarize(checks: ReadonlyArray<HealthCheck>): HealthSummary {
  const summary: HealthSummary = { ok: 0, warn: 0, fail: 0, total: checks.length };
  for (const c of checks) {
    summary[c.status] += 1;
  }
  return summary;
}

export function worstStatus(checks: ReadonlyArray<HealthCheck>): HealthStatus {
  let worst: HealthStatus = 'ok';
  for (const c of checks) {
    if (STATUS_RANK[c.status] > STATUS_RANK[worst]) worst = c.status;
  }
  return worst;
}

export function buildReport(checks: ReadonlyArray<HealthCheck>): HealthReport {
  return {
    generatedAt: new Date().toISOString(),
    summary: summarize(checks),
    checks: [...checks],
  };
}
