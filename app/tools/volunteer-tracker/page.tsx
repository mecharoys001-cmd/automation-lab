'use client';
import { useState, useCallback } from 'react';
import GasToolLayout from '@/components/GasToolLayout';
import GasSetup from '@/components/GasSetup';
import { useGas } from '@/components/useGas';

const ACCENT = '#6366f1';
const SK = 'gas-url-volunteer-tracker';

interface Entry {
  id: string;
  volunteerName: string;
  email: string;
  hours: number;
  activity: string;
  date: string;
}

interface LeaderEntry { name: string; hours: number; }

export default function VolunteerTrackerPage() {
  const [gasUrl, setGasUrl] = useState('');
  const { loading, error, connected, post } = useGas(gasUrl);
  const handleUrlChange = useCallback((url: string) => setGasUrl(url), []);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState({ volunteerName: '', email: '', hours: '', activity: '', date: new Date().toISOString().slice(0, 10) });
  const [view, setView] = useState<'log' | 'leaderboard'>('log');

  async function addEntry() {
    if (!form.volunteerName || !form.hours) return;
    const entry: Entry = {
      id: crypto.randomUUID(),
      ...form,
      hours: parseFloat(form.hours),
    };
    if (connected) {
      const res = await post({ action: 'create', ...form, hours: parseFloat(form.hours) });
      if (res?.id) entry.id = res.id;
    }
    setEntries(e => [entry, ...e]);
    setForm(f => ({ ...f, volunteerName: '', email: '', hours: '', activity: '' }));
  }

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const uniqueVolunteers = new Set(entries.map(e => e.volunteerName)).size;

  const leaderboard: LeaderEntry[] = Object.entries(
    entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.volunteerName] = (acc[e.volunteerName] || 0) + e.hours;
      return acc;
    }, {})
  ).map(([name, hours]) => ({ name, hours })).sort((a, b) => b.hours - a.hours);

  const inp = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '8px 12px', outline: 'none' }}
      />
    </div>
  );

  return (
    <GasToolLayout title="Volunteer Hour Tracker" description="Log volunteer hours by activity and date. Tracks totals per volunteer, shows a leaderboard, and syncs to Google Sheets." icon="🙌" accent={ACCENT}>
      <GasSetup storageKey={SK} onUrl={handleUrlChange} connected={connected} />
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Hours', value: totalHours.toFixed(1) },
          { label: 'Volunteers', value: uniqueVolunteers },
          { label: 'Log Entries', value: entries.length },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.5rem', marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Log Hours</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {inp('Volunteer Name *', 'volunteerName')}
          {inp('Email', 'email', 'email')}
          {inp('Hours *', 'hours', 'number')}
          {inp('Activity', 'activity')}
          {inp('Date', 'date', 'date')}
        </div>
        <button
          onClick={addEntry}
          disabled={loading || !form.volunteerName || !form.hours}
          style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Saving…' : '+ Log Hours'}
        </button>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['log', 'leaderboard'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{ backgroundColor: view === v ? ACCENT : '#111827', color: view === v ? '#fff' : '#94a3b8', border: `1px solid ${view === v ? ACCENT : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 16px' }}>
            {v === 'log' ? '📋 Log' : '🏆 Leaderboard'}
          </button>
        ))}
      </div>

      {/* Views */}
      {view === 'log' && entries.length > 0 && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
          {entries.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.875rem 1.5rem', borderBottom: '1px solid #1e293b', fontSize: 14 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{e.volunteerName}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{e.activity || 'General'} · {e.date}</div>
              </div>
              <div style={{ color: ACCENT, fontWeight: 700 }}>{e.hours}h</div>
            </div>
          ))}
        </div>
      )}

      {view === 'leaderboard' && leaderboard.length > 0 && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
          {leaderboard.map((e, i) => (
            <div key={e.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.5rem', borderBottom: '1px solid #1e293b', fontSize: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 16 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                <span style={{ fontWeight: 600 }}>{e.name}</span>
              </div>
              <span style={{ color: ACCENT, fontWeight: 700 }}>{e.hours.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: 14 }}>No hours logged yet.</div>}
    </GasToolLayout>
  );
}
