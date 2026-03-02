'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Pencil, Trash2, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';
import { EmojiPicker } from '../../components/ui/EmojiPicker';

// ── Toast Notification ───────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function ToastNotification({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-[13px] font-medium text-white ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    >
      {isSuccess ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

interface Tag {
  id: string;
  name: string;
  description?: string | null;
  emoji?: string | null;
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

const TAG_DESCRIPTIONS: Record<string, string> = {
  percussion: 'Drum sets, timpani, and mallet instruments',
  choral: 'Voice training and choir rehearsals',
  strings: 'Violin, viola, cello, and bass',
  brass: 'Trumpet, trombone, and horn sections',
  piano: 'Piano lessons and keyboard practice',
  guitar: 'Acoustic and electric guitar classes',
  woodwind: 'Flute, clarinet, and oboe sessions',
  'field trip': 'Off-site musical excursions',
  showcase: 'Performance and recital events',
};

function getEmojiForTag(name: string): string {
  const lower = name.toLowerCase();
  for (const entry of TAG_EMOJI_MAP) {
    if (entry.patterns.some((p) => lower.includes(p))) {
      return entry.emoji;
    }
  }
  return '🎵';
}

function getDescriptionForTag(tag: Tag): string {
  if (tag.description) return tag.description;
  const lower = tag.name.toLowerCase();
  return TAG_DESCRIPTIONS[lower] || '';
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick-add state
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEmoji, setEditEmoji] = useState('🎵');
  const [saving, setSaving] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<ToastState | null>(null);

  // Warning toast state
  const [warningToast, setWarningToast] = useState<string | null>(null);

  // Delete state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  // Whether the DB has the v2 columns (description/emoji) — tracks API warnings
  const [v2ColumnsAvailable, setV2ColumnsAvailable] = useState(true);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cache-bust to ensure we always get fresh data after mutations
      const res = await fetch(`/api/tags?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to fetch tags: ${res.status}`);
      const { tags: data, sessionCounts } = (await res.json()) as {
        tags: Tag[];
        sessionCounts?: Record<string, number>;
      };
      console.log('[fetchTags] received', data.length, 'tags, emojis:', data.map(t => `${t.name}=${t.emoji}`).join(', '));
      setTags(data);
      if (sessionCounts) {
        setUsageCounts(sessionCounts);
      }
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
    const names = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (names.length === 0) return;
    setQuickAddLoading(true);
    setQuickAddError(null);
    setQuickAddSuccess(false);
    const errors: string[] = [];
    let created = 0;
    for (const raw_entry of names) {
      const parts = raw_entry.split('|').map(s => s.trim());
      const name = parts[0];
      const description = parts[1] || undefined;
      const emoji = getEmojiForTag(name);
      try {
        const res = await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, emoji }),
        });
        const data = await res.json();
        if (!res.ok) {
          errors.push(`"${name}": ${data.error || 'failed'}`);
        } else {
          created++;
          if (data.warning) {
            setV2ColumnsAvailable(false);
            setWarningToast(data.warning);
            setTimeout(() => setWarningToast(null), 5000);
          }
        }
      } catch (err) {
        errors.push(`"${name}": ${err instanceof Error ? err.message : 'failed'}`);
      }
    }
    if (errors.length > 0) {
      setQuickAddError(errors.join('; '));
      setToast({ message: `Failed to add ${errors.length} tag${errors.length !== 1 ? 's' : ''}`, type: 'error', id: Date.now() });
    }
    if (created > 0) {
      setQuickAddValue('');
      setQuickAddSuccess(true);
      await fetchTags();
      setToast({ message: `${created} tag${created !== 1 ? 's' : ''} added successfully`, type: 'success', id: Date.now() });
      setTimeout(() => setQuickAddSuccess(false), 2000);
    }
    quickAddRef.current?.focus();
    setQuickAddLoading(false);
  };

  const handleEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const patchBody = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        emoji: editEmoji
      };
      console.log('[handleEdit] sending PATCH:', JSON.stringify(patchBody));
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchBody),
      });
      const data = await res.json();
      console.log('[handleEdit] response:', res.status, JSON.stringify(data));
      if (!res.ok) {
        setError(data.error || 'Failed to update tag');
        setToast({ message: data.error || 'Failed to update tag', type: 'error', id: Date.now() });
        return;
      }
      if (data.warning) {
        setV2ColumnsAvailable(false);
        setWarningToast(data.warning);
        setTimeout(() => setWarningToast(null), 5000);
        // Don't show success toast — emoji/description were NOT saved
        setToast({ message: 'Tag name saved, but emoji/description require a database migration', type: 'error', id: Date.now() });
      } else {
        setToast({ message: 'Tag updated successfully', type: 'success', id: Date.now() });
      }
      setEditingId(null);
      setEditName('');
      setEditDescription('');
      setEditEmoji('🎵');
      await fetchTags();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update tag';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (tag: Tag) => {
    setDeleteConfirmId(tag.id);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Failed to delete tag';
        setError(msg);
        setToast({ message: msg, type: 'error', id: Date.now() });
        setDeleteConfirmId(null);
        return;
      }
      setDeleteConfirmId(null);
      await fetchTags();
      setToast({ message: 'Tag deleted successfully', type: 'success', id: Date.now() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete tag';
      setError(msg);
      setToast({ message: msg, type: 'error', id: Date.now() });
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditDescription(tag.description ?? '');
    setEditEmoji(tag.emoji ?? getEmojiForTag(tag.name));
    setDeleteConfirmId(null);
  };

  // Build rows of 3 for the grid
  const tagRows: Tag[][] = [];
  for (let i = 0; i < tags.length; i += 3) {
    tagRows.push(tags.slice(i, i + 3));
  }

  return (
    <div
      className="overflow-y-auto h-full"
      style={{ backgroundColor: '#F8FAFC', padding: 32 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Tags Management
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            Manage event type tags and categories
          </p>
        </div>

        {/* Quick Add Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tooltip text="Type tag names separated by commas to add multiple at once">
            <input
              ref={quickAddRef}
              type="text"
              placeholder="Add new tag..."
              value={quickAddValue}
              onChange={(e) => {
                setQuickAddValue(e.target.value);
                if (quickAddError) setQuickAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleQuickAdd();
              }}
              disabled={quickAddLoading}
              style={{
                height: 40,
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                padding: '0 12px',
                fontSize: 14,
                color: '#0F172A',
                outline: 'none',
                flex: 1,
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </Tooltip>
          <Tooltip text="Add a new tag to your collection">
            <Button
              variant="primary"
              onClick={handleQuickAdd}
              disabled={quickAddLoading || !quickAddValue.trim()}
              style={{
                height: 40,
                borderRadius: 8,
                padding: '0 20px',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {quickAddLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Adding…
                </>
              ) : 'Add Tag'}
            </Button>
          </Tooltip>
        </div>

        {/* Hint Text */}
        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
          Tip: Use commas to add multiple tags at once
        </p>

        {/* Success/Error feedback */}
        {quickAddSuccess && (
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 500 }}>
            Tag added successfully!
          </div>
        )}
        {quickAddError && (
          <div style={{
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            padding: '8px 12px',
            fontSize: 13,
            color: '#EF4444',
          }}>
            {quickAddError}
          </div>
        )}
        {error && (
          <div style={{
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            padding: '8px 12px',
            fontSize: 13,
            color: '#EF4444',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {error}
            <Tooltip text="Dismiss this error">
              <button
                onClick={() => setError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  fontSize: 12,
                  textDecoration: 'underline',
                  opacity: 0.7,
                }}
              >
                dismiss
              </button>
            </Tooltip>
          </div>
        )}
        {warningToast && (
          <div style={{
            borderRadius: 8,
            border: '1px solid rgba(245, 158, 11, 0.3)',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            padding: '8px 12px',
            fontSize: 13,
            color: '#D97706',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {warningToast}
            <Tooltip text="Dismiss this warning">
              <button
                onClick={() => setWarningToast(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#D97706',
                  cursor: 'pointer',
                  fontSize: 12,
                  textDecoration: 'underline',
                  opacity: 0.7,
                }}
              >
                dismiss
              </button>
            </Tooltip>
          </div>
        )}

        {/* Migration banner — shown when v2 columns are unavailable */}
        {!v2ColumnsAvailable && (
          <div style={{
            borderRadius: 8,
            border: '1px solid rgba(59, 130, 246, 0.3)',
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
            padding: '10px 14px',
            fontSize: 13,
            color: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{ fontSize: 16 }}>💡</span>
            Emoji and description fields require a database migration.
            Run <code style={{ fontFamily: 'monospace', backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: '1px 4px', borderRadius: 3 }}>
              008_tags_description_emoji.sql
            </code> to enable full tag customization.
          </div>
        )}

        {/* Tag Grid */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[0, 1, 2].map((r) => (
              <div key={r} style={{ display: 'flex', gap: 20 }}>
                {[0, 1, 2].map((c) => (
                  <div
                    key={c}
                    style={{
                      flex: 1,
                      height: 160,
                      borderRadius: 12,
                      backgroundColor: '#E2E8F0',
                      opacity: 0.4,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : tags.length === 0 ? (
          <div style={{
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            padding: 48,
            textAlign: 'center',
            color: '#94A3B8',
            fontSize: 14,
          }}>
            No tags yet. Use the input above to create your first tag.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {tagRows.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', gap: 20 }}>
                {row.map((tag) => {
                  const emoji = tag.emoji ?? getEmojiForTag(tag.name);
                  const description = getDescriptionForTag(tag);
                  const sessionCount = usageCounts[tag.id];
                  const isEditing = editingId === tag.id;

                  return (
                    <Tooltip key={tag.id} text={`${emoji} ${tag.name}${description ? ` — ${description}` : ''}`}>
                      <div
                        style={{
                          flex: 1,
                          backgroundColor: '#FFFFFF',
                          borderRadius: 12,
                          padding: 20,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        {isEditing ? (
                          /* Edit mode */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Tooltip text="Choose an emoji for this tag">
                              <div>
                                <EmojiPicker
                                  value={editEmoji}
                                  onChange={setEditEmoji}
                                />
                              </div>
                            </Tooltip>
                            <Tooltip text="Tag name (Enter to save, Esc to cancel)">
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
                                    setEditEmoji('🎵');
                                  }
                                }}
                                autoFocus
                                style={{
                                  fontSize: 14,
                                  fontWeight: 600,
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #E2E8F0',
                                  outline: 'none',
                                  color: '#0F172A',
                                }}
                              />
                            </Tooltip>
                            <Tooltip text="Optional description for this tag">
                              <textarea
                                placeholder="Description..."
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={2}
                                style={{
                                  fontSize: 13,
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  border: '1px solid #E2E8F0',
                                  outline: 'none',
                                  color: '#64748B',
                                  resize: 'none',
                                }}
                              />
                            </Tooltip>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleEdit(tag.id)}
                                disabled={saving || !editName.trim()}
                                tooltip="Save tag details"
                              >
                                {saving ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Saving…
                                  </>
                                ) : 'Save'}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditName('');
                                  setEditDescription('');
                                  setEditEmoji('🎵');
                                }}
                                tooltip="Discard changes"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Display mode */
                          <>
                            <span style={{ fontSize: 36, lineHeight: 1 }}>{emoji}</span>
                            <span style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: '#0F172A',
                            }}>
                              {tag.name}
                            </span>
                            {description && (
                              <span style={{
                                fontSize: 13,
                                color: '#64748B',
                                lineHeight: 1.4,
                              }}>
                                {description}
                              </span>
                            )}
                            {/* Card Footer */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              width: '100%',
                              marginTop: 'auto',
                            }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: '#3B82F6',
                              }}>
                                {`${sessionCount ?? 0} session${(sessionCount ?? 0) !== 1 ? 's' : ''}`}
                              </span>
                              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Tooltip text="Edit this tag">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEdit(tag);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: 2,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Pencil size={16} color="#94A3B8" />
                                  </button>
                                </Tooltip>
                                <Tooltip text="Delete this tag">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(tag);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      padding: 2,
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Trash2 size={16} color="#EF4444" />
                                  </button>
                                </Tooltip>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </Tooltip>
                  );
                })}
                {/* Fill remaining columns with empty spacers */}
                {row.length < 3 &&
                  Array.from({ length: 3 - row.length }).map((_, i) => (
                    <div key={`spacer-${i}`} style={{ flex: 1 }} />
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <ToastNotification toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (() => {
        const tag = tags.find((t) => t.id === deleteConfirmId);
        if (!tag) return null;
        const usageCount = usageCounts[tag.id];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <Tooltip text="Click outside to cancel">
              <div
                className="absolute inset-0 bg-black/60"
                onClick={() => setDeleteConfirmId(null)}
              />
            </Tooltip>
            <div style={{
              position: 'relative',
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
              padding: 24,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              maxWidth: 400,
              width: '100%',
              margin: '0 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Delete Tag
              </h2>
              <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
                Are you sure you want to delete{' '}
                <span style={{ fontWeight: 600, color: '#0F172A' }}>
                  {tag.emoji ?? getEmojiForTag(tag.name)} {tag.name}
                </span>
                ?
              </p>
              {usageCount != null && usageCount > 0 && (
                <div style={{
                  borderRadius: 8,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  padding: '8px 12px',
                  fontSize: 13,
                  color: '#D97706',
                }}>
                  This tag is assigned to {usageCount} session{usageCount !== 1 ? 's' : ''}.
                  It must be removed from all sessions before it can be deleted.
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
                <Button
                  variant="secondary"
                  onClick={() => setDeleteConfirmId(null)}
                  tooltip="Cancel deletion"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => handleDelete(tag.id)}
                  disabled={deleting}
                  tooltip="Permanently delete this tag"
                  style={{
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    borderColor: '#EF4444',
                  }}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Deleting…
                    </>
                  ) : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
