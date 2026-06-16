# External Dependency Health

The Automation Lab platform is small, but it talks to a surprising number of
systems we do not control. When one of them disappears (a Google Apps Script
deployment id rotates, a Redis credential expires, the Supabase project
pauses), the failure usually shows up as user pain before it shows up in our
inbox. The **External Dependency Health** dashboard exists to put every
external dependency on a single page so an operator can answer the question
"is this real, or is something upstream broken?" in under 30 seconds.

## Where to find it

- **Dashboard:** `/tools/admin/health` (site-admin only)
- **Raw JSON:** `GET /api/health/external` (same auth gate)
- **Source of truth for endpoints:** `lib/external-deps.ts`

## What is monitored

Every check returns a `status` of `ok`, `warn`, or `fail` plus a
`mitigation` string telling the on-call operator what to do. Checks are
grouped by subsystem.

### Application (`group: "app"`)

| id          | What it probes                                             | Failure means                                                                  |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `appRoutes` | Self-fetches the routes in `PUBLIC_ROUTES` and checks 2xx. | Vercel deployment is broken or one of the public landing routes was renamed.   |

### Supabase (`group: "supabase"`)

| id                | What it probes                                                                | Failure means                                                                                |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `supabaseConfig`  | Presence of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. | One of the environments is missing keys. The site will run but DB-backed pages will 500. |
| `supabaseDbRead`  | A `head + count` read against `site_admins` using the service client (`SUPABASE_SERVICE_ROLE_KEY`). | Supabase project is paused, the service role key is invalid, or the table is missing.        |

### Redis (`group: "redis"`)

| id            | What it probes                                                  | Failure means                                                                             |
| ------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `redisConfig` | Presence of `report01_REDIS_URL`.                               | Reports sharing (`POST /api/reports/share`) returns 500. Other features are unaffected.   |
| `redisPing`   | Connect + `PING` via `ioredis` (only run if the URL is present). | Redis provider is down, the URL is wrong, or egress from Vercel to the Redis host is blocked. |

### Third-party integrations (`group: "integrations"`)

| id          | What it probes                                              | Failure means                                                                              |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `appsScript` | `GET` against `CAMP_SCHEDULER_URL` (the camp scheduler web-app). | Almost always a stale Apps Script deployment id — re-deploy the script and update `lib/external-deps.ts`. |

### External assets (`group: "assets"`)

| id              | What it probes                                              | Failure means                                                                              |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `externalAssets` | Google Fonts CSS endpoints + the marketing video CDN host. | Cosmetic — fonts fall back to system sans-serif. The media CDN URL may need updating in `lib/external-deps.ts`. |

### Package risk (`group: "packages"`)

| id            | What it surfaces                                                            | Why it's not a hard fail                                                                         |
| ------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `packageRisk` | `xlsx` no-fix advisories + a Next.js patch-lag reminder, read from `package.json`. | These advisories don't block the platform. They warrant defensive coding (see mitigation below). |

> **Note:** `packageRisk` does **not** run `npm audit`. It deliberately
> reads `package.json` only so it can run on Vercel (where `npm` may not
> be on the PATH at request time) and so a transient registry blip
> doesn't flip the dashboard red.

## Status semantics

| Status  | Meaning                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------- |
| `ok`    | Working as expected. No action.                                                                      |
| `warn`  | Degraded or unconfigured. Likely not user-facing yet, but will be if left alone.                     |
| `fail`  | Broken. Almost certainly user-facing — start with the `mitigation` text.                             |

A `warn` for a **missing env var** is intentional: a fresh preview
environment with no Redis credential is not "broken," it's "not yet
configured." Don't treat it as fail or noise will drown the signal.

## What to do when something is red

1. Open `/tools/admin/health`. The mitigation text is the first
   actionable step for every check.
2. If `appsScript` fails: the deployment id has rotated. Re-deploy the
   web-app from `gas/`, copy the new `/exec` URL, replace
   `CAMP_SCHEDULER_URL` in `lib/external-deps.ts`, and ship a deploy.
3. If `supabaseDbRead` fails: check the Supabase project dashboard for a
   pause/billing issue, then verify `SUPABASE_SERVICE_ROLE_KEY` matches the
   project URL.
4. If `redisPing` fails: rotate the credential or check the Redis
   provider's status page. Reports sharing will be unavailable until
   resolved; other features keep working.
5. If `externalAssets` is yellow on a font URL: ignore unless QA reports
   visible regression. Update the URL only if the host has changed.

## Architecture notes

- All endpoints/URLs live in `lib/external-deps.ts`. **Add new external
  dependencies there first**, then add a check in
  `app/api/health/external/route.ts`.
- The route runs on the Node.js runtime (`runtime = 'nodejs'`) because
  `ioredis` and `fs` are not available on Edge.
- Probes use `fetchWithTimeout` (4–6s) so a hung upstream cannot stall the
  whole report.
- The route is admin-gated inside the handler, since `middleware.ts` does
  not run on `/api/*`.
- Type guards live in `lib/external-health-types.ts`. The offline
  validator at `scripts/validate-external-health-shape.mjs` mirrors them
  and is exposed as `npm run validate:health-shape` so a shape drift
  fails CI without hitting any external service.

## Adding a new check

1. If the dependency is a URL or env var the rest of the app reads, add
   a constant in `lib/external-deps.ts`.
2. Add a `checkX()` function in `app/api/health/external/route.ts`
   following the existing pattern: deterministic `id`, descriptive
   `label`, friendly `message`, and a *concrete* `mitigation`.
3. Push the check into the array in `GET()`.
4. If you change the response shape, update both
   `lib/external-health-types.ts` and the inline mirror in
   `scripts/validate-external-health-shape.mjs`. Run
   `npm run validate:health-shape` to confirm they match.
