import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'
import { normalizeEmail } from '@/lib/auth-errors'

export async function POST(request: Request) {
  try {
    const { email, redirectTo } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
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

    await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo,
    })

    // Always return success to avoid leaking account existence
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'We could not start a password reset right now. Please try again.' }, { status: 500 })
  }
}
