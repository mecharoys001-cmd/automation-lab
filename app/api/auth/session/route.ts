import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/session
 * Lightweight check for whether the request has a valid Supabase session.
 * Unlike /api/auth/me, this does not require the user to have an admin or
 * staff profile — useful during password recovery before a profile is linked.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    return NextResponse.json({ authenticated: !!user, email: user?.email ?? null })
  } catch {
    return NextResponse.json({ authenticated: false, email: null })
  }
}
