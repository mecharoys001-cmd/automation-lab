'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function CreateAccountPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    setError(null)

    if (!email || !password || !confirmPassword) {
      setError('All fields are required.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          redirectTo: window.location.origin + '/auth/callback?next=' + encodeURIComponent('/login'),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Sign up failed')
        setLoading(false)
      } else {
        setSuccess(true)
        setLoading(false)
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
            Create Account
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

        {success ? (
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
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Check your email to verify your account.</p>
            <p style={{ margin: 0 }}>Once verified, return here to sign in.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              disabled={loading}
              autoFocus
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Confirm password"
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
              disabled={loading || !email || !password || !confirmPassword}
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
                cursor: loading || !email || !password || !confirmPassword ? 'wait' : 'pointer',
                opacity: loading || !email || !password || !confirmPassword ? 0.7 : 1,
                transition: 'opacity 0.2s',
                marginTop: '4px',
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
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
