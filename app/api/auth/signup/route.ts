import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'
import { normalizeEmail, mapAuthError } from '@/lib/auth-errors'

export async function POST(request: Request) {
  try {
    const { email, password, redirectTo } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const normalizedEmail = normalizeEmail(email)

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

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      return NextResponse.json({ error: mapAuthError(error.message, 'signup') }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
