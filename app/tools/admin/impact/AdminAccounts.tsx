'use client';

import { useState, useEffect, useCallback } from 'react';

interface Admin {
  id: string;
  email: string;
  display_name: string | null;
  role_level: 'master' | 'standard';
  created_at: string;
}

export default function AdminAccounts() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formRole, setFormRole] = useState<'master' | 'standard'>('standard');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch('/api/site-admins');
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch site admins');
      const data = await res.json();
      setAdmins(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/site-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail,
          display_name: formDisplayName || undefined,
          role_level: formRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add site admin');
      }
      setFormEmail('');
      setFormDisplayName('');
      setFormRole('standard');
      setShowAddForm(false);
      await fetchAdmins();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/site-admins?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove site admin');
      }
      setConfirmDeleteId(null);
      await fetchAdmins();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  };

  const handleRoleChange = async (id: string, newRole: 'master' | 'standard') => {
    setActionError(null);
    try {
      const res = await fetch(`/api/site-admins?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_level: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update role');
      }
      setEditingRoleId(null);
      await fetchAdmins();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

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
    background: '#1282a2',
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

  if (forbidden) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔒</div>
        <h3 style={{ margin: 0, fontWeight: 700, fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
          Access Restricted
        </h3>
        <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '14px' }}>
          Site admin account management requires site master admin privileges.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontSize: '14px' }}>
        Loading admin accounts...
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
            Site Admin Accounts
          </p>
          {!showAddForm && (
            <button style={btnPrimary} onClick={() => setShowAddForm(true)}>
              + Add Site Admin
            </button>
          )}
        </div>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px' }}>
          These accounts have access to the Impact Dashboard and site-wide analytics. Scheduler admin accounts are managed separately.
        </p>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          {admins.length} site admin account{admins.length !== 1 ? 's' : ''}
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

      {/* Add admin form */}
      {showAddForm && (
        <form onSubmit={handleAdd} style={{ ...cardStyle, border: '2px dashed #1282a2', background: '#f0fdfa' }}>
          <h4 style={{ margin: '0 0 1rem', fontWeight: 700, fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e', fontSize: '14px' }}>
            New Site Admin Account
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Email *
              </label>
              <input
                type="email"
                required
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="admin@example.com"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Display Name
              </label>
              <input
                type="text"
                value={formDisplayName}
                onChange={(e) => setFormDisplayName(e.target.value)}
                placeholder="Optional"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                Role Level
              </label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as 'master' | 'standard')}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="standard">Standard</option>
                <option value="master">Master</option>
              </select>
            </div>
          </div>
          {formError && (
            <p style={{ color: '#dc2626', fontSize: '13px', margin: '0.75rem 0 0' }}>{formError}</p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" disabled={submitting} style={{ ...btnPrimary, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Adding...' : 'Add Site Admin'}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setFormError(null); }} style={btnSecondary}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Admin list */}
      {admins.map((admin) => (
        <div key={admin.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
                  {admin.display_name || admin.email}
                </span>
                {editingRoleId === admin.id ? (
                  <select
                    value={admin.role_level}
                    onChange={(e) => handleRoleChange(admin.id, e.target.value as 'master' | 'standard')}
                    onBlur={() => setEditingRoleId(null)}
                    autoFocus
                    style={{
                      padding: '2px 6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      border: '1px solid #1282a2',
                      borderRadius: '4px',
                      background: '#f0fdfa',
                      color: '#1282a2',
                      fontFamily: "'Montserrat', sans-serif",
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="standard">standard</option>
                    <option value="master">master</option>
                  </select>
                ) : (
                  <span
                    onClick={() => setEditingRoleId(admin.id)}
                    title="Click to change role"
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: admin.role_level === 'master' ? '#1282a2' : '#e2e8f0',
                      color: admin.role_level === 'master' ? '#fff' : '#64748b',
                    }}
                  >
                    {admin.role_level}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                {admin.display_name ? admin.email : ''}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                Added {new Date(admin.created_at).toLocaleDateString()}
              </div>
            </div>
            <div>
              {confirmDeleteId === admin.id ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>Remove?</span>
                  <button
                    onClick={() => handleDelete(admin.id)}
                    style={{ ...btnPrimary, background: '#dc2626', padding: '5px 12px', fontSize: '12px' }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    style={{ ...btnSecondary, padding: '5px 12px', fontSize: '12px' }}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setConfirmDeleteId(admin.id); setActionError(null); }}
                  style={{ ...btnSecondary, color: '#ef4444', padding: '5px 12px', fontSize: '12px' }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      ))}

      {admins.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '14px' }}>
          No site admin accounts found.
        </div>
      )}
    </div>
  );
}
