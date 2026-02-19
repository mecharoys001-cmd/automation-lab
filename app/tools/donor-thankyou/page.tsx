'use client';
import { useState, useCallback } from 'react';
import GasToolLayout from '@/components/GasToolLayout';
import GasSetup from '@/components/GasSetup';
import { useGas } from '@/components/useGas';

const ACCENT = '#f97316';
const SK = 'gas-url-donor-thankyou';

const TEMPLATES = {
  standard: 'Dear {{name}},\n\nThank you for your generous donation of {{amount}} on {{date}}. Your support means the world to {{organization}}.\n\nWith gratitude,\n{{organization}}',
  yearEnd: 'Dear {{name}},\n\nAs the year comes to a close, we want to express our heartfelt thanks for your donation of {{amount}}. Your generosity on {{date}} helped make our mission possible.\n\nThis letter serves as your tax receipt. {{organization}} is a registered 501(c)(3) nonprofit.\n\nWarmly,\n{{organization}}',
};

interface Letter { id: string; donorName: string; email: string; amount: number; date: string; content: string; sent: boolean; }

export default function DonorThankyouPage() {
  const [gasUrl, setGasUrl] = useState('');
  const { loading, error, connected, post } = useGas(gasUrl);
  const handleUrlChange = useCallback((url: string) => setGasUrl(url), []);

  const [letters, setLetters] = useState<Letter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState<keyof typeof TEMPLATES>('standard');
  const [org, setOrg] = useState('Our Organization');
  const [form, setForm] = useState({ donorName: '', email: '', amount: '', date: new Date().toISOString().slice(0, 10) });

  function generateLetter() {
    if (!form.donorName || !form.amount) return;
    const content = TEMPLATES[templateKey]
      .replace(/\{\{name\}\}/g, form.donorName)
      .replace(/\{\{amount\}\}/g, `$${parseFloat(form.amount).toFixed(2)}`)
      .replace(/\{\{date\}\}/g, form.date)
      .replace(/\{\{organization\}\}/g, org);

    const letter: Letter = { id: crypto.randomUUID(), ...form, amount: parseFloat(form.amount), content, sent: false };
    if (connected) post({ action: 'generate', ...form, amount: parseFloat(form.amount), template: TEMPLATES[templateKey], organization: org });
    setLetters(l => [letter, ...l]);
    setSelectedId(letter.id);
    setForm(f => ({ ...f, donorName: '', email: '', amount: '' }));
  }

  async function sendLetter(id: string) {
    if (!connected) return;
    const res = await post({ action: 'send', id });
    if (res?.sent) setLetters(l => l.map(x => x.id === id ? { ...x, sent: true } : x));
  }

  const selected = letters.find(l => l.id === selectedId);
  const inpStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '8px 12px', outline: 'none' };

  return (
    <GasToolLayout title="Donor Thank-You Generator" description="Generate personalized thank-you letters for donors using customizable templates. Send via Gmail with one click." icon="💌" accent={ACCENT}>
      <GasSetup storageKey={SK} onUrl={handleUrlChange} connected={connected} />
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left — form + list */}
        <div>
          <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.25rem', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Donor Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <input placeholder="Donor name *" value={form.donorName} onChange={e => setForm(f => ({ ...f, donorName: e.target.value }))} style={inpStyle} />
              <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inpStyle} />
              <input placeholder="Amount ($) *" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={inpStyle} />
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inpStyle} />
              <input placeholder="Organization name" value={org} onChange={e => setOrg(e.target.value)} style={inpStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(k => (
                <button key={k} onClick={() => setTemplateKey(k)}
                  style={{ flex: 1, backgroundColor: templateKey === k ? ACCENT : '#1e293b', color: templateKey === k ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '6px 0' }}>
                  {k === 'standard' ? 'Standard' : 'Year-End'}
                </button>
              ))}
            </div>
            <button onClick={generateLetter} disabled={loading || !form.donorName || !form.amount}
              style={{ width: '100%', backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px', opacity: !form.donorName || !form.amount ? 0.5 : 1 }}>
              {loading ? 'Generating…' : 'Generate Letter'}
            </button>
          </div>

          {letters.length > 0 && (
            <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #1e293b', fontSize: 13, fontWeight: 700 }}>Generated Letters ({letters.length})</div>
              {letters.map(l => (
                <button key={l.id} onClick={() => setSelectedId(l.id)}
                  style={{ width: '100%', backgroundColor: selectedId === l.id ? `${ACCENT}18` : 'transparent', border: 'none', borderBottom: '1px solid #1e293b', cursor: 'pointer', padding: '0.75rem 1rem', textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{l.donorName}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>${l.amount.toFixed(2)} · {l.sent ? '✓ Sent' : 'Not sent'}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right — preview */}
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.25rem', minHeight: 300 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>📄 Preview</span>
            {selected && connected && (
              <button onClick={() => sendLetter(selected.id)} disabled={loading || selected.sent}
                style={{ backgroundColor: selected.sent ? '#1e293b' : ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: selected.sent ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, padding: '6px 14px' }}>
                {selected.sent ? '✓ Sent' : '📧 Send via Gmail'}
              </button>
            )}
          </div>
          {selected
            ? <pre style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap' }}>{selected.content}</pre>
            : <div style={{ color: '#475569', fontSize: 13, paddingTop: '2rem', textAlign: 'center' }}>Generate a letter to preview it here.</div>
          }
        </div>
      </div>
    </GasToolLayout>
  );
}
