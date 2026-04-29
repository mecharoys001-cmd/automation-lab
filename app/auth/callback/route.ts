import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'
import { createServiceClient } from '@/lib/supabase-service'

function safeNext(raw: string | null): string {
  if (!raw) return '/tools'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/tools'
  return raw
}

function expiredLinkRedirect(origin: string, next: string) {
  const target = next === '/reset-password' ? '/reset-password' : '/forgot-password'
  return NextResponse.redirect(`${origin}${target}?error=expired_link`)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const type = searchParams.get('type')
  const errorParam = searchParams.get('error')
  const errorCode = searchParams.get('error_code')

  // Supabase forwards expired/invalid recovery links here with error params and no code.
  if (!code && (errorParam || errorCode)) {
    return expiredLinkRedirect(origin, next)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, withSecureCookies(options))
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Fire-and-forget: log OAuth/recovery login activity
      const authMethod = type === 'recovery' || next === '/reset-password' ? 'password_recovery' : 'google_oauth'
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          const svc = createServiceClient()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(svc.from('activity_log') as any).insert({
            event_type: 'login',
            user_email: user.email,
            user_id: user.id,
            metadata: { auth_method: authMethod },
            user_agent: request.headers.get('user-agent') || null,
            ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          }).then(() => {}).catch((err: unknown) => {
            console.warn('[oauth-callback] Failed to log activity:', err)
          })
        }
      }).catch(() => {})
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Code exchange failed — likely an expired or already-used recovery link.
    return expiredLinkRedirect(origin, next)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
