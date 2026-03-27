'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ToolUsageStats, ToolConfig } from '@/types/usage';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600 * 10) / 10}h`;
}

function formatMinutesPerUse(total: number): string {
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

const statBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  fontSize: '12px',
  color: '#475569',
  background: '#f1f5f9',
  padding: '3px 10px',
  borderRadius: '6px',
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f8fafc',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  color: '#1a1a2e',
  padding: '8px 12px',
  fontSize: '14px',
  fontFamily: "'Montserrat', sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

export default function ImpactDashboard() {
  const [stats, setStats] = useState<ToolUsageStats[]>([]);
  const [configs, setConfigs] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [editDays, setEditDays] = useState('0');
  const [editHours, setEditHours] = useState('0');
  const [editMinutes, setEditMinutes] = useState('0');
  const [saving, setSaving] = useState(false);

  // Log Usage state
  const [loggingTool, setLoggingTool] = useState<string | null>(null);
  const [logDate, setLogDate] = useState('');
  const [logSaving, setLogSaving] = useState(false);

  // Edit External Tool state
  const [editExtTool, setEditExtTool] = useState<string | null>(null);
  const [editExtDisplayName, setEditExtDisplayName] = useState('');
  const [editExtDays, setEditExtDays] = useState('0');
  const [editExtHours, setEditExtHours] = useState('0');
  const [editExtMinutes, setEditExtMinutes] = useState('0');
  const [editExtRunFrequency, setEditExtRunFrequency] = useState('');
  const [editExtCustomInterval, setEditExtCustomInterval] = useState('30');
  const [editExtFirstRunDate, setEditExtFirstRunDate] = useState('');
  const [editExtDescription, setEditExtDescription] = useState('');
  const [editExtTrackingNotes, setEditExtTrackingNotes] = useState('');
  const [editExtSaving, setEditExtSaving] = useState(false);

  // Seed Historical Runs state
  const [seedCount, setSeedCount] = useState('0');
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState('');

  // Delete confirmation state
  const [deletingTool, setDeletingTool] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Add External Tool state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newToolId, setNewToolId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newDays, setNewDays] = useState('0');
  const [newHours, setNewHours] = useState('0');
  const [newMinutes, setNewMinutes] = useState('0');
  const [newTrackingNotes, setNewTrackingNotes] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRunFrequency, setNewRunFrequency] = useState('');
  const [newCustomInterval, setNewCustomInterval] = useState('30');
  const [newFirstRunDate, setNewFirstRunDate] = useState('');
  const [newHistoricalRuns, setNewHistoricalRuns] = useState('0');
  const [addSaving, setAddSaving] = useState(false);

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

  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const internalStats = stats.filter(s => !s.is_external);
  const externalStats = stats.filter(s => s.is_external);
  const externalConfigs = configs.filter(c => c.is_external);
  // External tools that have a config but no stats yet
  const externalConfigsWithoutStats = externalConfigs.filter(
    c => !externalStats.some(s => s.tool_id === c.tool_id)
  );

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
      fetchData();
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function logUsage(toolId: string) {
    setLogSaving(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (logDate) metadata.logged_date = logDate;
      metadata.manual_entry = true;

      const res = await fetch('/api/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId, metadata }),
      });
      if (!res.ok) throw new Error('Failed to log usage');
      setLoggingTool(null);
      setLogDate('');
      fetchData();
    } catch {
      setError('Failed to log usage');
    } finally {
      setLogSaving(false);
    }
  }

  function startEditExtTool(s: ToolUsageStats) {
    const total = s.minutes_per_use;
    setEditExtDays(String(Math.floor(total / (24 * 60))));
    setEditExtHours(String(Math.floor((total % (24 * 60)) / 60)));
    setEditExtMinutes(String(total % 60));
    setEditExtDisplayName(s.display_name);
    setEditExtRunFrequency(s.run_frequency || '');
    setEditExtCustomInterval(String(s.run_interval_days || 30));
    setEditExtFirstRunDate(s.first_run_date || '');
    setEditExtDescription(s.description || '');
    setEditExtTrackingNotes(s.tracking_notes || '');
    setSeedCount('0');
    setSeedSuccess('');
    setEditExtTool(s.tool_id);
  }

  async function seedRuns(toolId: string) {
    const count = Number(seedCount);
    if (!count || count <= 0) return;
    setSeedLoading(true);
    setSeedSuccess('');
    try {
      const res = await fetch('/api/usage/config/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          count,
          first_run_date: editExtFirstRunDate || null,
          run_frequency: editExtRunFrequency || null,
          run_interval_days: editExtRunFrequency === 'custom' ? Number(editExtCustomInterval) || 30 : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Seed failed');
      }
      const data = await res.json();
      setSeedSuccess(`Successfully seeded ${data.events_seeded} historical events.`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed runs');
    } finally {
      setSeedLoading(false);
    }
  }

  async function saveExtTool(toolId: string) {
    setEditExtSaving(true);
    try {
      const minutes = (Number(editExtDays) * 24 * 60) + (Number(editExtHours) * 60) + Number(editExtMinutes);
      const res = await fetch('/api/usage/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: toolId,
          display_name: editExtDisplayName,
          minutes_per_use: minutes,
          run_frequency: editExtRunFrequency || null,
          run_interval_days: editExtRunFrequency === 'custom' ? Number(editExtCustomInterval) || 30 : null,
          first_run_date: editExtFirstRunDate || null,
          description: editExtDescription || null,
          tracking_notes: editExtTrackingNotes || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditExtTool(null);
      fetchData();
    } catch {
      setError('Failed to save external tool');
    } finally {
      setEditExtSaving(false);
    }
  }

  async function deleteExtTool(toolId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/usage/config?tool_id=${encodeURIComponent(toolId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      setDeletingTool(null);
      fetchData();
    } catch {
      setError('Failed to delete tool');
    } finally {
      setDeleting(false);
    }
  }

  async function addExternalTool() {
    setAddSaving(true);
    try {
      const minutes = (Number(newDays) * 24 * 60) + (Number(newHours) * 60) + Number(newMinutes);
      const res = await fetch('/api/usage/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_id: newToolId,
          display_name: newDisplayName,
          minutes_per_use: minutes,
          tracking_method: 'per_use',
          description: newDescription || null,
          is_external: true,
          tracking_notes: newTrackingNotes || null,
          run_frequency: newRunFrequency || null,
          run_interval_days: newRunFrequency === 'custom' ? Number(newCustomInterval) || 30 : null,
          first_run_date: newFirstRunDate || null,
          historical_runs: Number(newHistoricalRuns) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add tool');
      }
      setShowAddForm(false);
      setNewToolId('');
      setNewDisplayName('');
      setNewDays('0');
      setNewHours('0');
      setNewMinutes('0');
      setNewTrackingNotes('');
      setNewDescription('');
      setNewRunFrequency('');
      setNewCustomInterval('30');
      setNewFirstRunDate('');
      setNewHistoricalRuns('0');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tool');
    } finally {
      setAddSaving(false);
    }
  }

  function renderStatsRow(s: ToolUsageStats) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
        <span style={statBadgeStyle}>
          <span style={{ color: '#1282a2', fontWeight: 700 }}>{s.unique_users ?? 0}</span> unique users
        </span>
        <span style={statBadgeStyle}>
          <span style={{ color: '#6366f1', fontWeight: 700 }}>{s.repeat_users ?? 0}</span> repeat users
        </span>
        <span style={statBadgeStyle}>
          <span style={{ color: '#10b981', fontWeight: 700 }}>{s.completion_rate ?? 0}%</span> completion
        </span>
        <span style={statBadgeStyle}>
          <span style={{ color: '#f59e0b', fontWeight: 700 }}>{s.avg_duration_seconds ? formatDuration(s.avg_duration_seconds) : '—'}</span> avg duration
        </span>
      </div>
    );
  }

  function renderTimeEditor(s: ToolUsageStats) {
    if (editingTool === s.tool_id) {
      return (
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
      );
    }
    return (
      <span onClick={() => {
        const total = s.minutes_per_use;
        setEditDays(String(Math.floor(total / (24 * 60))));
        setEditHours(String(Math.floor((total % (24 * 60)) / 60)));
        setEditMinutes(String(total % 60));
        setEditingTool(s.tool_id);
      }} style={{ cursor: 'pointer', borderBottom: '1px dashed #94a3b8' }} title="Click to edit">
        <strong>{formatMinutesPerUse(s.minutes_per_use)}</strong>
      </span>
    );
  }

  function renderEditExtForm(s: ToolUsageStats) {
    return (
      <div key={s.tool_id} style={{ ...cardStyle, border: '2px solid #1282a2' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e', marginBottom: '1rem', fontFamily: "'Montserrat', sans-serif" }}>
          Edit: {s.display_name}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Display Name</label>
            <input type="text" value={editExtDisplayName} onChange={(e) => setEditExtDisplayName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Time Saved per Use</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" min="0" value={editExtDays} onChange={(e) => setEditExtDays(e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
                <span style={{ fontSize: '12px', color: '#64748b' }}>d</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" min="0" max="23" value={editExtHours} onChange={(e) => setEditExtHours(e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
                <span style={{ fontSize: '12px', color: '#64748b' }}>h</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input type="number" min="0" max="59" value={editExtMinutes} onChange={(e) => setEditExtMinutes(e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
                <span style={{ fontSize: '12px', color: '#64748b' }}>m</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label style={labelStyle}>Run Frequency</label>
            <select value={editExtRunFrequency} onChange={(e) => setEditExtRunFrequency(e.target.value)} style={inputStyle}>
              <option value="">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {editExtRunFrequency === 'custom' && (
            <div>
              <label style={labelStyle}>Custom Interval Days</label>
              <input type="number" min="1" value={editExtCustomInterval} onChange={(e) => setEditExtCustomInterval(e.target.value)} style={inputStyle} />
            </div>
          )}
          <div>
            <label style={labelStyle}>First Run Date</label>
            <input type="date" value={editExtFirstRunDate} onChange={(e) => setEditExtFirstRunDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle}>Description</label>
          <textarea value={editExtDescription} onChange={(e) => setEditExtDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label style={labelStyle}>Tracking Notes</label>
          <textarea value={editExtTrackingNotes} onChange={(e) => setEditExtTrackingNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* Backfill Historical Usage */}
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' }}>
            Backfill Historical Usage
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '0.75rem' }}>
            Add past usage events based on the tool&apos;s run frequency
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Times Run So Far</label>
            <input
              type="number"
              min="0"
              value={seedCount}
              onChange={(e) => { setSeedCount(e.target.value); setSeedSuccess(''); }}
              style={{ ...inputStyle, width: '100px', textAlign: 'center' }}
            />
            <button
              onClick={() => seedRuns(s.tool_id)}
              disabled={seedLoading || !Number(seedCount) || Number(seedCount) <= 0 || !editExtRunFrequency || !editExtFirstRunDate}
              style={{
                padding: '8px 16px', borderRadius: '6px', border: 'none',
                background: (!Number(seedCount) || Number(seedCount) <= 0 || !editExtRunFrequency || !editExtFirstRunDate) ? '#cbd5e1' : '#6366f1',
                color: '#ffffff', fontSize: '13px', fontWeight: 600,
                cursor: (!Number(seedCount) || Number(seedCount) <= 0 || !editExtRunFrequency || !editExtFirstRunDate) ? 'not-allowed' : 'pointer',
                fontFamily: "'Montserrat', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              {seedLoading ? 'Seeding...' : 'Seed Runs'}
            </button>
          </div>
          {!editExtRunFrequency || !editExtFirstRunDate ? (
            <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '6px' }}>
              Set a run frequency and first run date above to enable seeding.
            </div>
          ) : null}
          {seedSuccess && (
            <div style={{ fontSize: '12px', color: '#10b981', marginTop: '6px', fontWeight: 600 }}>
              {seedSuccess}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setEditExtTool(null)}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: '1px solid #e2e8f0',
              background: '#ffffff', color: '#64748b', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: "'Montserrat', sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => saveExtTool(s.tool_id)}
            disabled={editExtSaving || !editExtDisplayName.trim()}
            style={{
              padding: '8px 20px', borderRadius: '6px', border: 'none',
              background: !editExtDisplayName.trim() ? '#cbd5e1' : '#1282a2',
              color: '#ffffff', fontSize: '13px', fontWeight: 600,
              cursor: !editExtDisplayName.trim() ? 'not-allowed' : 'pointer',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            {editExtSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  function renderToolCard(s: ToolUsageStats, showLogButton: boolean) {
    const isExternal = s.is_external;

    // If editing this external tool, show the edit form instead
    if (isExternal && editExtTool === s.tool_id) {
      return renderEditExtForm(s);
    }

    return (
      <div key={s.tool_id} style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#1a1a2e' }}>{s.display_name}</span>
              {s.run_frequency && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#6366f1',
                  background: '#eef2ff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  textTransform: 'capitalize',
                }}>
                  {s.run_frequency === 'custom' && s.run_interval_days
                    ? `Every ${s.run_interval_days}d`
                    : s.run_frequency}
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{s.description}</div>
            {s.tracking_notes && (
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>{s.tracking_notes}</div>
            )}
            {s.next_run_date && (
              <div style={{ fontSize: '11px', color: '#1282a2', marginTop: '4px', fontWeight: 600 }}>
                Next auto-run: {new Date(s.next_run_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isExternal && (
              <>
                <button
                  onClick={() => startEditExtTool(s)}
                  style={{
                    background: 'none', border: '1px solid #cbd5e1', borderRadius: '6px',
                    padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    color: '#475569', fontFamily: "'Montserrat', sans-serif", whiteSpace: 'nowrap',
                  }}
                >
                  Edit
                </button>
                {deletingTool === s.tool_id ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>Delete?</span>
                    <button
                      onClick={() => deleteExtTool(s.tool_id)}
                      disabled={deleting}
                      style={{
                        background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px',
                        padding: '4px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        fontFamily: "'Montserrat', sans-serif",
                      }}
                    >
                      {deleting ? 'Deleting...' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setDeletingTool(null)}
                      style={{
                        background: 'none', color: '#64748b', border: 'none',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                      }}
                    >
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={() => setDeletingTool(s.tool_id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 600, color: '#dc2626',
                      fontFamily: "'Montserrat', sans-serif", whiteSpace: 'nowrap',
                    }}
                  >
                    Delete
                  </button>
                )}
              </>
            )}
            {showLogButton && (
              <button
                onClick={() => { setLoggingTool(loggingTool === s.tool_id ? null : s.tool_id); setLogDate(''); }}
                style={{
                  background: loggingTool === s.tool_id ? '#f1f5f9' : '#1282a2',
                  color: loggingTool === s.tool_id ? '#475569' : '#fff',
                  border: '1px solid',
                  borderColor: loggingTool === s.tool_id ? '#cbd5e1' : '#1282a2',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: "'Montserrat', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {loggingTool === s.tool_id ? 'Cancel' : 'Log Usage'}
              </button>
            )}
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1282a2', fontFamily: "'Montserrat', sans-serif" }}>
                {s.total_hours_saved}h
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>saved</div>
            </div>
          </div>
        </div>

        {/* Log Usage inline form */}
        {loggingTool === s.tool_id && (
          <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 16px', marginBottom: '12px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ fontSize: '13px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>Date:</label>
            <input
              type="datetime-local"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}
              placeholder="Now"
            />
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Leave blank for now</span>
            <button
              onClick={() => logUsage(s.tool_id)}
              disabled={logSaving}
              style={{
                background: '#1282a2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: "'Montserrat', sans-serif",
                whiteSpace: 'nowrap',
                marginLeft: 'auto',
              }}
            >
              {logSaving ? 'Saving...' : 'Log'}
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '2rem', fontSize: '13px', color: '#475569' }}>
          <span><strong>{s.total_uses}</strong> uses</span>
          <span>
            {renderTimeEditor(s)}
            {' '}/use
          </span>
          <span>Tracking: {s.tracking_method}</span>
          {s.last_used && <span>Last used: {new Date(s.last_used).toLocaleDateString()}</span>}
        </div>

        {/* Stats row */}
        {renderStatsRow(s)}
      </div>
    );
  }

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontFamily: "'Montserrat', sans-serif" }}>
      Loading impact data...
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626', fontFamily: "'Montserrat', sans-serif" }}>
      Error: {error}
    </div>
  );

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#1282a2', fontFamily: "'Montserrat', sans-serif" }}>
            {totalUses}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
            Total Tool Uses
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1', fontFamily: "'Montserrat', sans-serif" }}>
            {Math.round(totalHours * 10) / 10}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
            Total Hours Saved
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f59e0b', fontFamily: "'Montserrat', sans-serif" }}>
            ${Math.round(totalHours * 20)}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px', fontWeight: 600 }}>
            Est. Cost Savings (@$20/hr)
          </div>
        </div>
      </div>

      {/* Internal tools */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
        By Tool
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {internalStats.map((s) => renderToolCard(s, false))}
      </div>

      {/* External Tools Section */}
      <div style={{ marginTop: '3rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
          External &amp; Offline Tools
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '1.5rem' }}>
          Track tools that run outside the website
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {externalStats.map((s) => renderToolCard(s, true))}

          {/* External configs with no stats yet */}
          {externalConfigsWithoutStats.map((c) => {
            const placeholder: ToolUsageStats = {
              tool_id: c.tool_id,
              display_name: c.display_name,
              minutes_per_use: c.minutes_per_use,
              tracking_method: c.tracking_method,
              description: c.description,
              is_external: true,
              tracking_notes: c.tracking_notes,
              run_frequency: c.run_frequency,
              run_interval_days: c.run_interval_days,
              first_run_date: c.first_run_date,
              next_run_date: c.next_run_date,
              total_uses: 0,
              total_minutes_saved: 0,
              total_hours_saved: 0,
              last_used: null,
              unique_users: 0,
              repeat_users: 0,
              completion_rate: 0,
              avg_duration_seconds: 0,
            };
            return renderToolCard(placeholder, true);
          })}

          {externalStats.length === 0 && externalConfigsWithoutStats.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', color: '#94a3b8', fontSize: '14px', padding: '2rem' }}>
              No external tools configured yet.
            </div>
          )}
        </div>

        {/* Add External Tool */}
        {!showAddForm ? (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: '2px dashed #cbd5e1',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: "'Montserrat', sans-serif",
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1282a2'; e.currentTarget.style.color = '#1282a2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#64748b'; }}
          >
            + Add External Tool
          </button>
        ) : (
          <div style={{ ...cardStyle, marginTop: '1rem', border: '2px solid #1282a2' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e', marginBottom: '1rem', fontFamily: "'Montserrat', sans-serif" }}>
              Add External Tool
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Display Name *</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => {
                    setNewDisplayName(e.target.value);
                    if (!newToolId || newToolId === slugify(newDisplayName)) {
                      setNewToolId(slugify(e.target.value));
                    }
                  }}
                  placeholder="Monthly Calendar Layout"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Tool ID</label>
                <input
                  type="text"
                  value={newToolId}
                  onChange={(e) => setNewToolId(e.target.value)}
                  placeholder="monthly-calendar-layout"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={labelStyle}>Time Saved per Use</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" min="0" value={newDays} onChange={(e) => setNewDays(e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>days</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" min="0" max="23" value={newHours} onChange={(e) => setNewHours(e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>hours</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="number" min="0" max="59" value={newMinutes} onChange={(e) => setNewMinutes(e.target.value)} style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>min</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={labelStyle}>Tracking Notes</label>
              <textarea
                value={newTrackingNotes}
                onChange={(e) => setNewTrackingNotes(e.target.value)}
                placeholder="Runs once monthly, saves 30 hours of calendar layout"
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Tool description..."
                rows={2}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            {/* Recurring usage fields */}
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e', marginBottom: '0.75rem' }}>
                Recurring Usage (optional)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Run Frequency</label>
                  <select
                    value={newRunFrequency}
                    onChange={(e) => setNewRunFrequency(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {newRunFrequency === 'custom' && (
                  <div>
                    <label style={labelStyle}>Interval (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={newCustomInterval}
                      onChange={(e) => setNewCustomInterval(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>First Run Date</label>
                  <input
                    type="date"
                    value={newFirstRunDate}
                    onChange={(e) => setNewFirstRunDate(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Times Run So Far</label>
                  <input
                    type="number"
                    min="0"
                    value={newHistoricalRuns}
                    onChange={(e) => setNewHistoricalRuns(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewToolId('');
                  setNewDisplayName('');
                  setNewDays('0');
                  setNewHours('0');
                  setNewMinutes('0');
                  setNewTrackingNotes('');
                  setNewDescription('');
                  setNewRunFrequency('');
                  setNewCustomInterval('30');
                  setNewFirstRunDate('');
                  setNewHistoricalRuns('0');
                }}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={addExternalTool}
                disabled={addSaving || !newDisplayName.trim() || !newToolId.trim()}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  background: (!newDisplayName.trim() || !newToolId.trim()) ? '#cbd5e1' : '#1282a2',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: (!newDisplayName.trim() || !newToolId.trim()) ? 'not-allowed' : 'pointer',
                  fontFamily: "'Montserrat', sans-serif",
                }}
              >
                {addSaving ? 'Adding...' : 'Add Tool'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
