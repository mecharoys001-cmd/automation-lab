'use client';
import { useState, useCallback } from 'react';
import GasToolLayout from '@/components/GasToolLayout';
import GasSetup from '@/components/GasSetup';
import { useGas } from '@/components/useGas';

const ACCENT = '#8b5cf6';
const SK = 'gas-url-budget-tracker';

interface BudgetEntry {
  id: string;
  category: string;
  budgetAmount: number;
  actualAmount: number;
  period: string;
  notes: string;
}

export default function BudgetTrackerPage() {
  const [gasUrl, setGasUrl] = useState('');
  const { loading, error, connected, post } = useGas(gasUrl);
  const handleUrlChange = useCallback((url: string) => setGasUrl(url), []);

  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [filterPeriod, setFilterPeriod] = useState('');
  const [form, setForm] = useState({ category: '', budgetAmount: '', actualAmount: '', period: new Date().toISOString().slice(0, 7), notes: '' });

  async function addEntry() {
    if (!form.category) return;
    const entry: BudgetEntry = {
      id: crypto.randomUUID(),
      category: form.category,
      budgetAmount: parseFloat(form.budgetAmount) || 0,
      actualAmount: parseFloat(form.actualAmount) || 0,
      period: form.period,
      notes: form.notes,
    };
    if (connected) {
      const res = await post({ action: 'create', ...form, budgetAmount: entry.budgetAmount, actualAmount: entry.actualAmount });
      if (res?.id) entry.id = res.id;
    }
    setEntries(e => [...e, entry]);
    setForm(f => ({ ...f, category: '', budgetAmount: '', actualAmount: '', notes: '' }));
  }

  function removeEntry(id: string) {
    if (connected) post({ action: 'delete', id });
    setEntries(e => e.filter(x => x.id !== id));
  }

  const periods = [...new Set(entries.map(e => e.period))].sort();
  const visible = filterPeriod ? entries.filter(e => e.period === filterPeriod) : entries;
  const totalBudget = visible.reduce((s, e) => s + e.budgetAmount, 0);
  const totalActual = visible.reduce((s, e) => s + e.actualAmount, 0);
  const totalVariance = totalBudget - totalActual;

  function varianceColor(v: number) { return v >= 0 ? '#10b981' : '#f87171'; }
  function fmt(n: number) { return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`; }

  const inpStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 14, padding: '8px 12px', outline: 'none' };

  return (
    <GasToolLayout title="Budget vs. Actual Tracker" description="Track budgeted vs. actual spending by category and period. Color-coded variance with summary totals." icon="📊" accent={ACCENT}>
      <GasSetup storageKey={SK} onUrl={handleUrlChange} connected={connected} />
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Summary totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Budget', value: fmt(totalBudget), color: ACCENT },
          { label: 'Total Actual', value: fmt(totalActual), color: '#e2e8f0' },
          { label: 'Variance', value: `${totalVariance >= 0 ? '+' : '-'}${fmt(totalVariance)}`, color: varianceColor(totalVariance) },
          { label: 'Categories', value: visible.length, color: '#64748b' },
        ].map(s => (
          <div key={s.label} style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: '1.5rem', marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Add Category</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Category *</label>
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Staffing" style={inpStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Budgeted ($)</label>
            <input type="number" value={form.budgetAmount} onChange={e => setForm(f => ({ ...f, budgetAmount: e.target.value }))} style={inpStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Actual ($)</label>
            <input type="number" value={form.actualAmount} onChange={e => setForm(f => ({ ...f, actualAmount: e.target.value }))} style={inpStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Period (YYYY-MM)</label>
            <input type="month" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} style={inpStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inpStyle} />
          </div>
        </div>
        <button onClick={addEntry} disabled={loading || !form.category}
          style={{ backgroundColor: ACCENT, color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px', opacity: !form.category ? 0.5 : 1 }}>
          {loading ? 'Saving…' : '+ Add Category'}
        </button>
      </div>

      {/* Period filter */}
      {periods.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterPeriod('')}
            style={{ backgroundColor: !filterPeriod ? ACCENT : '#111827', color: !filterPeriod ? '#fff' : '#94a3b8', border: `1px solid ${!filterPeriod ? ACCENT : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 12px' }}>
            All Periods
          </button>
          {periods.map(p => (
            <button key={p} onClick={() => setFilterPeriod(p)}
              style={{ backgroundColor: filterPeriod === p ? ACCENT : '#111827', color: filterPeriod === p ? '#fff' : '#94a3b8', border: `1px solid ${filterPeriod === p ? ACCENT : '#1e293b'}`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '5px 12px' }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {visible.length > 0 && (
        <div style={{ backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 0, padding: '0.75rem 1.5rem', borderBottom: '1px solid #1e293b', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <span>Category</span><span>Budgeted</span><span>Actual</span><span>Variance</span><span>Period</span><span />
          </div>
          {visible.map(e => {
            const v = e.budgetAmount - e.actualAmount;
            const pct = e.budgetAmount ? ((v / e.budgetAmount) * 100).toFixed(1) : '0.0';
            return (
              <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', gap: 0, padding: '0.875rem 1.5rem', borderBottom: '1px solid #1e293b', fontSize: 14, alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{e.category}</div>
                  {e.notes && <div style={{ fontSize: 11, color: '#64748b' }}>{e.notes}</div>}
                </div>
                <span style={{ color: '#94a3b8' }}>{fmt(e.budgetAmount)}</span>
                <span style={{ color: '#e2e8f0' }}>{fmt(e.actualAmount)}</span>
                <span style={{ color: varianceColor(v), fontWeight: 700 }}>{v >= 0 ? '+' : '-'}{fmt(v)} <span style={{ fontSize: 11, opacity: 0.7 }}>({pct}%)</span></span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{e.period}</span>
                <button onClick={() => removeEntry(e.id)}
                  style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: 14 }}>No budget categories yet — add one above.</div>}
    </GasToolLayout>
  );
}
