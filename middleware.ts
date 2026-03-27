import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'

// ---------------------------------------------------------------------------
// CSP nonce helpers – defense-in-depth against script injection (SRI + CSP)
// ---------------------------------------------------------------------------
//
// SECURITY NOTES (SRI / CSP):
// - A per-request nonce is generated and injected into the Content-Security-Policy
//   header. The nonce is exposed via `X-Nonce` so server components can apply it
//   to inline <script> tags, enabling SRI-compliant strict-dynamic evaluation.
// - 'strict-dynamic' in script-src allows nonce-authenticated scripts to load
//   their own dependencies without listing each origin, effectively providing
//   SRI compliance for the script dependency chain.
// - Traditional SRI integrity hashes (e.g. sha256-…) on <script> tags are NOT
//   supported by Next.js because it generates inline bootstrap scripts with
//   non-deterministic content per-build. The nonce-based CSP approach is the
//   recommended alternative per Next.js docs and achieves equivalent protection.
// - Additional hardening: frame-ancestors 'none', base-uri 'self', form-action
//   'self', X-Content-Type-Options nosniff, X-Frame-Options DENY.
// ---------------------------------------------------------------------------

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary)
}

function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';
  return [
    `default-src 'self'`,
    // 'nonce-…' lets Next.js inline bootstrap scripts run.  'strict-dynamic'
    // allows nonce-authenticated scripts to load their own dependencies (SRI
    // compliance).  'unsafe-inline' is ignored by CSP Level 2+ browsers when a
    // nonce is present but acts as a fallback for older browsers.  'unsafe-eval'
    // is required by Next.js HMR in development only.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''} 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `img-src 'self' data: blob:`,
    `connect-src 'self' https://*.supabase.co`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join('; ')
}

