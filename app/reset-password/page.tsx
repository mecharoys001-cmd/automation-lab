'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryError = searchParams.get('error')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        if (cancelled) return
        const data = await res.json().catch(() => ({}))
        setHasSession(!!data?.authenticated)
      } catch {
        if (!cancelled) setHasSession(false)
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit() {
    setError(null)

    if (!password || !confirmPassword) {
      setError('Please enter and confirm your new password.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'We could not update your password. Please try again.')
        setLoading(false)
        return
      }
      setSuccess(true)
      setLoading(false)
      setTimeout(() => router.push('/login'), 1500)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #dde1ea',
    borderRadius: '8px',
    fontSize: '15px',
    color: '#1a1a2e',
    background: '#fafbfc',
    outline: 'none',
    fontFamily: "'Montserrat', sans-serif",
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 24px rgba(0,0,0,0.08)',
          padding: '2.5rem 2rem',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-block' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                background: '#0F7490',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                margin: '0 auto 12px',
                color: '#fff',
              }}
            >
              ⚡
            </div>
          </Link>
          <h1
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 800,
              fontSize: '22px',
              color: '#1a1a2e',
              margin: '0 0 4px',
            }}
          >
            Set a New Password
          </h1>
          <p
            style={{
              fontSize: '11px',
              color: '#0F7490',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontWeight: 600,
              margin: 0,
            }}
          >
            NWCT Arts Council
          </p>
        </div>

        {checkingSession ? (
          <p
            style={{
              textAlign: 'center',
              color: '#666',
              fontSize: '14px',
              margin: 0,
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Verifying your reset link...
          </p>
        ) : !hasSession ? (
          <div
            style={{
              background: '#fff5f5',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              padding: '20px 16px',
              color: '#9b2226',
              fontSize: '14px',
              textAlign: 'center',
              fontFamily: "'Montserrat', sans-serif",
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: '0 0 12px', fontWeight: 700 }}>
              {queryError === 'expired_link'
                ? 'That reset link has expired.'
                : 'Your reset link is invalid or has expired.'}
            </p>
            <p style={{ margin: '0 0 12px' }}>Please request a new password reset email.</p>
            <Link
              href="/forgot-password"
              style={{
                display: 'inline-block',
                padding: '10px 16px',
                background: '#0F7490',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Request a new link
            </Link>
          </div>
        ) : success ? (
          <div
            style={{
              background: '#f0fff4',
              border: '1px solid #38a169',
              borderRadius: '8px',
              padding: '20px 16px',
              color: '#276749',
              fontSize: '14px',
              textAlign: 'center',
              fontFamily: "'Montserrat', sans-serif",
              lineHeight: 1.6,
            }}
          >
            Password updated. Redirecting to sign in...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p
              style={{
                fontSize: '13px',
                color: '#666',
                margin: '0 0 4px',
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Enter a new password for your account.
            </p>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              disabled={loading}
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />

            {error && (
              <p
                style={{
                  color: '#c0392b',
                  fontSize: '13px',
                  margin: 0,
                  fontFamily: "'Montserrat', sans-serif",
                  background: '#fff5f5',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  padding: '8px 12px',
                }}
              >
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || !password || !confirmPassword}
              style={{
                width: '100%',
                padding: '12px',
                background: '#0F7490',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: "'Montserrat', sans-serif",
                cursor: loading || !password || !confirmPassword ? 'wait' : 'pointer',
                opacity: loading || !password || !confirmPassword ? 0.7 : 1,
                transition: 'opacity 0.2s',
                marginTop: '4px',
              }}
            >
              {loading ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        )}

        <p
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '13px',
            color: '#888',
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          <Link href="/login" style={{ color: '#0F7490', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Loading...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
