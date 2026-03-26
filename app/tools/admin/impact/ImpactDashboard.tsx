'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ToolUsageStats, ToolConfig } from '@/types/usage';

export default function ImpactDashboard() {
  const [stats, setStats] = useState<ToolUsageStats[]>([]);
  const [, setConfigs] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [editDays, setEditDays] = useState('0');
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('0');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, configRes] = await Promise.all([
        fetch('/api/usage/stats'),
        fetch('/api/usage/config'),
      ]);
      if (!statsRes.ok || !configRes.ok) throw new Error('Failed to load data');
      const statsData = await statsRes.json();
      const configData = await configRes.json();
      setStats(statsData.stats);
      setConfigs(configData.configs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalHours = stats.reduce((sum, s) => sum + s.total_hours_saved, 0);
  const totalUses = stats.reduce((sum, s) => sum + s.total_uses, 0);

  async function saveMinutes(toolId: string) {
    setSaving(true);
    try {
      const res = await fetch('/api/usage/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId, minutes_per_use: (Number(editDays) * 24 * 60) + (Number(editHours) * 60) + Number(editMinutes) }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditingTool(null);
      fetchData(); // Refresh
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div style={{ padding: '6rem 2rem', textAlign: 'center', color: '#64748b', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Montserrat', sans-serif" }}>
      Loading impact data...
    </div>
  );

  if (error) return (
    <div style={{ padding: '6rem 2rem', textAlign: 'center', color: '#dc2626', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Montserrat', sans-serif" }}>
      Error: {error}
    </div>
  );

  return (
    <div style={{ paddingTop: '80px', minHeight: '100vh', background: '#f8fafc', color: '#1a1a2e', fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
          Impact Dashboard
        </h1>
        <p style={{ color: '#64748b', marginBottom: '2.5rem' }}>
          Track time savings across all automation tools.
        </p>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1282a2', fontFamily: "'Montserrat', sans-serif" }}>
              {totalUses}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
              Total Tool Uses
            </div>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1', fontFamily: "'Montserrat', sans-serif" }}>
              {Math.round(totalHours * 10) / 10}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
              Total Hours Saved
            </div>
          </div>
          <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', fontFamily: "'Montserrat', sans-serif" }}>
              ${Math.round(totalHours * 20)}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
              Est. Cost Savings (@$20/hr)
            </div>
          </div>
        </div>

        {/* Per-tool breakdown */}
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
          By Tool
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {stats.map((s) => (
            <div key={s.tool_id} style={{ background: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: '#1a1a2e' }}>{s.display_name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1282a2', fontFamily: "'Montserrat', sans-serif" }}>
                    {s.total_hours_saved}h
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>saved</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '13px', color: '#475569' }}>
                <span><strong>{s.total_uses}</strong> uses</span>
                <span>
                  {editingTool === s.tool_id ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <input type="number" min="0" value={editDays} onChange={(e) => setEditDays(e.target.value)} style={{ width: '50px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#1a1a2e', padding: '2px 6px', textAlign: 'center' }} />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>d</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <input type="number" min="0" max="23" value={editHours} onChange={(e) => setEditHours(e.target.value)} style={{ width: '50px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#1a1a2e', padding: '2px 6px', textAlign: 'center' }} />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>h</span>
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <input type="number" min="0" max="59" value={editMinutes} onChange={(e) => setEditMinutes(e.target.value)} style={{ width: '50px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#1a1a2e', padding: '2px 6px', textAlign: 'center' }} />
                        <span style={{ fontSize: '11px', color: '#64748b' }}>m</span>
                      </span>
                      <button onClick={() => saveMinutes(s.tool_id)} disabled={saving} style={{ background: '#1282a2', color: '#fff', border: 'none', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontSize: '12px' }}>
                        Save
                      </button>
                      <button onClick={() => setEditingTool(null)} style={{ background: 'none', color: '#64748b', border: 'none', cursor: 'pointer', fontSize: '12px' }}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span onClick={() => {
                      const total = s.minutes_per_use;
                      setEditDays(String(Math.floor(total / (24 * 60))));
                      setEditHours(String(Math.floor((total % (24 * 60)) / 60)));
                      setEditMinutes(String(total % 60));
                      setEditingTool(s.tool_id);
                    }} style={{ cursor: 'pointer', borderBottom: '1px dashed #94a3b8' }} title="Click to edit">
                      <strong>{(() => {
                        const total = s.minutes_per_use;
                        const d = Math.floor(total / (24 * 60));
                        const h = Math.floor((total % (24 * 60)) / 60);
                        const m = total % 60;
                        const parts: string[] = [];
                        if (d > 0) parts.push(`${d}d`);
                        if (h > 0 || d > 0) parts.push(`${h}h`);
                        parts.push(`${m}m`);
                        return parts.join(' ');
                      })()}</strong>
                    </span>
                  )}
                  {' '}/use
                </span>
                <span>Tracking: {s.tracking_method}</span>
                {s.last_used && <span>Last used: {new Date(s.last_used).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
