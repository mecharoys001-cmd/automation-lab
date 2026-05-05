#!/usr/bin/env node
/**
 * validate-external-health-shape.mjs
 *
 * Offline shape validator for the /api/health/external response. Runs without
 * touching Supabase, Redis, Apps Script, or the network. Mirrors the runtime
 * guards in lib/external-health-types.ts so a drift between the TS guards and
 * the reported shape will fail this script.
 *
 * Usage:
 *   node scripts/validate-external-health-shape.mjs
 */

const VALID_STATUS = new Set(['ok', 'warn', 'fail']);
const VALID_GROUP = new Set(['app', 'supabase', 'redis', 'integrations', 'assets', 'packages']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isMetadata(v) {
  if (!isPlainObject(v)) return false;
  return Object.values(v).every(
    (val) => typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean',
  );
}

function isHealthCheck(v) {
  if (!isPlainObject(v)) return false;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.label !== 'string') return false;
  if (typeof v.message !== 'string') return false;
  if (typeof v.mitigation !== 'string') return false;
  if (typeof v.status !== 'string' || !VALID_STATUS.has(v.status)) return false;
  if (typeof v.group !== 'string' || !VALID_GROUP.has(v.group)) return false;
  if (v.durationMs !== undefined && typeof v.durationMs !== 'number') return false;
  if (v.metadata !== undefined && !isMetadata(v.metadata)) return false;
  return true;
}

function isHealthSummary(v) {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.ok === 'number' &&
    typeof v.warn === 'number' &&
    typeof v.fail === 'number' &&
    typeof v.total === 'number'
  );
}

function isHealthReport(v) {
  if (!isPlainObject(v)) return false;
  if (typeof v.generatedAt !== 'string') return false;
  if (!isHealthSummary(v.summary)) return false;
  if (!Array.isArray(v.checks)) return false;
  return v.checks.every(isHealthCheck);
}

function summarize(checks) {
  const summary = { ok: 0, warn: 0, fail: 0, total: checks.length };
  for (const c of checks) summary[c.status] += 1;
  return summary;
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const validFixture = {
  generatedAt: new Date().toISOString(),
  summary: { ok: 2, warn: 1, fail: 0, total: 3 },
  checks: [
    {
      id: 'appRoutes',
      group: 'app',
      label: 'Public routes',
      status: 'ok',
      message: 'All public routes responded.',
      mitigation: 'No action needed.',
      durationMs: 87,
      metadata: { '/': '200', '/login': '200' },
    },
    {
      id: 'supabaseDbRead',
      group: 'supabase',
      label: 'Supabase DB read',
      status: 'ok',
      message: 'Supabase reachable.',
      mitigation: 'No action needed.',
    },
    {
      id: 'redisConfig',
      group: 'redis',
      label: 'Redis environment',
      status: 'warn',
      message: 'report01_REDIS_URL is not set.',
      mitigation: 'Add the URL in Vercel env vars.',
    },
  ],
};

const invalidFixtures = [
  { name: 'missing generatedAt', fix: { ...validFixture, generatedAt: undefined } },
  { name: 'bad status enum', fix: { ...validFixture, checks: [{ ...validFixture.checks[0], status: 'green' }] } },
  { name: 'bad group enum', fix: { ...validFixture, checks: [{ ...validFixture.checks[0], group: 'misc' }] } },
  { name: 'metadata with object value', fix: { ...validFixture, checks: [{ ...validFixture.checks[0], metadata: { nested: { a: 1 } } }] } },
  { name: 'durationMs string', fix: { ...validFixture, checks: [{ ...validFixture.checks[0], durationMs: '12ms' }] } },
  { name: 'summary missing total', fix: { ...validFixture, summary: { ok: 1, warn: 0, fail: 0 } } },
  { name: 'checks not an array', fix: { ...validFixture, checks: 'nope' } },
];

// ── Run ────────────────────────────────────────────────────────────────────

let failures = 0;

function expect(label, cond) {
  const ok = !!cond;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
}

console.log('External health shape validator');
console.log('');
console.log('Valid fixture');
expect('isHealthReport(valid)', isHealthReport(validFixture));
expect('summarize matches fixture', JSON.stringify(summarize(validFixture.checks)) === JSON.stringify({ ok: 2, warn: 1, fail: 0, total: 3 }));

console.log('');
console.log('Invalid fixtures (should all be rejected)');
for (const { name, fix } of invalidFixtures) {
  expect(name, !isHealthReport(fix));
}

console.log('');
if (failures === 0) {
  console.log('All assertions passed.');
  process.exit(0);
} else {
  console.error(`${failures} assertion(s) failed.`);
  process.exit(1);
}
