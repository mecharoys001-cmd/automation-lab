import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'

export async function middleware(request: NextRequest) {
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

  const path = request.nextUrl.pathname

  // ── Allow unauthenticated access to scheduler intake form ──────────────
  if (path.startsWith('/tools/scheduler/intake')) {
    return supabaseResponse
  }

  // ── Allow unauthenticated access to reports visualizer ─────────────────
  if (path.startsWith('/tools/reports')) {
    return supabaseResponse
  }

  // ── Protect /tools and all sub-routes ──────────────────────────────────
  if (!user && path.startsWith('/tools')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // ── RBAC for analytics admin ───────────────────────────────────────────
  if (user && path.startsWith('/tools/analytics/admin')) {
    const { createServiceClient } = await import('@/lib/supabase-service')
    const svc = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admin } = await (svc.from('admins') as any)
      .select('role_level')
      .eq('google_email', user.email)
      .maybeSingle()

    if (!admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools'
      return NextResponse.redirect(url)
    }
  }

  // ── RBAC for impact/usage admin ──────────────────────────────────────
  if (user && path.startsWith('/tools/admin')) {
    const { createServiceClient } = await import('@/lib/supabase-service')
    const svc = createServiceClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admin } = await (svc.from('admins') as any)
      .select('role_level')
      .eq('google_email', user.email)
      .maybeSingle()

    if (!admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools'
      return NextResponse.redirect(url)
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
      return NextResponse.redirect(url)
    }

    // Instructors trying to access /admin → redirect to /portal
    if (!isAdmin && path.startsWith('/tools/scheduler/admin')) {
      const url = request.nextUrl.clone()
      url.pathname = '/tools/scheduler/portal'
      return NextResponse.redirect(url)
    }

    // Admins trying to access /portal → let them through (admins can see everything)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/tools', '/tools/:path*'],
}
