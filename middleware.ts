import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'

// ---------------------------------------------------------------------------
// CSP nonce helpers – defense-in-depth against script injection (SRI + CSP)
// ---------------------------------------------------------------------------

function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const binary = String.fromCharCode(...bytes)
  return btoa(binary)
}

function buildCspHeader(nonce: string): string {
  return [
    `default-src 'self'`,
    // 'nonce-…' lets Next.js inline bootstrap scripts run; 'unsafe-inline' is
    // ignored by browsers that support nonces (CSP Level 2+) but acts as a
    // fallback for older browsers.  'unsafe-eval' is required by Next.js in
    // development; consider removing it in production behind NODE_ENV check.
    `script-src 'self' 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval'`,
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

  // ── RBAC for impact/usage admin ──────────────────────────────────────
  if (user && path.startsWith('/tools/admin')) {
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
