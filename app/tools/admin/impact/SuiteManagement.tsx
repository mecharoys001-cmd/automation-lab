'use client';

import { useState, useEffect, useCallback } from 'react';

interface Suite {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tool_count: number;
  member_count: number;
}

interface SuiteTool {
  id: string;
  suite_id: string;
  tool_id: string;
  added_at: string;
}

interface SuiteMember {
  id: string;
  suite_id: string;
  user_email: string;
  role: 'member' | 'manager';
  granted_by: string | null;
  granted_at: string;
}

interface ToolConfig {
  tool_id: string;
  display_name: string;
  visibility: string | null;
  is_active: boolean;
}

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

const sectionHeading: React.CSSProperties = {
  margin: 0,
  fontWeight: 700,
  fontSize: '13px',
  fontFamily: "'Montserrat', sans-serif",
  color: '#1a1a2e',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const roleBadge = (role: string): React.CSSProperties => {
  const isManager = role === 'manager';
  return {
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function SuiteManagement() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Suite detail
  const [suiteTools, setSuiteTools] = useState<SuiteTool[]>([]);
  const [suiteMembers, setSuiteMembers] = useState<SuiteMember[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // All available tools (for add-tool dropdown)
  const [allTools, setAllTools] = useState<ToolConfig[]>([]);

  // Create suite form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit suite info
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add tool
  const [addToolId, setAddToolId] = useState('');
  const [addingTool, setAddingTool] = useState(false);

  // Add member
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'member' | 'manager'>('member');
  const [addingMember, setAddingMember] = useState(false);

  // Delete suite confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSuites = useCallback(async () => {
    try {
      const res = await fetch('/api/tool-suites');
      if (res.status === 403) {
        setError('Access denied');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch suites');
      const data = await res.json();
      setSuites(data.suites ?? []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suites');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuiteDetail = useCallback(async (suiteId: string) => {
    setDetailLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${suiteId}`);
      if (!res.ok) throw new Error('Failed to fetch suite detail');
      const data = await res.json();
      setSuiteTools(data.tools ?? []);
      setSuiteMembers(data.members ?? []);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to fetch suite detail');
      setSuiteTools([]);
      setSuiteMembers([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const fetchAllTools = useCallback(async () => {
    try {
      const res = await fetch('/api/usage/config');
      if (res.ok) {
        const data = await res.json();
        setAllTools(data.configs ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchSuites();
    fetchAllTools();
  }, [fetchSuites, fetchAllTools]);

  useEffect(() => {
    if (selectedSuiteId) {
      fetchSuiteDetail(selectedSuiteId);
      setEditing(false);
      setConfirmDelete(false);
    } else {
      setSuiteTools([]);
      setSuiteMembers([]);
    }
  }, [selectedSuiteId, fetchSuiteDetail]);

  const selectedSuite = suites.find((s) => s.id === selectedSuiteId);

  // Available tools not already in this suite
  const availableTools = allTools.filter(
    (t) => !suiteTools.some((st) => st.tool_id === t.tool_id),
  );

  // --- Handlers ---

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setActionError(null);
    try {
      const res = await fetch('/api/tool-suites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim() || undefined,
          description: newDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create suite');
      }
      const data = await res.json();
      setNewName('');
      setNewSlug('');
      setNewDescription('');
      setShowCreateForm(false);
      await fetchSuites();
      setSelectedSuiteId(data.suite?.id ?? null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to create suite');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedSuiteId) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${selectedSuiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update suite');
      }
      setEditing(false);
      await fetchSuites();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to update suite');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSuite = async () => {
    if (!selectedSuiteId) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${selectedSuiteId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete suite');
      }
      setSelectedSuiteId(null);
      setConfirmDelete(false);
      await fetchSuites();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete suite');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuiteId || !addToolId) return;
    setAddingTool(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${selectedSuiteId}/tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: addToolId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add tool');
      }
      setAddToolId('');
      await fetchSuiteDetail(selectedSuiteId);
      await fetchSuites();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to add tool');
    } finally {
      setAddingTool(false);
    }
  };

  const handleRemoveTool = async (toolId: string) => {
    if (!selectedSuiteId) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${selectedSuiteId}/tools`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool_id: toolId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove tool');
      }
      await fetchSuiteDetail(selectedSuiteId);
      await fetchSuites();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove tool');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuiteId || !addMemberEmail.trim()) return;
    setAddingMember(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${selectedSuiteId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: addMemberEmail.trim(), role: addMemberRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add member');
      }
      setAddMemberEmail('');
      setAddMemberRole('member');
      await fetchSuiteDetail(selectedSuiteId);
      await fetchSuites();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (email: string) => {
    if (!selectedSuiteId) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${selectedSuiteId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to remove member');
      }
      await fetchSuiteDetail(selectedSuiteId);
      await fetchSuites();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleChangeRole = async (email: string, newRole: 'member' | 'manager') => {
    if (!selectedSuiteId) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/tool-suites/${selectedSuiteId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to change role');
      }
      await fetchSuiteDetail(selectedSuiteId);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  // Resolve display name for a tool_id
  const getToolDisplayName = (toolId: string): string => {
    const found = allTools.find((t) => t.tool_id === toolId);
    return found?.display_name ?? toolId;
  };

  // --- Render ---

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', fontSize: '14px' }}>
        Loading suite management...
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
      {/* Left Panel — Suite List */}
      <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
            Suites
          </p>
          <button
            onClick={() => { setShowCreateForm(!showCreateForm); setActionError(null); }}
            style={{ ...btnPrimary, padding: '5px 12px', fontSize: '12px' }}
            title="Create a new tool suite to group tools and manage access for an organization"
          >
            + New Suite
          </button>
        </div>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '12px', marginBottom: '0.5rem' }}
           title="Tool suites group multiple tools together and let you manage access for entire organizations at once"
        >
          Group tools into suites for organization-level access management.
        </p>

        {/* Create Suite Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateSuite} style={{ ...cardStyle, border: '2px dashed #0F7490', background: '#f0fdfa' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}
                       title="The human-readable name for this suite (e.g., 'NWCT Arts Council')"
                >
                  Suite Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (!newSlug) { /* auto-slug from name if slug is empty */ }
                  }}
                  placeholder="e.g., NWCT Arts Council"
                  style={inputStyle}
                  title="Enter a name for the new suite"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}
                       title="URL-safe identifier. Auto-generated from name if left blank"
                >
                  Slug (optional)
                </label>
                <input
                  type="text"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder={newName ? slugify(newName) : 'auto-generated'}
                  style={inputStyle}
                  title="URL-safe slug identifier — leave blank to auto-generate from the suite name"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}
                       title="Brief description of what this suite is for"
                >
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description"
                  style={inputStyle}
                  title="Briefly describe the purpose of this suite"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowCreateForm(false); setNewName(''); setNewSlug(''); setNewDescription(''); }}
                  style={{ ...btnSecondary, padding: '5px 12px', fontSize: '12px' }}
                  title="Cancel creating a new suite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newName.trim()}
                  style={{ ...btnPrimary, padding: '5px 12px', fontSize: '12px', opacity: creating ? 0.6 : 1 }}
                  title="Create this suite"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Suite Cards */}
        {suites.map((suite) => {
          const isSelected = selectedSuiteId === suite.id;
          return (
            <div
              key={suite.id}
              onClick={() => setSelectedSuiteId(suite.id)}
              style={{
                ...cardStyle,
                cursor: 'pointer',
                borderColor: isSelected ? '#0F7490' : '#e2e8f0',
                background: isSelected ? '#f0fdfa' : '#ffffff',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              title={`Select suite "${suite.name}" to view and manage its tools and members`}
            >
              <div style={{ fontWeight: 700, fontSize: '13px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
                {suite.name}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}
                   title={`Slug: ${suite.slug}`}
              >
                {suite.slug}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: '#f1f5f9',
                    color: '#475569',
                  }}
                  title={`This suite contains ${suite.tool_count} tool${suite.tool_count !== 1 ? 's' : ''}`}
                >
                  {suite.tool_count} tool{suite.tool_count !== 1 ? 's' : ''}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    background: '#f1f5f9',
                    color: '#475569',
                  }}
                  title={`This suite has ${suite.member_count} member${suite.member_count !== 1 ? 's' : ''}`}
                >
                  {suite.member_count} member{suite.member_count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}

        {suites.length === 0 && !showCreateForm && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '13px' }}
               title="No suites have been created yet. Click '+ New Suite' to create one"
          >
            No suites created yet.
          </div>
        )}
      </div>

      {/* Right Panel — Suite Detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {!selectedSuiteId ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: '#94a3b8', fontSize: '14px' }}
               title="Click a suite from the left panel to manage it"
          >
            Select a suite to manage its tools and members.
          </div>
        ) : detailLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '13px' }}>
            Loading suite details...
          </div>
        ) : (
          <>
            {/* Action error banner */}
            {actionError && (
              <div style={{ ...cardStyle, borderColor: '#fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: '13px' }}>
                {actionError}
                <button
                  onClick={() => setActionError(null)}
                  style={{ marginLeft: '12px', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: 700, fontSize: '13px' }}
                  title="Dismiss this error message"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Section A: Suite Info */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={sectionHeading} title="Basic information about this suite">Suite Info</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!editing ? (
                    <>
                      <button
                        onClick={() => {
                          setEditing(true);
                          setEditName(selectedSuite?.name ?? '');
                          setEditDescription(selectedSuite?.description ?? '');
                        }}
                        style={{ ...btnSecondary, padding: '4px 12px', fontSize: '12px' }}
                        title="Edit this suite's name and description"
                      >
                        Edit
                      </button>
                      {!confirmDelete ? (
                        <button
                          onClick={() => setConfirmDelete(true)}
                          style={{ ...btnSecondary, padding: '4px 12px', fontSize: '12px', color: '#ef4444' }}
                          title="Delete this suite permanently — this will remove all tool and member associations"
                        >
                          Delete
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 600 }}
                                title="This action cannot be undone. All members will lose suite-granted access"
                          >
                            Confirm?
                          </span>
                          <button
                            onClick={handleDeleteSuite}
                            disabled={deleting}
                            style={{ ...btnSecondary, padding: '4px 10px', fontSize: '11px', color: '#ef4444', opacity: deleting ? 0.6 : 1 }}
                            title="Confirm deletion — this cannot be undone"
                          >
                            {deleting ? 'Deleting...' : 'Yes, Delete'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(false)}
                            style={{ ...btnSecondary, padding: '4px 10px', fontSize: '11px' }}
                            title="Cancel deletion"
                          >
                            No
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditing(false)}
                        style={{ ...btnSecondary, padding: '4px 12px', fontSize: '12px' }}
                        title="Cancel editing without saving changes"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={savingEdit || !editName.trim()}
                        style={{ ...btnPrimary, padding: '4px 12px', fontSize: '12px', opacity: savingEdit ? 0.6 : 1 }}
                        title="Save changes to suite name and description"
                      >
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!editing ? (
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}
                       title="Suite name"
                  >
                    {selectedSuite?.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}
                       title="URL-safe slug identifier for this suite"
                  >
                    Slug: {selectedSuite?.slug}
                  </div>
                  {selectedSuite?.description && (
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}
                         title="Suite description"
                    >
                      {selectedSuite.description}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}
                       title={`Created by ${selectedSuite?.created_by ?? 'unknown'} on ${selectedSuite?.created_at ? new Date(selectedSuite.created_at).toLocaleDateString() : 'unknown date'}`}
                  >
                    Created by {selectedSuite?.created_by ?? 'unknown'} &middot;{' '}
                    {selectedSuite?.created_at ? new Date(selectedSuite.created_at).toLocaleDateString() : ''}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}
                           title="The display name for this suite"
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={inputStyle}
                      title="Edit the suite name"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}
                           title="Optional description of this suite's purpose"
                    >
                      Description
                    </label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Optional description"
                      style={inputStyle}
                      title="Edit the suite description"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Section B: Tools */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={sectionHeading} title="Tools included in this suite — members get access to all tools listed here">
                  Tools ({suiteTools.length})
                </p>
              </div>

              {/* Add tool form */}
              <form onSubmit={handleAddTool} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <select
                  value={addToolId}
                  onChange={(e) => setAddToolId(e.target.value)}
                  style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                  title="Select a tool to add to this suite — only tools not already in the suite are shown"
                >
                  <option value="">Select a tool to add...</option>
                  {availableTools.map((t) => (
                    <option key={t.tool_id} value={t.tool_id}>
                      {t.display_name} ({t.tool_id})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={addingTool || !addToolId}
                  style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: addingTool || !addToolId ? 0.6 : 1 }}
                  title="Add the selected tool to this suite — all suite members will gain access"
                >
                  {addingTool ? 'Adding...' : 'Add Tool'}
                </button>
              </form>

              {suiteTools.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '13px' }}
                     title="No tools have been added to this suite yet"
                >
                  No tools in this suite yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {suiteTools.map((st) => (
                    <div
                      key={st.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a2e' }}
                              title={`Tool ID: ${st.tool_id}`}
                        >
                          {getToolDisplayName(st.tool_id)}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}
                              title={`Added on ${new Date(st.added_at).toLocaleDateString()}`}
                        >
                          {st.tool_id}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveTool(st.tool_id)}
                        style={{ ...btnSecondary, padding: '3px 10px', fontSize: '11px', color: '#ef4444' }}
                        title={`Remove "${getToolDisplayName(st.tool_id)}" from this suite — members will lose access unless they have a direct grant`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section C: Members */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={sectionHeading} title="Users who belong to this suite and their roles — members get tool access, managers can also add/remove members">
                  Members ({suiteMembers.length})
                </p>
              </div>

              {/* Add member form */}
              <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input
                  type="email"
                  required
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{ ...inputStyle, flex: 1 }}
                  title="Enter the email address of the user to add to this suite"
                />
                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value as 'member' | 'manager')}
                  style={{ ...inputStyle, width: '120px', flex: 'none', cursor: 'pointer' }}
                  title="Role: 'member' gets tool access only; 'manager' can also add/remove members"
                >
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                </select>
                <button
                  type="submit"
                  disabled={addingMember || !addMemberEmail.trim()}
                  style={{ ...btnPrimary, whiteSpace: 'nowrap', opacity: addingMember || !addMemberEmail.trim() ? 0.6 : 1 }}
                  title="Add this user to the suite with the selected role"
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </form>

              {suiteMembers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '13px' }}
                     title="No members have been added to this suite yet"
                >
                  No members in this suite yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {suiteMembers.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        background: '#f8fafc',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#1a1a2e' }}
                              title={`Email: ${m.user_email}`}
                        >
                          {m.user_email}
                        </span>
                        <span style={{ marginLeft: '8px' }} title={`Role: ${m.role} — ${m.role === 'manager' ? 'can add/remove members' : 'tool access only'}`}>
                          <span style={roleBadge(m.role)}>{m.role}</span>
                        </span>
                        <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}
                              title={`Added by ${m.granted_by ?? 'unknown'} on ${new Date(m.granted_at).toLocaleDateString()}`}
                        >
                          by {m.granted_by ?? 'unknown'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <select
                          value={m.role}
                          onChange={(e) => handleChangeRole(m.user_email, e.target.value as 'member' | 'manager')}
                          style={{
                            ...inputStyle,
                            width: 'auto',
                            padding: '3px 8px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                          title={`Change role for ${m.user_email} — 'member' for tool access only, 'manager' to allow adding/removing members`}
                        >
                          <option value="member">Member</option>
                          <option value="manager">Manager</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(m.user_email)}
                          style={{ ...btnSecondary, padding: '3px 10px', fontSize: '11px', color: '#ef4444' }}
                          title={`Remove ${m.user_email} from this suite — they will lose access to all suite tools unless they have direct grants`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
