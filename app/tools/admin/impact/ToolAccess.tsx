'use client';

import { useState, useEffect, useCallback } from 'react';

type ToolVisibility = 'public' | 'restricted' | 'hidden';

interface ToolConfig {
  tool_id: string;
  display_name: string;
  visibility: ToolVisibility | null;
  is_active: boolean;
}

interface AccessEntry {
  id: string;
  tool_id: string;
  user_email: string;
  granted_by: string | null;
  granted_at: string;
}

export default function ToolAccess() {
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [accessList, setAccessList] = useState<AccessEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState<string | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch('/api/usage/config');
      if (res.status === 403) {
        setError('Access denied');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch tools');
      const data = await res.json();
      setTools(data.configs ?? []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tools');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccess = useCallback(async (toolId: string) => {
    setAccessLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-access?tool_id=${encodeURIComponent(toolId)}`);
      if (!res.ok) throw new Error('Failed to fetch access list');
      const data = await res.json();
      setAccessList(data.access ?? []);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to fetch access list');
      setAccessList([]);
    } finally {
      setAccessLoading(false);
    }
  }, []);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  useEffect(() => {
    if (selectedToolId) {
      fetchAccess(selectedToolId);
    } else {
      setAccessList([]);
    }
  }, [selectedToolId, fetchAccess]);

  const handleVisibilityChange = async (toolId: string, visibility: ToolVisibility) => {
    setUpdatingVisibility(toolId);
    setActionError(null);
    try {
      const res = await fetch('/api/usage/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId, visibility }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update visibility');
      }
      setTools((prev) =>
        prev.map((t) => (t.tool_id === toolId ? { ...t, visibility } : t)),
      );
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update visibility');
    } finally {
      setUpdatingVisibility(null);
    }
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToolId || !newEmail.trim()) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/tool-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: selectedToolId, user_email: newEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to grant access');
      }
      setNewEmail('');
      await fetchAccess(selectedToolId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to grant access');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeAccess = async (userEmail: string) => {
    if (!selectedToolId) return;
    setActionError(null);
    try {
      const res = await fetch(
        `/api/tool-access?tool_id=${encodeURIComponent(selectedToolId)}&user_email=${encodeURIComponent(userEmail)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to revoke access');
      }
      await fetchAccess(selectedToolId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke access');
    }
  };

  const selectedTool = tools.find((t) => t.tool_id === selectedToolId);

  const cardStyle: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: "'Montserrat', sans-serif",
    background: '#f8fafc',
    color: '#1a1a2e',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnPrimary: React.CSSProperties = {
    padding: '8px 18px',
    background: '#0F7490',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: "'Montserrat', sans-serif",
    cursor: 'pointer',
  };

  const btnSecondary: React.CSSProperties = {
    padding: '8px 18px',
    background: '#f1f5f9',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: "'Montserrat', sans-serif",
    cursor: 'pointer',
  };

  const visibilityBadge = (vis: ToolVisibility | null): React.CSSProperties => {
    const v = vis ?? 'public';
    const colors: Record<string, { bg: string; text: string }> = {
      public: { bg: '#dcfce7', text: '#16a34a' },
      restricted: { bg: '#fef3c7', text: '#d97706' },
      hidden: { bg: '#fee2e2', text: '#dc2626' },
    };
    const c = colors[v] ?? colors.public;
    return {
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: 700,
      borderRadius: '4px',
      background: c.bg,
      color: c.text,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    };
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontSize: '14px' }}>
        Loading tool access settings...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', minHeight: '500px' }}>
      {/* Left Panel — Tool List */}
      <div style={{ width: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
          Tools
        </p>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px', marginBottom: '0.5rem' }}>
          Set visibility and manage per-user access for restricted or hidden tools.
        </p>

        {tools.map((tool) => {
          const isSelected = selectedToolId === tool.tool_id;
          return (
            <div
              key={tool.tool_id}
              onClick={() => setSelectedToolId(tool.tool_id)}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                borderColor: isSelected ? '#0F7490' : '#e2e8f0',
                background: isSelected ? '#f0fdfa' : '#ffffff',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tool.display_name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {tool.tool_id}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <select
                    value={tool.visibility ?? 'public'}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleVisibilityChange(tool.tool_id, e.target.value as ToolVisibility);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={updatingVisibility === tool.tool_id}
                    style={{
                      ...visibilityBadge(tool.visibility),
                      border: '1px solid transparent',
                      cursor: 'pointer',
                      fontFamily: "'Montserrat', sans-serif",
                      outline: 'none',
                      opacity: updatingVisibility === tool.tool_id ? 0.5 : 1,
                    }}
                  >
                    <option value="public">Public</option>
                    <option value="restricted">Restricted</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        {tools.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '13px' }}>
            No tools configured.
          </div>
        )}
      </div>

      {/* Right Panel — Access List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {!selectedToolId ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '14px' }}>
            Select a tool to manage its access list.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
                  Access List
                </p>
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
                  {selectedTool?.display_name} &mdash;{' '}
                  <span style={visibilityBadge(selectedTool?.visibility ?? null)}>
                    {selectedTool?.visibility ?? 'public'}
                  </span>
                </p>
              </div>
              <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                {accessList.length} user{accessList.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Action error banner */}
            {actionError && (
              <div style={{ ...cardStyle, borderColor: '#fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>
                {actionError}
                <button
                  onClick={() => setActionError(null)}
                  style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Add user form */}
            <form onSubmit={handleGrantAccess} style={{ ...cardStyle, border: '2px dashed #0F7490', background: '#f0fdfa' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Grant User Access
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="submit"
                  disabled={submitting || !newEmail.trim()}
                  style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </form>

            {/* Access list */}
            {accessLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '13px' }}>
                Loading access list...
              </div>
            ) : accessList.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '13px' }}>
                No users have been granted access to this tool.
              </div>
            ) : (
              accessList.map((entry) => (
                <div key={entry.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
                        {entry.user_email}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                        Granted by {entry.granted_by ?? 'unknown'} &middot;{' '}
                        {new Date(entry.granted_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeAccess(entry.user_email)}
                      style={{ ...btnSecondary, color: '#ef4444', padding: '5px 12px', fontSize: '12px' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
