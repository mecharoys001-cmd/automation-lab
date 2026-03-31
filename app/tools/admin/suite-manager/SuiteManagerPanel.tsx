'use client';

import { useState, useEffect, useCallback } from 'react';

interface Suite {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface SuiteMember {
  id: string;
  suite_id: string;
  user_email: string;
  role: 'member' | 'manager';
  granted_by: string | null;
  granted_at: string;
}

// ---------------------------------------------------------------------------
// Shared styles (matching site design: teal accent, Montserrat, card layout)
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '1.25rem 1.5rem',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
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
  padding: '10px 24px',
  background: '#0F7490',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: 700,
  fontFamily: "'Montserrat', sans-serif",
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  padding: '8px 16px',
  background: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 700,
  fontFamily: "'Montserrat', sans-serif",
  cursor: 'pointer',
};

const roleBadge = (role: string): React.CSSProperties => {
  const isManager = role === 'manager';
  return {
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: '4px',
    background: isManager ? '#dbeafe' : '#f1f5f9',
    color: isManager ? '#2563eb' : '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SuiteManagerPanel({ suites }: { suites: Suite[] }) {
  const [activeSuiteId, setActiveSuiteId] = useState<string>(suites[0]?.id ?? '');
  const [members, setMembers] = useState<SuiteMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add member form
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  // Track which member is pending removal (for confirm step)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const activeSuite = suites.find((s) => s.id === activeSuiteId);

  // -- Fetch members --
  const fetchMembers = useCallback(async (suiteId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tool-suites/${suiteId}/members`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load members');
      }
      const data = await res.json();
      setMembers(data.members ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSuiteId) {
      fetchMembers(activeSuiteId);
      setConfirmRemove(null);
    }
  }, [activeSuiteId, fetchMembers]);

  // -- Add member --
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email) return;

    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/tool-suites/${activeSuiteId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, role: 'member' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add member');
      }
      setNewEmail('');
      fetchMembers(activeSuiteId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  // -- Remove member --
  const handleRemoveMember = async (email: string) => {
    setRemoving(email);
    setError(null);
    try {
      const res = await fetch(`/api/tool-suites/${activeSuiteId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove member');
      }
      setConfirmRemove(null);
      fetchMembers(activeSuiteId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemoving(null);
    }
  };

  // Separate managers and members for display
  const managers = members.filter((m) => m.role === 'manager');
  const regularMembers = members.filter((m) => m.role === 'member');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Suite selector — only shown when managing multiple suites */}
      {suites.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {suites.map((suite) => (
            <button
              key={suite.id}
              onClick={() => setActiveSuiteId(suite.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '6px',
                border: suite.id === activeSuiteId ? '2px solid #0F7490' : '1px solid #e2e8f0',
                background: suite.id === activeSuiteId ? '#e0f4fa' : '#ffffff',
                color: suite.id === activeSuiteId ? '#0F7490' : '#64748b',
                fontWeight: 700,
                fontSize: '14px',
                fontFamily: "'Montserrat', sans-serif",
                cursor: 'pointer',
              }}
            >
              {suite.name}
            </button>
          ))}
        </div>
      )}

      {/* Active suite info */}
      {activeSuite && (
        <div style={cardStyle}>
          <h2
            style={{
              margin: '0 0 0.25rem',
              fontSize: '1.25rem',
              fontWeight: 800,
              fontFamily: "'Montserrat', sans-serif",
              color: '#1a1a2e',
            }}
          >
            {activeSuite.name}
          </h2>
          {activeSuite.description && (
            <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
              {activeSuite.description}
            </p>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#dc2626',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: "'Montserrat', sans-serif",
          }}
        >
          {error}
        </div>
      )}

      {/* Add member form */}
      <div style={cardStyle}>
        <h3
          style={{
            margin: '0 0 0.75rem',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: "'Montserrat', sans-serif",
            color: '#1a1a2e',
          }}
        >
          Add a New Member
        </h3>
        <p
          style={{
            margin: '0 0 1rem',
            fontSize: '13px',
            color: '#94a3b8',
            lineHeight: 1.5,
          }}
        >
          Enter the email address of the person you want to give access to all
          tools in this suite.
        </p>
        <form
          onSubmit={handleAddMember}
          style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}
        >
          <input
            type="email"
            placeholder="name@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="submit"
            disabled={adding || !newEmail.trim()}
            title="Add this person as a member of the suite"
            style={{
              ...btnPrimary,
              opacity: adding || !newEmail.trim() ? 0.5 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {adding ? 'Adding…' : 'Add Member'}
          </button>
        </form>
      </div>

      {/* Members list */}
      <div style={cardStyle}>
        <h3
          style={{
            margin: '0 0 1rem',
            fontSize: '14px',
            fontWeight: 700,
            fontFamily: "'Montserrat', sans-serif",
            color: '#1a1a2e',
          }}
        >
          Current Members
          {!loading && (
            <span
              style={{
                fontWeight: 500,
                color: '#94a3b8',
                fontSize: '13px',
                marginLeft: '8px',
              }}
            >
              ({members.length})
            </span>
          )}
        </h3>

        {loading ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            Loading members…
          </p>
        ) : members.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            No members yet. Add someone above to get started.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Managers first */}
            {managers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canRemove={false}
                confirmRemove={false}
                removing={false}
                onRequestRemove={() => {}}
                onConfirmRemove={() => {}}
                onCancelRemove={() => {}}
              />
            ))}
            {/* Then regular members */}
            {regularMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                canRemove={true}
                confirmRemove={confirmRemove === m.user_email}
                removing={removing === m.user_email}
                onRequestRemove={() => setConfirmRemove(m.user_email)}
                onConfirmRemove={() => handleRemoveMember(m.user_email)}
                onCancelRemove={() => setConfirmRemove(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Help text */}
      <p
        style={{
          color: '#94a3b8',
          fontSize: '12px',
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        You can add or remove members. Only site administrators can add managers
        or change tool assignments.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberRow — single member line item
// ---------------------------------------------------------------------------

function MemberRow({
  member,
  canRemove,
  confirmRemove,
  removing,
  onRequestRemove,
  onConfirmRemove,
  onCancelRemove,
}: {
  member: SuiteMember;
  canRemove: boolean;
  confirmRemove: boolean;
  removing: boolean;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #f1f5f9',
      }}
    >
      {/* Email */}
      <span
        style={{
          flex: 1,
          fontSize: '14px',
          fontFamily: "'Montserrat', sans-serif",
          color: '#1a1a2e',
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={member.user_email}
      >
        {member.user_email}
      </span>

      {/* Role badge */}
      <span style={roleBadge(member.role)}>{member.role}</span>

      {/* Remove button / confirm */}
      {canRemove && !confirmRemove && (
        <button
          onClick={onRequestRemove}
          title="Remove this member from the suite"
          style={btnDanger}
        >
          Remove
        </button>
      )}
      {canRemove && confirmRemove && (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onConfirmRemove}
            disabled={removing}
            style={{
              ...btnDanger,
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              opacity: removing ? 0.6 : 1,
            }}
          >
            {removing ? 'Removing…' : 'Confirm'}
          </button>
          <button
            onClick={onCancelRemove}
            style={{
              padding: '8px 12px',
              background: '#f1f5f9',
              color: '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: "'Montserrat', sans-serif",
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {!canRemove && member.role === 'manager' && (
        <span
          style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}
          title="Only site administrators can remove managers"
        >
          (admin-managed)
        </span>
      )}
    </div>
  );
}
