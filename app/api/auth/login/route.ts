import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'
import { createServiceClient } from '@/lib/supabase-service'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

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

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    // Fire-and-forget: log login activity
    const userAgent = request.headers.get('user-agent') || null
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
    const svc = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(svc.from('activity_log') as any).insert({
      event_type: 'login',
      user_email: email,
      metadata: { auth_method: 'email_password' },
      user_agent: userAgent,
      ip_address: ipAddress,
    }).then(() => {}).catch((err: unknown) => {
      console.warn('[login] Failed to log activity:', err)
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