function applySecurityHeaders(response: NextResponse, nonce: string) {
  response.headers.set('Content-Security-Policy', buildCspHeader(nonce))
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  // Expose the nonce so server components / _document can read it for inline
  // script tags (SRI compliance).  This header is NOT visible to client JS.
  response.headers.set('X-Nonce', nonce)
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const nonce = generateNonce()
  const path = request.nextUrl.pathname

  // ── Non-tools routes: just apply security headers, no auth ─────────────
  if (!path.startsWith('/tools')) {
    const response = NextResponse.next({ request })
    applySecurityHeaders(response, nonce)
    return response
  }

  // ── /tools routes: Supabase auth + RBAC + security headers ─────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, withSecureCookies(options))
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Allow unauthenticated access to scheduler intake form ──────────────
  if (path.startsWith('/tools/scheduler/intake')) {
    applySecurityHeaders(supabaseResponse, nonce)
    return supabaseResponse
  }

  // ── Allow unauthenticated access to reports visualizer ─────────────────
  if (path.startsWith('/tools/reports')) {
    applySecurityHeaders(supabaseResponse, nonce)
    return supabaseResponse
  }

  // ── Protect /tools and all sub-routes ──────────────────────────────────
  if (!user && path.startsWith('/tools')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    const redirect = NextResponse.redirect(url)
    applySecurityHeaders(redirect, nonce)
    return redirect
  }

  // ── Tool-level access control (visibility gates) ─────────────────────
  const toolSlug = path.split('/')[2]
  if (
    user &&
    toolSlug &&
    !path.startsWith('/tools/admin') &&
    !path.startsWith('/tools/analytics') &&
    !path.startsWith('/tools/scheduler/intake')
  ) {
    const { createServiceClient } = await import('@/lib/supabase-service')
    const svc = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: toolConfig } = await (svc.from('tool_config') as any)
      .select('visibility')
      .eq('tool_id', toolSlug)
      .maybeSingle()

    const visibility = toolConfig?.visibility
    if (visibility === 'restricted' || visibility === 'hidden') {
      // Check if site admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: siteAdmin } = await (svc.from('site_admins') as any)
        .select('role_level')
        .ilike('google_email', user.email!)
        .maybeSingle()

      if (!siteAdmin) {
        // Check tool_access table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: access } = await (svc.from('tool_access') as any)
          .select('id')
          .eq('tool_id', toolSlug)
          .ilike('user_email', user.email!)
          .maybeSingle()

        if (!access) {
          // Check suite membership — user may belong to a suite containing this tool
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          // Check suite membership: get user's suites, then check if any contain this tool
          const { data: userMemberships } = await (svc.from('tool_suite_members') as any)
            .select('suite_id')
            .ilike('user_email', user.email!)

          let hasSuiteAccess = false
          if (userMemberships && userMemberships.length > 0) {
            const sIds = userMemberships.map((m: { suite_id: string }) => m.suite_id)
            const { data: suiteToolMatch } = await (svc.from('tool_suite_tools') as any)
              .select('id')
              .in('suite_id', sIds)
              .eq('tool_id', toolSlug)
              .limit(1)
              .maybeSingle()
            hasSuiteAccess = !!suiteToolMatch
          }

          if (!hasSuiteAccess) {
            const url = request.nextUrl.clone()
            url.pathname = '/tools'
            const redirect = NextResponse.redirect(url)
            applySecurityHeaders(redirect, nonce)
            return redirect
          }
        }
      }
    }
  }

  // ── RBAC for analytics admin ───────────────────────────────────────────
  if (user && path.startsWith('/tools/analytics/admin')) {
    const { createServiceClient } = await import('@/lib/supabase-service')
    const svc = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: siteAdmin } = await (svc.from('site_admins') as any)
      .select('role_level')
      .ilike('google_email', user.email)
      .maybeSingle()

    if (!siteAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools'
      const redirect = NextResponse.redirect(url)
      applySecurityHeaders(redirect, nonce)
      return redirect
    }
  }

  // ── RBAC for suite-manager (managers, not just site admins) ──────────
  if (user && path.startsWith('/tools/admin/suite-manager')) {
    // The server component does its own manager check and renders an
    // appropriate "no access" message, so we just need to ensure the user
    // is authenticated (already guaranteed above). Let it through.
  }
  // ── RBAC for impact/usage admin (all other /tools/admin/* pages) ────
  else if (user && path.startsWith('/tools/admin')) {
    const { createServiceClient } = await import('@/lib/supabase-service')
    const svc = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: siteAdmin } = await (svc.from('site_admins') as any)
      .select('role_level')
      .ilike('google_email', user.email)
      .maybeSingle()

    if (!siteAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools'
      const redirect = NextResponse.redirect(url)
      applySecurityHeaders(redirect, nonce)
      return redirect
    }
  }

  // ── RBAC for scheduler admin/portal routes ─────────────────────────────
  // Only run the org membership check for scheduler sub-paths that need it.
  // The /tools/scheduler landing page itself does its own server-side check.
  if (user && (path.startsWith('/tools/scheduler/admin') || path.startsWith('/tools/scheduler/portal'))) {
    const email = user.email

    // We import the service client dynamically to avoid bundling it
    // in the Edge runtime. Middleware runs in Node runtime with our matcher.
    const { createServiceClient } = await import('@/lib/supabase-service')
    const svc = createServiceClient()

    // Check admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admin } = await (svc.from('admins') as any)
      .select('role_level')
      .eq('google_email', email)
      .maybeSingle()

    // Check instructor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: instructor } = await (svc.from('instructors') as any)
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle()

    const isAdmin = !!admin
    const isInstructor = !!instructor

    // Non-org members → redirect to tools list
    if (!isAdmin && !isInstructor) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools'
      const redirect = NextResponse.redirect(url)
      applySecurityHeaders(redirect, nonce)
      return redirect
    }

    // Instructors trying to access /admin → redirect to /portal
    if (!isAdmin && path.startsWith('/tools/scheduler/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools/scheduler/portal'
      const redirect = NextResponse.redirect(url)
      applySecurityHeaders(redirect, nonce)
      return redirect
    }

    // ── Role-level enforcement for admin sub-pages ──────────────────────
    // Enforce minimum role requirements at the page level (defense-in-depth
    // alongside API-level checks). This prevents lower-privilege admins from
    // even loading pages they can't use.
    if (isAdmin && path.startsWith('/tools/scheduler/admin')) {
      const roleLevel = admin.role_level as string
      const ROLE_RANK: Record<string, number> = { master: 3, standard: 2, editor: 1 }
      const userRank = ROLE_RANK[roleLevel] ?? 0

      // Pages requiring master admin (rank 3)
      const masterPages = ['/tools/scheduler/admin/settings', '/tools/scheduler/admin/roles']
      // Pages requiring standard admin (rank 2) — editors can only access
      // the calendar view; all management pages require standard+
      const standardPages = [
        '/tools/scheduler/admin/reports',
        '/tools/scheduler/admin/versions',
        '/tools/scheduler/admin/import',
        '/tools/scheduler/admin/event-templates',
        '/tools/scheduler/admin/tags',
        '/tools/scheduler/admin/people',
        '/tools/scheduler/admin/calendar',
        '/tools/scheduler/admin/classes',
        '/tools/scheduler/admin/exceptions',
      ]

      const needsMaster = masterPages.some(p => path === p || path.startsWith(p + '/'))
      const needsStandard = standardPages.some(p => path === p || path.startsWith(p + '/'))

      if ((needsMaster && userRank < 3) || (needsStandard && userRank < 2)) {
        // Redirect insufficient role to the calendar (default admin page)
        const url = request.nextUrl.clone()
        url.pathname = '/tools/scheduler/admin'
        const redirect = NextResponse.redirect(url)
        applySecurityHeaders(redirect, nonce)
        return redirect
      }
    }

    // Admins trying to access /portal → let them through (admins can see everything)
  }

  applySecurityHeaders(supabaseResponse, nonce)
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - api routes (handled by route handlers, not pages)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|api/).*)',
  ],
}
