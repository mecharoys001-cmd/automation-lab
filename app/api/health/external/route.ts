import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { getSiteAdmin, isSiteAdmin } from '@/lib/site-rbac';
import {
  CAMP_SCHEDULER_URL,
  GOOGLE_FONTS_CSS_URLS,
  MEDIA_CDN_URL,
  PUBLIC_ROUTES,
  fetchWithTimeout,
  resolveBaseUrl,
} from '@/lib/external-deps';
import type { HealthCheck, HealthGroup, HealthStatus } from '@/lib/external-health-types';
import { buildReport } from '@/lib/external-health-summary';

// Force the Node runtime — we read package.json from disk and use ioredis
// (TCP), neither of which work on the Edge runtime.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Helpers ────────────────────────────────────────────────────────────────

interface CheckBuilder {
  id: string;
  group: HealthGroup;
  label: string;
}

function makeCheck(
  builder: CheckBuilder,
  status: HealthStatus,
  message: string,
  mitigation: string,
  extras: { durationMs?: number; metadata?: HealthCheck['metadata'] } = {},
): HealthCheck {
  return {
    id: builder.id,
    group: builder.group,
    label: builder.label,
    status,
    message,
    mitigation,
    ...(extras.durationMs !== undefined ? { durationMs: extras.durationMs } : {}),
    ...(extras.metadata ? { metadata: extras.metadata } : {}),
  };
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

// ── Individual checks ──────────────────────────────────────────────────────

async function checkAppRoutes(requestUrl: string): Promise<HealthCheck> {
  const builder: CheckBuilder = {
    id: 'appRoutes',
    group: 'app',
    label: 'Public routes',
  };
  const base = resolveBaseUrl(requestUrl);
  const started = Date.now();
  try {
    const results = await Promise.all(
      PUBLIC_ROUTES.map(async (route) => {
        const url = `${base}${route}`;
        try {
          const res = await fetchWithTimeout(url, { method: 'GET', timeoutMs: 4000 });
          return { route, ok: res.ok, status: res.status };
        } catch (err) {
          return { route, ok: false, status: 0, error: err instanceof Error ? err.message : 'fetch error' };
        }
      }),
    );
    const failed = results.filter((r) => !r.ok);
    const durationMs = Date.now() - started;
    const metadata = Object.fromEntries(
      results.map((r) => [r.route, `${r.status || 'err'}`]),
    );
    if (failed.length === 0) {
      return makeCheck(builder, 'ok', `All ${results.length} public routes responded 2xx`,
        'No action needed.', { durationMs, metadata });
    }
    return makeCheck(
      builder,
      'fail',
      `${failed.length}/${results.length} public route(s) not responding`,
      'Check Vercel deployment logs and confirm the routes still exist. Run npm run build locally to surface any compile errors.',
      { durationMs, metadata },
    );
  } catch (err) {
    return makeCheck(
      builder,
      'fail',
      `Could not probe public routes: ${err instanceof Error ? err.message : 'unknown error'}`,
      'Check that the app is reachable on its base URL and that NEXT_PUBLIC_BASE_URL or VERCEL_URL is set correctly.',
      { durationMs: Date.now() - started },
    );
  }
}

function checkSupabaseConfig(): HealthCheck {
  const builder: CheckBuilder = {
    id: 'supabaseConfig',
    group: 'supabase',
    label: 'Supabase environment',
  };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing: string[] = [];
  if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!anon) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!service) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  const metadata = {
    hasUrl: !!url,
    hasAnonKey: !!anon,
    hasServiceKey: !!service,
  };

  if (missing.length === 0) {
    return makeCheck(
      builder,
      'ok',
      'All required Supabase environment variables are set.',
      'No action needed.',
      { metadata },
    );
  }
  return makeCheck(
    builder,
    'warn',
    `Missing env var(s): ${missing.join(', ')}`,
    'Add the missing variables in Vercel → Project → Settings → Environment Variables (and your local .env). Redeploy after saving.',
    { metadata },
  );
}

