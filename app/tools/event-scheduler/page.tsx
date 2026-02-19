'use client';
import { useState, useCallback } from 'react';
import GasToolLayout from '@/components/GasToolLayout';
import GasSetup from '@/components/GasSetup';
import { useGas } from '@/components/useGas';

const ACCENT = '#f59e0b';
const SK = 'gas-url-event-scheduler';

interface Event {
  id: string;
  eventName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  speaker: string;
}

export default function EventSchedulerPage() {
  const [gasUrl, setGasUrl] = useState('');
  const { loading, error, connected, post } = useGas(gasUrl);
  const handleUrlChange = useCallback((url: string) => setGasUrl(url), []);

  const [events, setEvents] = useState<Event[]>([]);
  const [filterDate, setFilterDate] = useState('');
  const [form, setForm] = useState({ eventName: '', date: new Date().toISOString().slice(0, 10), startTime: '', endTime: '', location: '', speaker: '' });

  async function addEvent() {
    if (!form.eventName) return;
    const ev: Event = { id: crypto.randomUUID(), ...form };
    if (connected) {
      const res = await post({ action: 'create', ...form });
      if (res?.id) ev.id = res.id;
    }
    setEvents(e => [...e, ev].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)));
    setForm(f => ({ ...f, eventName: '', startTime: '', endTime: '', location: '', speaker: '' }));
  }

  function removeEvent(id: string) {
    setEvents(e => e.filter(x => x.id !== id));
  }

  const uniqueDates = [...new Set(events.map(e => e.date))].sort();
  const visible = filterDate ? events.filter(e => e.date === filterDate) : events;

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
    <GasToolLayout title="Event Schedule Builder" description="Build and manage event schedules with speaker slots, locations, and times. Filter by date, export to Sheets." icon="🗓️" accent={ACCENT}>
      <GasSetup storageKey={SK} onUrl={handleUrlChange} connected={connected} />
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Events', value: events.length },
          { label: 'Dates', value: uniqueDates.length },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.5rem', marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Add Event</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
          {inp('Event Name *', 'eventName')}
          {inp('Date', 'date', 'date')}
          {inp('Start Time', 'startTime', 'time')}
          {inp('End Time', 'endTime', 'time')}
          {inp('Location', 'location')}
          {inp('Speaker', 'speaker')}
        </div>
        <button
          onClick={addEvent}
          disabled={loading || !form.eventName}
          style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Saving…' : '+ Add Event'}
        </button>
      </div>

      {/* Filter */}
      {uniqueDates.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterDate('')}
            style={{ backgroundColor: !filterDate ? ACCENT : '#111827', color: !filterDate ? '#fff' : '#94a3b8', border: `1px solid ${!filterDate ? ACCENT : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 12px' }}>
            All Dates
          </button>
          {uniqueDates.map(d => (
            <button key={d} onClick={() => setFilterDate(d)}
              style={{ backgroundColor: filterDate === d ? ACCENT : '#111827', color: filterDate === d ? '#fff' : '#94a3b8', border: `1px solid ${filterDate === d ? ACCENT : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 12px' }}>
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Event list */}
      {visible.length > 0 && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
          {visible.map(ev => (
            <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1rem 1.5rem', borderBottom: '1px solid #1e293b', fontSize: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{ev.eventName}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {ev.date}{ev.startTime ? ` · ${ev.startTime}${ev.endTime ? `–${ev.endTime}` : ''}` : ''}
                  {ev.location ? ` · 📍 ${ev.location}` : ''}
                  {ev.speaker ? ` · 🎤 ${ev.speaker}` : ''}
                </div>
              </div>
              <button onClick={() => removeEvent(ev.id)}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: 14 }}>No events scheduled yet.</div>}
    </GasToolLayout>
  );
}
