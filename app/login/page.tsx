'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/tools')
    }
  }

  async function handleSignUp() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSignUpSuccess(true)
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #dde1ea',
    borderRadius: '8px',
    fontSize: '15px',
    color: '#1a1a38',
    background: '#fafbfc',
    outline: 'none',
    fontFamily: "'Inter', sans-serif",
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 4px 32px rgba(26,26,56,0.10)',
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
                background: 'linear-gradient(135deg, #21b8bb, #a244ae)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                margin: '0 auto 12px',
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
              color: '#1a1a38',
              margin: '0 0 4px',
            }}
          >
            Automation Lab
          </h1>
          <p
            style={{
              fontSize: '11px',
              color: '#21b8bb',
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
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Sign in to access your tools
          </p>
        </div>

        {signUpSuccess ? (
          <div
            style={{
              background: '#f0fff4',
              border: '1px solid #38a169',
              borderRadius: '8px',
              padding: '16px',
              color: '#276749',
              fontSize: '14px',
              textAlign: 'center',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            ✅ Check your email to confirm your account, then sign in below.
          </div>
        ) : null}

        {/* Email + Password */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
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
                fontFamily: "'Inter', sans-serif",
                background: '#fff5f5',
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                padding: '8px 12px',
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              onClick={handleSignIn}
              disabled={loading || !email || !password}
              style={{
                flex: 1,
                padding: '12px',
                background: 'linear-gradient(135deg, #21b8bb, #a244ae)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: "'Montserrat', sans-serif",
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
                opacity: loading || !email || !password ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <button
              onClick={handleSignUp}
              disabled={loading || !email || !password}
              style={{
                flex: 1,
                padding: '12px',
                background: 'transparent',
                color: '#a244ae',
                border: '1.5px solid #a244ae',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: 700,
                fontFamily: "'Montserrat', sans-serif",
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
                opacity: loading || !email || !password ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loading ? '…' : 'Sign Up'}
            </button>
          </div>
        </div>

        <p
          style={{
            marginTop: '1.5rem',
            textAlign: 'center',
            fontSize: '13px',
            color: '#888',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <Link href="/" style={{ color: '#21b8bb', textDecoration: 'none', fontWeight: 600 }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
