// Pure type definitions and runtime guards for the external-dependency
// health probe. Kept free of Node/Next imports so the validation script
// (scripts/validate-external-health-shape.mjs) can import them at runtime
// without booting the framework.

export type HealthStatus = 'ok' | 'warn' | 'fail';

export type HealthGroup =
  | 'app'
  | 'supabase'
  | 'redis'
  | 'integrations'
  | 'assets'
  | 'packages';

export interface HealthCheck {
  id: string;
  group: HealthGroup;
  label: string;
  status: HealthStatus;
  message: string;
  mitigation: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface HealthSummary {
  ok: number;
  warn: number;
  fail: number;
  total: number;
}

export interface HealthReport {
  generatedAt: string;
  summary: HealthSummary;
  checks: HealthCheck[];
}

const VALID_STATUS: ReadonlySet<HealthStatus> = new Set(['ok', 'warn', 'fail']);
const VALID_GROUP: ReadonlySet<HealthGroup> = new Set([
  'app',
  'supabase',
  'redis',
  'integrations',
  'assets',
  'packages',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isMetadata(v: unknown): v is Record<string, string | number | boolean> {
  if (!isPlainObject(v)) return false;
  return Object.values(v).every(
    (val) => typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean',
  );
}

export function isHealthCheck(v: unknown): v is HealthCheck {
  if (!isPlainObject(v)) return false;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.label !== 'string') return false;
  if (typeof v.message !== 'string') return false;
  if (typeof v.mitigation !== 'string') return false;
  if (typeof v.status !== 'string' || !VALID_STATUS.has(v.status as HealthStatus)) return false;
  if (typeof v.group !== 'string' || !VALID_GROUP.has(v.group as HealthGroup)) return false;
  if (v.durationMs !== undefined && typeof v.durationMs !== 'number') return false;
  if (v.metadata !== undefined && !isMetadata(v.metadata)) return false;
  return true;
}

export function isHealthSummary(v: unknown): v is HealthSummary {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.ok === 'number' &&
    typeof v.warn === 'number' &&
    typeof v.fail === 'number' &&
    typeof v.total === 'number'
  );
}

export function isHealthReport(v: unknown): v is HealthReport {
  if (!isPlainObject(v)) return false;
  if (typeof v.generatedAt !== 'string') return false;
  if (!isHealthSummary(v.summary)) return false;
  if (!Array.isArray(v.checks)) return false;
  return v.checks.every(isHealthCheck);
}
