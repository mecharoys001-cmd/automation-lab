export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function mapAuthError(message: string, mode: 'login' | 'signup' | 'forgot-password'): string {
  const text = message.toLowerCase()

  if (text.includes('invalid login credentials')) return 'That email/password combination did not work.'
  if (text.includes('email not confirmed')) return 'Please verify your email before signing in. Check your inbox.'
  if (text.includes('user already registered')) return 'An account already exists for this email. Try signing in instead.'
  if (text.includes('password should be at least')) return 'Your password needs to meet the minimum length requirement.'

  if (mode === 'forgot-password') return 'We could not start a password reset right now. Please try again.'
  if (mode === 'signup') return 'We could not create your account right now. Please try again.'
  return 'We could not sign you in right now. Please try again.'
}
