'use client';
import { useState, useEffect } from 'react';

interface GasSetupProps {
  storageKey: string;
  onUrl: (url: string) => void;
  connected: boolean;
}

export default function GasSetup({ storageKey, onUrl, connected }: GasSetupProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(storageKey) || '';
    setInput(saved);
    if (saved) onUrl(saved);
  }, [storageKey, onUrl]);

  function handleConnect() {
    localStorage.setItem(storageKey, input);
    onUrl(input);
    setOpen(false);
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: open ? '1rem' : 0 }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '5px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 600,
            backgroundColor: connected ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
            color: connected ? '#10b981' : '#f59e0b',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
          }}
        >
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            backgroundColor: connected ? '#10b981' : '#f59e0b',
            display: 'inline-block',
          }} />
          {connected ? 'Connected to Google Sheets' : 'Offline mode — data saves locally'}
        </span>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: 'none', border: '1px solid #1e293b', borderRadius: '8px',
            color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: '4px 10px',
          }}
        >
          ⚙️ {open ? 'Hide' : 'Connect Google Sheet'}
        </button>
      </div>

      {open && (
        <div style={{
          backgroundColor: '#111827', border: '1px solid #1e293b',
          borderRadius: '12px', padding: '1.25rem', marginTop: '0.75rem',
        }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '0.75rem' }}>
            Paste your Google Apps Script web app URL to sync data to Google Sheets.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="https://script.google.com/macros/s/..."
              style={{
                flex: 1, backgroundColor: '#0f172a', border: '1px solid #1e293b',
                borderRadius: '8px', color: '#e2e8f0', fontSize: '13px',
                padding: '8px 12px', outline: 'none',
              }}
            />
            <button
              onClick={handleConnect}
              style={{
                backgroundColor: '#21b8bb', color: '#fff', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                fontWeight: 600, padding: '8px 16px',
              }}
            >
              Connect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