async function checkSupabaseDbRead(): Promise<HealthCheck> {
  const builder: CheckBuilder = {
    id: 'supabaseDbRead',
    group: 'supabase',
    label: 'Supabase DB read',
  };
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return makeCheck(
      builder,
      'warn',
      'Skipped — NEXT_PUBLIC_SUPABASE_URL not configured.',
      'Configure NEXT_PUBLIC_SUPABASE_URL before this probe can run.',
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return makeCheck(
      builder,
      'warn',
      'Skipped — SUPABASE_SERVICE_ROLE_KEY not configured.',
      'Add SUPABASE_SERVICE_ROLE_KEY in Vercel → Project → Settings → Environment Variables so the probe can read with the service client (bypassing RLS).',
    );
  }
  const started = Date.now();
  try {
    const supabase = createServiceClient();
    // Head + count read of a small reference table using the service client;
    // no rows returned.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, count } = await (supabase.from('site_admins') as any)
      .select('id', { count: 'exact', head: true });
    const durationMs = Date.now() - started;
    if (error) {
      return makeCheck(
        builder,
        'fail',
        `Supabase responded with an error: ${error.message ?? 'unknown'}`,
        'Confirm the project is not paused, the service role key is valid, and the site_admins table exists in this environment.',
        { durationMs },
      );
    }
    return makeCheck(
      builder,
      'ok',
      'Supabase REST endpoint reachable and accepting reads.',
      'No action needed.',
      { durationMs, metadata: { rowCount: count ?? 0 } },
    );
  } catch (err) {
    return makeCheck(
      builder,
      'fail',
      `Supabase request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      'Verify project URL and service role key, and that the Supabase project is not paused. Check Vercel → Logs for errors.',
      { durationMs: Date.now() - started },
    );
  }
}

async function checkAppsScript(): Promise<HealthCheck> {
  const builder: CheckBuilder = {
    id: 'appsScript',
    group: 'integrations',
    label: 'Camp Scheduler (Apps Script)',
  };
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(CAMP_SCHEDULER_URL, {
      method: 'GET',
      timeoutMs: 6000,
      headers: { 'user-agent': 'automation-lab-health/1' },
    });
    const durationMs = Date.now() - started;
    // Apps Script web-apps redirect through googleusercontent before serving;
    // a 200 OR 302 means the deployment id still resolves.
    if (res.status === 200 || res.status === 302) {
      return makeCheck(
        builder,
        'ok',
        `Apps Script deployment reachable (HTTP ${res.status}).`,
        'No action needed.',
        { durationMs, metadata: { httpStatus: res.status } },
      );
    }
    if (res.status === 404 || res.status === 410) {
      return makeCheck(
        builder,
        'fail',
        `Apps Script returned HTTP ${res.status} — deployment id may be stale.`,
        'Re-deploy the Apps Script web-app, copy the new /exec URL, and update CAMP_SCHEDULER_URL in lib/external-deps.ts.',
        { durationMs, metadata: { httpStatus: res.status } },
      );
    }
    return makeCheck(
      builder,
      'warn',
      `Apps Script returned an unexpected status (HTTP ${res.status}).`,
      'Open the URL in a browser. If it shows a Google sign-in or quota page, redeploy the web-app and update lib/external-deps.ts.',
      { durationMs, metadata: { httpStatus: res.status } },
    );
  } catch (err) {
    return makeCheck(
      builder,
      'fail',
      `Apps Script unreachable: ${err instanceof Error ? err.message : 'unknown error'}`,
      'Check Google service status and re-deploy the web-app if it has been disabled. Update CAMP_SCHEDULER_URL after redeploy.',
      { durationMs: Date.now() - started },
    );
  }
}

function checkRedisConfig(): HealthCheck {
  const builder: CheckBuilder = {
    id: 'redisConfig',
    group: 'redis',
    label: 'Redis environment',
  };
  if (!process.env.report01_REDIS_URL) {
    return makeCheck(
      builder,
      'warn',
      'report01_REDIS_URL is not set.',
      'Reports sharing (POST /api/reports/share) will return 500 until this is configured. Add the URL in Vercel project env vars.',
    );
  }
  return makeCheck(
    builder,
    'ok',
    'report01_REDIS_URL is configured.',
    'No action needed.',
  );
}

async function checkRedisPing(): Promise<HealthCheck | null> {
  const builder: CheckBuilder = {
    id: 'redisPing',
    group: 'redis',
    label: 'Redis ping',
  };
  const url = process.env.report01_REDIS_URL;
  if (!url) return null;
  const started = Date.now();
  // Dynamic import so the route compiles even when the optional dep is absent.
  let RedisCtor: typeof import('ioredis').default | null = null;
  try {
    const mod = await import('ioredis');
    RedisCtor = mod.default;
  } catch {
    return makeCheck(
      builder,
      'warn',
      'ioredis package not available at runtime.',
      'Run npm install to restore dependencies. ioredis is listed in package.json.',
    );
  }
  let client: import('ioredis').default | null = null;
  try {
    client = new RedisCtor(url, {
      lazyConnect: true,
      connectTimeout: 4000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    await client.connect();
    const pong = await client.ping();
    const durationMs = Date.now() - started;
    if (pong === 'PONG') {
      return makeCheck(
        builder,
        'ok',
        'Redis responded to PING.',
        'No action needed.',
        { durationMs },
      );
    }
    return makeCheck(
      builder,
      'warn',
      `Redis responded with an unexpected value: ${String(pong)}`,
      'Check the Redis provider dashboard for warnings and confirm the database is in the expected region.',
      { durationMs },
    );
  } catch (err) {
    return makeCheck(
      builder,
      'fail',
      `Redis PING failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      'Verify report01_REDIS_URL credentials, that the database is not paused, and that egress from Vercel to the Redis host is allowed.',
      { durationMs: Date.now() - started },
    );
  } finally {
    try {
      client?.disconnect();
    } catch {
      // ignore
    }
  }
}

