import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { mapAuthError } from '@/lib/auth-errors'

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'A new password is required.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Your reset link is invalid or has expired.' }, { status: 401 })
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return NextResponse.json({ error: mapAuthError(error.message, 'forgot-password') }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'We could not update your password. Please try again.' }, { status: 500 })
  }
}
