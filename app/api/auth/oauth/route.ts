import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'

export async function POST(request: Request) {
  try {
    const { provider, redirectTo } = await request.json()

    // [DEBUG] Preview auth redirect diagnosis — remove after investigation
    const incomingOrigin = request.headers.get('origin') || request.headers.get('referer') || '(none)'
    console.log('[oauth-debug] incoming origin:', incomingOrigin)
    console.log('[oauth-debug] redirectTo from client:', redirectTo)

    if (!provider) {
      return NextResponse.json({ error: 'Provider is required' }, { status: 400 })
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

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    })

    // [DEBUG] Log the OAuth URL supabase returned
    console.log('[oauth-debug] supabase OAuth URL:', data.url)

    if (error) {
      console.warn('[oauth-debug] supabase OAuth error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ url: data.url })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
