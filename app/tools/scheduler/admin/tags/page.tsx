'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Tooltip from '../../components/Tooltip';

interface Tag {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

const TAG_EMOJI_MAP: { patterns: string[]; emoji: string }[] = [
  { patterns: ['percussion', 'drums'], emoji: '🥁' },
  { patterns: ['choral', 'vocal', 'singing'], emoji: '🎤' },
  { patterns: ['strings', 'violin', 'cello'], emoji: '🎻' },
  { patterns: ['brass', 'trumpet', 'trombone'], emoji: '🎺' },
  { patterns: ['piano', 'keyboard'], emoji: '🎹' },
  { patterns: ['guitar'], emoji: '🎸' },
  { patterns: ['woodwind', 'flute', 'clarinet'], emoji: '🪈' },
  { patterns: ['field trip', 'guest artist'], emoji: '🎭' },
  { patterns: ['showcase'], emoji: '🌟' },
  { patterns: ['ta check-in', 'ta check-ins'], emoji: '📋' },
  { patterns: ['lead tas away'], emoji: '👥' },
];

function getEmojiForTag(name: string): string {
  const lower = name.toLowerCase();
  for (const entry of TAG_EMOJI_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) {
      return entry.emoji;
    }
  }
  return '🎵';
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick-add state
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Tag usage counts for delete warnings
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) throw new Error(`Failed to fetch tags: ${res.status}`);
      const { tags: data } = (await res.json()) as { tags: Tag[] };
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleQuickAdd = async () => {
    const raw = quickAddValue.trim();
    if (!raw) return;
    // Split by comma to support multiple tags at once
    const names = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    setQuickAddLoading(true);
    setQuickAddError(null);
    setQuickAddSuccess(false);
    const errors: string[] = [];
    let created = 0;
    for (const raw_entry of names) {
      // Support 'name | description' format
      const parts = raw_entry.split('|').map(s => s.trim());
      const name = parts[0];
      const description = parts[1] || undefined;
      try {
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description }),
        });
        const data = await res.json();
        if (!res.ok) {
          errors.push(`"${name}": ${data.error || 'failed'}`);
        } else {
          created++;
        }
      } catch (err) {
        errors.push(`"${name}": ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    if (errors.length > 0) {
      setQuickAddError(errors.join('; '));
    }
    if (created > 0) {
      setQuickAddValue('');
      setQuickAddSuccess(true);
      await fetchTags();
      setTimeout(() => setQuickAddSuccess(false), 2000);
    }
    quickAddRef.current?.focus();
    setQuickAddLoading(false);
  };

  const handleAdd = async () => {
    if (!newTagName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim(), description: newTagDescription.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create tag');
        return;
      }
      setNewTagName('');
      setNewTagDescription('');
      setShowAddForm(false);
      await fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update tag');
        return;
      }
      setEditingId(null);
      setEditName('');
      setEditDescription('');
      await fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (tag: Tag) => {
    // Check usage count before showing confirmation
    setDeleteConfirmId(tag.id);
    try {
      const res = await fetch(`/api/sessions?tag_id=${tag.id}`);
      if (res.ok) {
        const data = await res.json();
        const count = data.sessions?.length ?? 0;
        setUsageCounts((prev) => ({ ...prev, [tag.id]: count }));
      }
    } catch {
      // Ignore — we'll just show delete without count
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to delete tag');
        setDeleteConfirmId(null);
        return;
      }
      setDeleteConfirmId(null);
      await fetchTags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditDescription(tag.description ?? '');
    setDeleteConfirmId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tags</h1>
          <p className="text-muted-foreground mt-1">
            Manage session tags — categorize and filter events by type.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
            SQL: ALTER TABLE tags ADD COLUMN IF NOT EXISTS description TEXT;
          </p>
        </div>
        <Tooltip text="Create a new tag">
        <button
          onClick={() => {
            setShowAddForm(true);
            setError(null);
          }}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Add Tag
        </button>
        </Tooltip>
      </div>

      {/* Quick-add */}
      <div className="rounded-xl border-2 border-primary/30 bg-card p-5 shadow-sm">
        <label htmlFor="quick-add-tag" className="block text-sm font-medium text-muted-foreground mb-2">
          Quick Add
        </label>
        <Tooltip text="Type tag names (comma-separated) and press Enter to create" position="bottom">
        <div className="relative">
          <input
            ref={quickAddRef}
            id="quick-add-tag"
            type="text"
            placeholder="Tag names (comma-separated), use 'name | description' for descriptions..."
            value={quickAddValue}
            onChange={(e) => {
              setQuickAddValue(e.target.value);
              if (quickAddError) setQuickAddError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickAdd();
            }}
            disabled={quickAddLoading}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          {quickAddLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {quickAddSuccess && !quickAddLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-green-400 flex items-center gap-1.5 text-sm font-medium">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Added!
            </div>
          )}
        </div>
        </Tooltip>
        {quickAddError && (
          <p className="mt-2 text-sm text-red-400">{quickAddError}</p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <Tooltip text="Dismiss error message">
          <button
            onClick={() => setError(null)}
            className="ml-3 text-xs underline opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
          </Tooltip>
        </div>
      )}

      {/* Add Tag inline form */}
      {showAddForm && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">New Tag</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Tooltip text="Enter a name for the new tag">
              <input
                type="text"
                placeholder="Tag name (e.g. Percussion Sessions)"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAdd();
                  if (e.key === 'Escape') {
                    setShowAddForm(false);
                    setNewTagName('');
                    setNewTagDescription('');
                  }
                }}
                autoFocus
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              </Tooltip>
              <Tooltip text="Create tag">
              <button
                onClick={handleAdd}
                disabled={adding || !newTagName.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
              </Tooltip>
              <Tooltip text="Cancel creating new tag">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewTagName('');
                  setNewTagDescription('');
                }}
                className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              </Tooltip>
            </div>
            <Tooltip text="Enter an optional description for the tag" position="bottom">
            <textarea
              placeholder="Optional description shown as tooltip"
              value={newTagDescription}
              onChange={(e) => setNewTagDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
            </Tooltip>
          </div>
        </div>
      )}

      {/* Tags List */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/30" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
          No tags yet. Create your first tag to get started.
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-12" />
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Created</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr
                  key={tag.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-lg">
                    <Tooltip text={tag.description || 'This emoji appears on calendar events with this tag'}>
                    {getEmojiForTag(tag.name)}
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === tag.id ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Tooltip text="Edit tag name">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEdit(tag.id);
                              if (e.key === 'Escape') {
                                setEditingId(null);
                                setEditName('');
                                setEditDescription('');
                              }
                            }}
                            autoFocus
                            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          </Tooltip>
                          <Tooltip text="Save changes">
                          <button
                            onClick={() => handleEdit(tag.id)}
                            disabled={saving || !editName.trim()}
                            className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          </Tooltip>
                          <Tooltip text="Discard changes">
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditName('');
                              setEditDescription('');
                            }}
                            className="px-2.5 py-1 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors"
                          >
                            Cancel
                          </button>
                          </Tooltip>
                        </div>
                        <Tooltip text="Edit tag description" position="bottom">
                        <textarea
                          placeholder="Optional description shown as tooltip"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                        </Tooltip>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">{tag.name}</span>
                        {tag.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{tag.description}</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                    {new Date(tag.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId !== tag.id && (
                      <div className="flex items-center justify-end gap-2">
                        <Tooltip text="Rename this tag">
                        <button
                          onClick={() => startEdit(tag)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium border border-border text-foreground hover:bg-muted transition-colors"
                        >
                          Edit
                        </button>
                        </Tooltip>
                        <Tooltip text="Delete this tag (only if not assigned to any sessions)">
                        <button
                          onClick={() => handleDeleteClick(tag)}
                          className="px-2.5 py-1 rounded-md text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Delete
                        </button>
                        </Tooltip>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tag count footer */}
      {!loading && tags.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {tags.length} tag{tags.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (() => {
        const tag = tags.find((t) => t.id === deleteConfirmId);
        if (!tag) return null;
        const usageCount = usageCounts[tag.id];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setDeleteConfirmId(null)}
            />
            <div className="relative rounded-lg border border-border bg-card p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
              <h2 className="text-lg font-semibold">Delete Tag</h2>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">{getEmojiForTag(tag.name)} {tag.name}</span>?
              </p>
              {usageCount != null && usageCount > 0 && (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400">
                  This tag is assigned to {usageCount} session{usageCount !== 1 ? 's' : ''}.
                  It must be removed from all sessions before it can be deleted.
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Tooltip text="Cancel deletion">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                </Tooltip>
                <Tooltip text="Permanently delete this tag">
                <button
                  onClick={() => handleDelete(tag.id)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                </Tooltip>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
