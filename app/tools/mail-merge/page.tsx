'use client';
import { useState, useCallback } from 'react';
import GasToolLayout from '@/components/GasToolLayout';
import GasSetup from '@/components/GasSetup';
import { useGas } from '@/components/useGas';

const ACCENT = '#ec4899';
const SK = 'gas-url-mail-merge';

const DEFAULT_TEMPLATE = 'Dear {{Name}},\n\nThank you for your support, {{Name}}. We are excited to update you on our progress.\n\nBest regards,\nThe Team';

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

function mergeRow(template: string, row: Record<string, string>): string {
  return Object.entries(row).reduce((t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v), template);
}

export default function MailMergePage() {
  const [gasUrl, setGasUrl] = useState('');
  const { loading, error, connected, post } = useGas(gasUrl);
  const handleUrlChange = useCallback((url: string) => setGasUrl(url), []);

  const [csvText, setCsvText] = useState('Name,Email\nJane Smith,jane@example.com\nJohn Doe,john@example.com');
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sendResult, setSendResult] = useState('');

  const rows = parseCSV(csvText);
  const merged = rows.map(r => mergeRow(template, r));
  const preview = merged[previewIdx] || '';
  const fields = [...new Set((template.match(/\{\{(\w+)\}\}/g) || []).map(m => m.slice(2, -2)))];

  function copyPreview() {
    navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendAll() {
    if (!connected || rows.length === 0) return;
    const res = await post({ action: 'send', template, subject: 'Message from Automation Lab', rows });
    if (res) setSendResult(`✓ Sent ${res.sentCount} emails`);
  }

  return (
    <GasToolLayout title="Mail Merge Preview" description="Write a {{field}} template and preview it merged with your contact list. Send via Gmail through Apps Script." icon="✉️" accent={ACCENT}>
      <GasSetup storageKey={SK} onUrl={handleUrlChange} connected={connected} />
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}
      {sendResult && <div style={{ color: '#10b981', fontSize: 13, marginBottom: 12 }}>✓ {sendResult}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>📋 Contact Data (CSV)</label>
            <span style={{ fontSize: 11, color: '#64748b' }}>{rows.length} rows · columns: {rows[0] ? Object.keys(rows[0]).join(', ') : '–'}</span>
          </div>
          <textarea
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            rows={8}
            style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, padding: '10px 12px', outline: 'none', resize: 'vertical' }}
          />
        </div>

        {/* Template */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>✏️ Template</label>
            {fields.length > 0 && <span style={{ fontSize: 11, color: ACCENT }}>Fields: {fields.join(', ')}</span>}
          </div>
          <textarea
            value={template}
            onChange={e => setTemplate(e.target.value)}
            rows={8}
            style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, padding: '10px 12px', outline: 'none', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.25rem', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>👁 Preview</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {rows.map((_, i) => (
                  <button key={i} onClick={() => setPreviewIdx(i)}
                    style={{ backgroundColor: i === previewIdx ? ACCENT : '#1e293b', color: i === previewIdx ? '#fff' : '#94a3b8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '3px 8px' }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={copyPreview}
              style={{ backgroundColor: copied ? '#10b981' : '#1e293b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '6px 14px' }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <pre style={{ color: '#e2e8f0', fontSize: 13, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{preview}</pre>
        </div>
      )}

      {connected && rows.length > 0 && (
        <button onClick={sendAll} disabled={loading}
          style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Sending…' : `📧 Send to ${rows.length} recipients via Gmail`}
        </button>
      )}

      {rows.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: '#475569', fontSize: 14 }}>Paste CSV data above to get started.</div>}
    </GasToolLayout>
  );
}
