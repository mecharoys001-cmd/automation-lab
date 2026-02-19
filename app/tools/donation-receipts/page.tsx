'use client';
import { useState, useCallback } from 'react';
import GasToolLayout from '@/components/GasToolLayout';
import GasSetup from '@/components/GasSetup';
import { useGas } from '@/components/useGas';

const ACCENT = '#10b981';
const SK = 'gas-url-donation-receipts';

interface Receipt {
  id: string;
  donorName: string;
  donorEmail: string;
  amount: number;
  purpose: string;
  date: string;
  receiptNumber: string;
}

function genReceiptNum() {
  return `RCP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function DonationReceiptsPage() {
  const [gasUrl, setGasUrl] = useState('');
  const { loading, error, connected, post } = useGas(gasUrl);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [form, setForm] = useState({ donorName: '', donorEmail: '', amount: '', purpose: '', date: new Date().toISOString().slice(0, 10) });

  const handleUrlChange = useCallback((url: string) => setGasUrl(url), []);

  async function addReceipt() {
    if (!form.donorName || !form.amount) return;
    const receiptNumber = genReceiptNum();
    const newReceipt: Receipt = {
      id: crypto.randomUUID(),
      ...form,
      amount: parseFloat(form.amount),
      receiptNumber,
    };
    if (connected) {
      const res = await post({ action: 'create', ...form, amount: parseFloat(form.amount) });
      if (res) newReceipt.receiptNumber = res.receiptNumber;
    }
    setReceipts(r => [newReceipt, ...r]);
    setForm(f => ({ ...f, donorName: '', donorEmail: '', amount: '', purpose: '' }));
  }

  const totalAmount = receipts.reduce((s, r) => s + r.amount, 0);

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
    <GasToolLayout title="Donation Receipt Generator" description="Generate and track tax-deductible donation receipts with auto-numbered IDs. Syncs to Google Sheets via Apps Script — or runs offline locally." icon="🧾" accent={ACCENT}>
      <GasSetup storageKey={SK} onUrl={handleUrlChange} connected={connected} />

      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Receipts', value: receipts.length },
          { label: 'Total Raised', value: `$${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.5rem', marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Add Donation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {inp('Donor Name *', 'donorName')}
          {inp('Donor Email', 'donorEmail', 'email')}
          {inp('Amount ($) *', 'amount', 'number')}
          {inp('Purpose', 'purpose')}
          {inp('Date', 'date', 'date')}
        </div>
        <button
          onClick={addReceipt}
          disabled={loading || !form.donorName || !form.amount}
          style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Saving…' : '+ Generate Receipt'}
        </button>
      </div>

      {/* Receipt list */}
      {receipts.length > 0 && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #1e293b', fontSize: 14, fontWeight: 700 }}>Receipts ({receipts.length})</div>
          {receipts.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1.5rem', borderBottom: '1px solid #1e293b', fontSize: 14 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{r.donorName}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{r.receiptNumber} · {r.date}</div>
              </div>
              <div style={{ color: ACCENT, fontWeight: 700 }}>${r.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}

      {receipts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: 14 }}>No receipts yet — add a donation above.</div>
      )}
    </GasToolLayout>
  );
}
