import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { withSecureCookies } from '@/lib/supabase/cookie-options'
import { createServiceClient } from '@/lib/supabase-service'

// [TEMPORARY] HTML escaping for debug page — remove with debug page
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/tools'

  // [DEBUG] Preview auth redirect diagnosis — remove after investigation
  console.log('[callback-debug] request.url:', request.url)
  console.log('[callback-debug] parsed origin:', origin)
  console.log('[callback-debug] next:', next)
  console.log('[callback-debug] code present:', !!code)

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
    console.log('[callback-debug] exchangeCodeForSession:', error ? `FAILED — ${error.message}` : 'SUCCESS')
    if (!error) {
      // Fire-and-forget: log OAuth login activity
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const svc = createServiceClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(svc.from('activity_log') as any).insert({
          event_type: 'login',
          user_email: user.email,
          user_id: user.id,
          metadata: { auth_method: 'google_oauth' },
          user_agent: request.headers.get('user-agent') || null,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        }).then(() => {}).catch((err: unknown) => {
          console.warn('[oauth-callback] Failed to log activity:', err)
        })
      }

      // [TEMPORARY DEBUG] Show debug landing page on preview deployments or when debug=1
      const isPreview = request.headers.get('host')?.includes('vercel.app')
      const isDebug = searchParams.get('debug') === '1'
      if (isPreview || isDebug) {
        const userEmail = user?.email ?? '(not available)'
        const continueUrl = `${origin}${next}`
        const html = `<!DOCTYPE html>
<html><head><title>Auth Callback Debug</title>
<style>body{font-family:monospace;max-width:700px;margin:40px auto;padding:0 20px;background:#1a1a2e;color:#e0e0e0}
h1{color:#00d4ff}table{border-collapse:collapse;width:100%}td{padding:8px 12px;border:1px solid #333}
td:first-child{font-weight:bold;color:#00d4ff;white-space:nowrap}
a{display:inline-block;margin-top:20px;padding:12px 24px;background:#00d4ff;color:#1a1a2e;text-decoration:none;border-radius:6px;font-weight:bold}
a:hover{background:#00b8d9}</style></head>
<body>
<h1>&#x1f50d; Auth Callback Debug</h1>
<p>This page confirms the <strong>preview</strong> callback route was reached.</p>
<table>
<tr><td>Full URL</td><td>${escapeHtml(request.url)}</td></tr>
<tr><td>Origin</td><td>${escapeHtml(origin)}</td></tr>
<tr><td>next</td><td>${escapeHtml(next)}</td></tr>
<tr><td>Code present</td><td>${!!code}</td></tr>
<tr><td>Exchange result</td><td>SUCCESS</td></tr>
<tr><td>User email</td><td>${escapeHtml(userEmail)}</td></tr>
</table>
<a href="${escapeHtml(continueUrl)}">Continue to ${escapeHtml(next)} &rarr;</a>
</body></html>`
        return new Response(html, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // [TEMPORARY DEBUG] Show debug page on error too, for preview/debug
  const isPreviewFail = request.headers.get('host')?.includes('vercel.app')
  const isDebugFail = searchParams.get('debug') === '1'
  if (isPreviewFail || isDebugFail) {
    const errorMsg = code ? 'exchangeCodeForSession failed' : 'no code param present'
    const html = `<!DOCTYPE html>
<html><head><title>Auth Callback Debug (Error)</title>
<style>body{font-family:monospace;max-width:700px;margin:40px auto;padding:0 20px;background:#1a1a2e;color:#e0e0e0}
h1{color:#ff6b6b}table{border-collapse:collapse;width:100%}td{padding:8px 12px;border:1px solid #333}
td:first-child{font-weight:bold;color:#ff6b6b;white-space:nowrap}
a{display:inline-block;margin-top:20px;padding:12px 24px;background:#ff6b6b;color:#1a1a2e;text-decoration:none;border-radius:6px;font-weight:bold}</style></head>
<body>
<h1>&#x274c; Auth Callback Debug (Error)</h1>
<table>
<tr><td>Full URL</td><td>${escapeHtml(request.url)}</td></tr>
<tr><td>Origin</td><td>${escapeHtml(origin)}</td></tr>
<tr><td>next</td><td>${escapeHtml(next)}</td></tr>
<tr><td>Code present</td><td>${!!code}</td></tr>
<tr><td>Error</td><td>${escapeHtml(errorMsg)}</td></tr>
</table>
<a href="${escapeHtml(origin)}/login?error=auth_failed">Back to login &rarr;</a>
</body></html>`
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