async function checkExternalAssets(): Promise<HealthCheck> {
  const builder: CheckBuilder = {
    id: 'externalAssets',
    group: 'assets',
    label: 'External assets (fonts, media CDN)',
  };
  const started = Date.now();
  const targets = [
    ...GOOGLE_FONTS_CSS_URLS.map((url) => ({ kind: 'font', url })),
    { kind: 'media', url: MEDIA_CDN_URL },
  ];
  const probes = await Promise.all(
    targets.map(async (t) => {
      try {
        // HEAD avoids downloading the body; some hosts reject HEAD, fall back to GET.
        let res = await fetchWithTimeout(t.url, { method: 'HEAD', timeoutMs: 4000 });
        if (res.status === 405 || res.status === 501) {
          res = await fetchWithTimeout(t.url, { method: 'GET', timeoutMs: 4000 });
        }
        return { ...t, ok: res.ok, status: res.status };
      } catch (err) {
        return { ...t, ok: false, status: 0, error: err instanceof Error ? err.message : 'fetch error' };
      }
    }),
  );
  const durationMs = Date.now() - started;
  const failed = probes.filter((p) => !p.ok);
  const metadata: Record<string, string | number | boolean> = {};
  probes.forEach((p, i) => {
    metadata[`asset_${i}_kind`] = p.kind;
    metadata[`asset_${i}_status`] = p.status;
  });
  if (failed.length === 0) {
    return makeCheck(
      builder,
      'ok',
      `All ${probes.length} external assets reachable.`,
      'No action needed.',
      { durationMs, metadata },
    );
  }
  return makeCheck(
    builder,
    'warn',
    `${failed.length}/${probes.length} external asset(s) unreachable. Fonts/media may render with fallbacks.`,
    'If a font URL fails, the site falls back to system sans-serif — purely cosmetic. If the media CDN URL fails, update MEDIA_CDN_URL in lib/external-deps.ts.',
    { durationMs, metadata },
  );
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

async function readPackageJson(): Promise<PackageJson | null> {
  try {
    const raw = await readFile(path.join(process.cwd(), 'package.json'), 'utf8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

async function checkPackageRisk(): Promise<HealthCheck> {
  const builder: CheckBuilder = {
    id: 'packageRisk',
    group: 'packages',
    label: 'Package risk inventory',
  };
  const pkg = await readPackageJson();
  if (!pkg) {
    return makeCheck(
      builder,
      'warn',
      'Could not read package.json from disk.',
      'On Vercel this file is bundled; if missing locally, ensure the route runs from the repo root.',
    );
  }
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const notes: string[] = [];
  const metadata: Record<string, string | number | boolean> = {};

  // Known no-fix advisory: GHSA-4r6h-8v6p-xvw6 / GHSA-5pgg-2g8v-p4x9 — xlsx
  // Prototype Pollution and ReDoS, no patched version published.
  if (deps.xlsx) {
    notes.push(`xlsx@${deps.xlsx} has open advisories with no patch available; the maintainer has not shipped a fixed release.`);
    metadata.xlsx = deps.xlsx;
  }

  // Next.js patch-lag note. This isn't a vulnerability — just a heads-up that
  // we should not pin behind the latest patch in the same minor line.
  if (deps.next) {
    metadata.next = deps.next;
    notes.push(`next@${deps.next} — review the Next.js security advisories page each release; security patches typically ship as same-minor patch bumps.`);
  }

  if (notes.length === 0) {
    return makeCheck(
      builder,
      'ok',
      'No tracked package risks present.',
      'No action needed.',
      { metadata },
    );
  }
  return makeCheck(
    builder,
    'warn',
    notes.join(' '),
    'For xlsx: avoid passing untrusted spreadsheet input through xlsx parsing, or migrate to exceljs. For next: subscribe to https://github.com/vercel/next.js/security/advisories and patch promptly.',
    { metadata },
  );
}

// ── Auth gate ──────────────────────────────────────────────────────────────

async function requireSiteAdminAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const info = await getSiteAdmin(user.email);
  if (!isSiteAdmin(info)) {
    return { ok: false, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true as const, error: null as null };
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireSiteAdminAuth();
  if (!auth.ok) return auth.error;

  const requestUrl = request.url;

  const { result: appRoutes, durationMs: appRoutesDur } = await timed(() => checkAppRoutes(requestUrl));
  // checkAppRoutes already records its own duration internally; keep this for
  // belt-and-braces on environments where the inner timing didn't run.
  if (appRoutes.durationMs === undefined) appRoutes.durationMs = appRoutesDur;

  const supabaseConfig = checkSupabaseConfig();
  const supabaseDbRead = await checkSupabaseDbRead();
  const appsScript = await checkAppsScript();
  const redisConfig = checkRedisConfig();
  const redisPing = await checkRedisPing();
  const externalAssets = await checkExternalAssets();
  const packageRisk = await checkPackageRisk();

  const checks: HealthCheck[] = [
    appRoutes,
    supabaseConfig,
    supabaseDbRead,
    appsScript,
    redisConfig,
    ...(redisPing ? [redisPing] : []),
    externalAssets,
    packageRisk,
  ];

  return NextResponse.json(buildReport(checks), {
    headers: { 'cache-control': 'no-store' },
  });
}
