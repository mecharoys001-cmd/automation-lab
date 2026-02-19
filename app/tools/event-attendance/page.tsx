'use client';
import { useState, useCallback } from 'react';
import GasToolLayout from '@/components/GasToolLayout';
import GasSetup from '@/components/GasSetup';
import { useGas } from '@/components/useGas';

const ACCENT = '#14b8a6';
const SK = 'gas-url-event-attendance';

interface Person { id: string; name: string; email: string; }

interface Stats {
  totalRegistered: number;
  totalCheckedIn: number;
  attended: number;
  noShows: Person[];
  walkIns: Person[];
  attendanceRate: string;
}

export default function EventAttendancePage() {
  const [gasUrl, setGasUrl] = useState('');
  const { loading, error, connected, post } = useGas(gasUrl);
  const handleUrlChange = useCallback((url: string) => setGasUrl(url), []);

  const [tab, setTab] = useState<'registrations' | 'checkins'>('registrations');
  const [registrations, setRegistrations] = useState<Person[]>([]);
  const [checkins, setCheckins] = useState<Person[]>([]);
  const [regForm, setRegForm] = useState({ name: '', email: '' });
  const [checkForm, setCheckForm] = useState({ name: '', email: '' });
  const [stats, setStats] = useState<Stats | null>(null);

  function addReg() {
    if (!regForm.name) return;
    const p: Person = { id: crypto.randomUUID(), ...regForm };
    if (connected) post({ action: 'register', ...regForm, event: 'default' });
    setRegistrations(r => [...r, p]);
    setRegForm({ name: '', email: '' });
    setStats(null);
  }

  function addCheckin() {
    if (!checkForm.name) return;
    const p: Person = { id: crypto.randomUUID(), ...checkForm };
    if (connected) post({ action: 'checkin', ...checkForm, event: 'default' });
    setCheckins(c => [...c, p]);
    setCheckForm({ name: '', email: '' });
    setStats(null);
  }

  function compare() {
    const normalize = (s: string) => s.trim().toLowerCase();
    const regEmails = new Set(registrations.map(r => normalize(r.email)));
    const checkEmails = new Set(checkins.map(c => normalize(c.email)));
    const attended = registrations.filter(r => checkEmails.has(normalize(r.email)));
    const noShows = registrations.filter(r => !checkEmails.has(normalize(r.email)));
    const walkIns = checkins.filter(c => !regEmails.has(normalize(c.email)));
    setStats({
      totalRegistered: registrations.length,
      totalCheckedIn: checkins.length,
      attended: attended.length,
      noShows,
      walkIns,
      attendanceRate: registrations.length ? ((attended.length / registrations.length) * 100).toFixed(1) + '%' : '0%',
    });
  }

  const inpStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '8px 12px', outline: 'none' };

  const PersonForm = ({ form, setForm, onAdd, label }: { form: { name: string; email: string }; setForm: (f: { name: string; email: string }) => void; onAdd: () => void; label: string }) => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inpStyle, flex: 1, minWidth: 140 }} />
      <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ ...inpStyle, flex: 1, minWidth: 180 }} />
      <button onClick={onAdd} disabled={!form.name}
        style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '8px 16px', whiteSpace: 'nowrap' }}>
        + {label}
      </button>
    </div>
  );

  return (
    <GasToolLayout title="Event Attendance Checker" description="Compare your registration list against check-ins to instantly see who showed up, who didn't, and who walked in." icon="✅" accent={ACCENT}>
      <GasSetup storageKey={SK} onUrl={handleUrlChange} connected={connected} />
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['registrations', 'checkins'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ backgroundColor: tab === t ? ACCENT : '#111827', color: tab === t ? '#fff' : '#94a3b8', border: `1px solid ${tab === t ? ACCENT : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 16px' }}>
            {t === 'registrations' ? `📝 Registrations (${registrations.length})` : `✅ Check-ins (${checkins.length})`}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.25rem', marginBottom: 20 }}>
        {tab === 'registrations' ? (
          <>
            <PersonForm form={regForm} setForm={setRegForm} onAdd={addReg} label="Register" />
            {registrations.map(r => (
              <div key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid #1e293b', fontSize: 13, color: '#94a3b8' }}>
                <strong style={{ color: '#e2e8f0' }}>{r.name}</strong> {r.email && `· ${r.email}`}
              </div>
            ))}
            {registrations.length === 0 && <div style={{ fontSize: 13, color: '#475569' }}>No registrations yet.</div>}
          </>
        ) : (
          <>
            <PersonForm form={checkForm} setForm={setCheckForm} onAdd={addCheckin} label="Check In" />
            {checkins.map(c => (
              <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid #1e293b', fontSize: 13, color: '#94a3b8' }}>
                <strong style={{ color: '#e2e8f0' }}>{c.name}</strong> {c.email && `· ${c.email}`}
              </div>
            ))}
            {checkins.length === 0 && <div style={{ fontSize: 13, color: '#475569' }}>No check-ins yet.</div>}
          </>
        )}
      </div>

      <button onClick={compare} disabled={loading || registrations.length === 0}
        style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px', marginBottom: 20, opacity: registrations.length === 0 ? 0.4 : 1 }}>
        Compare Attendance →
      </button>

      {stats && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.5rem' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Results</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Registered', value: stats.totalRegistered },
              { label: 'Attended', value: stats.attended, color: '#10b981' },
              { label: 'No-Shows', value: stats.noShows.length, color: '#f87171' },
              { label: 'Walk-ins', value: stats.walkIns.length, color: '#f59e0b' },
              { label: 'Rate', value: stats.attendanceRate, color: ACCENT },
            ].map(s => (
              <div key={s.label} style={{ backgroundColor: '#0f172a', borderRadius: 10, padding: '0.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color || '#e2e8f0' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {stats.noShows.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>No-Shows</div>
              {stats.noShows.map(p => <div key={p.id} style={{ fontSize: 12, color: '#94a3b8', padding: '2px 0' }}>{p.name} {p.email && `(${p.email})`}</div>)}
            </div>
          )}
          {stats.walkIns.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>Walk-ins</div>
              {stats.walkIns.map(p => <div key={p.id} style={{ fontSize: 12, color: '#94a3b8', padding: '2px 0' }}>{p.name} {p.email && `(${p.email})`}</div>)}
            </div>
          )}
        </div>
      )}
    </GasToolLayout>
  );
}
