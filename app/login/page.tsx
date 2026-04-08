'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/tools'

  const [view, setView] = useState<'buttons' | 'email'>('buttons')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setOauthLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          redirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent(next),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'OAuth failed')
        setOauthLoading(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setOauthLoading(false)
    }
  }

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Sign in failed')
        setLoading(false)
      } else {
        // Force a full navigation so freshly-set auth cookies are present on
        // the very first post-login request (especially important on previews).
        window.location.assign(next)
      }
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
        {/* Brand header */}
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
            Automation Lab
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
          <p
            style={{
              marginTop: '10px',
              color: '#555',
              fontSize: '14px',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Sign in to access your tools
          </p>
        </div>

        {view === 'buttons' ? (
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              disabled={oauthLoading || loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '13px',
                border: '1.5px solid #dde1ea',
                borderRadius: '10px',
                background: oauthLoading ? '#f5f5f5' : '#fff',
                color: '#1a1a2e',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: "'Montserrat', sans-serif",
                cursor: oauthLoading ? 'wait' : 'pointer',
                transition: 'border-color 0.2s, box-shadow 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {oauthLoading ? 'Redirecting...' : 'Sign in with Google'}
            </button>

            {/* Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '20px 0',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: '#dde1ea' }} />
              <span style={{ color: '#999', fontSize: '13px', fontFamily: "'Montserrat', sans-serif" }}>
                or
              </span>
              <div style={{ flex: 1, height: '1px', background: '#dde1ea' }} />
            </div>

            {/* Email sign-in button */}
            <button
              onClick={() => { setView('email'); setError(null); }}
              disabled={oauthLoading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '13px',
                border: '1.5px solid #0F7490',
                borderRadius: '10px',
                background: 'transparent',
                color: '#0F7490',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: "'Montserrat', sans-serif",
                cursor: oauthLoading ? 'wait' : 'pointer',
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Log in with Email
            </button>
          </>
        ) : (
          <>
            {/* Back to sign-in options */}
            <button
              onClick={() => { setView('buttons'); setError(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#0F7490',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: "'Montserrat', sans-serif",
                cursor: 'pointer',
                padding: '0 0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ← Back to sign-in options
            </button>

            <p
              style={{
                fontSize: '13px',
                color: '#666',
                margin: '0 0 16px',
                fontFamily: "'Montserrat', sans-serif",
              }}
            >
              Use the email address associated with your organization or tool access.
            </p>

            {/* Email + Password form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
                autoFocus
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
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
                onClick={handleSignIn}
                disabled={loading || !email || !password}
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
                  cursor: loading || !email || !password ? 'wait' : 'pointer',
                  opacity: loading || !email || !password ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                  marginTop: '4px',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <div style={{ textAlign: 'right', marginTop: '2px' }}>
                <Link
                  href="/forgot-password"
                  style={{
                    color: '#0F7490',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    fontFamily: "'Montserrat', sans-serif",
                  }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </>
        )}

        <div
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '13px',
            color: '#888',
            fontFamily: "'Montserrat', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <p style={{ margin: 0 }}>
            Need an account?{' '}
            <Link href="/create-account" style={{ color: '#0F7490', textDecoration: 'none', fontWeight: 600 }}>
              Create one
            </Link>
          </p>
          <p style={{ margin: 0 }}>
            <Link href="/" style={{ color: '#0F7490', textDecoration: 'none', fontWeight: 600 }}>
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
