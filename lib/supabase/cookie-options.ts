import type { CookieOptions } from '@supabase/ssr'

/**
 * Secure defaults merged into every Supabase auth cookie.
 * httpOnly prevents JavaScript access (XSS mitigation).
 * secure ensures cookies are only sent over HTTPS.
 * sameSite='lax' prevents CSRF while allowing top-level navigations.
 */
export const secureCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

/** Merge caller-provided options with our secure defaults. */
export function withSecureCookies(options?: CookieOptions): CookieOptions {
  return { ...secureCookieOptions, ...options, httpOnly: true }
}
