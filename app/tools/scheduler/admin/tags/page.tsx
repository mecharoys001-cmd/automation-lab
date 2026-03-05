'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Pencil, Trash2, Loader2, Check, AlertTriangle, Plus, ChevronDown, FolderOpen, X } from 'lucide-react';
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
  category: string;
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
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

  // Category management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [customCategories, setCustomCategories] = useState<string[]>([]); // Track user-created categories

  // Quick-add state
  const [quickAddValue, setQuickAddValue] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('General');
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddSuccess, setQuickAddSuccess] = useState(false);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editCategory, setEditCategory] = useState('General');
  const [editLoading, setEditLoading] = useState(false);

  // Per-category quick add
  const [categoryQuickAdd, setCategoryQuickAdd] = useState<string | null>(null);
  const [categoryQuickAddValue, setCategoryQuickAddValue] = useState('');
  const [categoryQuickAddLoading, setCategoryQuickAddLoading] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);
  let toastCounter = useRef(0);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type, id: ++toastCounter.current });
  }, []);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTags(json.tags ?? []);
      setSessionCounts(json.sessionCounts ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Load custom categories from localStorage on mount
  useEffect(() => {
    const savedCategories = localStorage.getItem('customTagCategories');
    if (savedCategories) {
      try {
        setCustomCategories(JSON.parse(savedCategories));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save custom categories to localStorage whenever they change
  useEffect(() => {
    if (customCategories.length > 0) {
      localStorage.setItem('customTagCategories', JSON.stringify(customCategories));
    }
  }, [customCategories]);

  // Get all unique categories (from tags + custom ones)
  const categoriesFromTags = Array.from(new Set(tags.map(t => t.category || 'General')));
  const categories = Array.from(new Set([...categoriesFromTags, ...customCategories])).sort();

  // Quick add tag
  const handleQuickAdd = async () => {
    const trimmed = quickAddValue.trim();
    if (!trimmed) {
      setQuickAddError('Tag name cannot be empty');
      return;
    }

    setQuickAddLoading(true);
    setQuickAddError(null);
    setQuickAddSuccess(false);

    try {
      const emoji = getEmojiForTag(trimmed);
      const description = TAG_DESCRIPTIONS[trimmed.toLowerCase()] || '';

      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: trimmed, 
          emoji, 
          description, 
          category: quickAddCategory 
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setQuickAddValue('');
      setQuickAddSuccess(true);
      await fetchTags();
      showToast(`Tag "${trimmed}" created successfully`, 'success');
    } catch (err) {
      setQuickAddError(err instanceof Error ? err.message : 'Failed to create tag');
    } finally {
      setQuickAddLoading(false);
    }
  };

  // Start edit
  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditDescription(tag.description || '');
    setEditEmoji(tag.emoji || '');
    setEditCategory(tag.category || 'General');
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDescription('');
    setEditEmoji('');
    setEditCategory('General');
  };

  // Save edit
  const saveEdit = async (id: string) => {
    setEditLoading(true);
    try {
      const res = await fetch(`/api/tags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          emoji: editEmoji.trim() || null,
          category: editCategory.trim() || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      await fetchTags();
      showToast('Tag updated successfully', 'success');
      cancelEdit();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update tag', 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // Delete tag
  const deleteTag = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    setDeleteLoading(true);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      await fetchTags();
      showToast(`Tag "${name}" deleted successfully`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete tag', 'error');
    } finally {
      setDeleteLoading(false);
      setDeletingId(null);
    }
  };

  // Toggle category collapse
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Create new category
  const createCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      return;
    }
    if (categories.includes(trimmed)) {
      // Category already exists, just select it
      setQuickAddCategory(trimmed);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      quickAddRef.current?.focus();
      return;
    }
    // Add to custom categories
    setCustomCategories(prev => [...prev, trimmed]);
    setQuickAddCategory(trimmed);
    setNewCategoryName('');
    setShowNewCategoryInput(false);
    showToast(`Category "${trimmed}" created`, 'success');
    quickAddRef.current?.focus();
  };

  // Quick add tag to specific category
  const handleCategoryQuickAdd = async (category: string) => {
    const trimmed = categoryQuickAddValue.trim();
    if (!trimmed) return;

    setCategoryQuickAddLoading(true);

    try {
      const emoji = getEmojiForTag(trimmed);
      const description = TAG_DESCRIPTIONS[trimmed.toLowerCase()] || '';

      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: trimmed, 
          emoji, 
          description, 
          category 
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setCategoryQuickAddValue('');
      setCategoryQuickAdd(null);
      await fetchTags();
      showToast(`Tag "${trimmed}" added to ${category}`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create tag', 'error');
    } finally {
      setCategoryQuickAddLoading(false);
    }
  };

  if (loading && tags.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Loading tags...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <Button variant="primary" onClick={fetchTags} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Toast */}
      {toast && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="bg-white px-8 py-5 border-b border-slate-200 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tags</h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize sessions with categorical tags for filtering and reporting
          </p>
        </div>
      </div>

      {/* Quick Add */}
      <div className="bg-white px-8 py-4 border-b border-slate-200 shrink-0">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Quick Add Tag
            </label>
            <input
              ref={quickAddRef}
              type="text"
              value={quickAddValue}
              onChange={(e) => { setQuickAddValue(e.target.value); setQuickAddError(null); setQuickAddSuccess(false); }}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
              placeholder="e.g., Percussion, Strings..."
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors"
              disabled={quickAddLoading}
            />
            {quickAddError && <p className="text-xs text-red-600 mt-1">{quickAddError}</p>}
            {quickAddSuccess && <p className="text-xs text-emerald-600 mt-1">✓ Tag created</p>}
          </div>

          <div className="w-48">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Category
            </label>
            <select
              value={quickAddCategory}
              onChange={(e) => setQuickAddCategory(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-colors appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: 'right 0.5rem center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: '1.25rem 1.25rem',
                paddingRight: '2rem',
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <Button
            variant="primary"
            onClick={handleQuickAdd}
            disabled={quickAddLoading || !quickAddValue.trim()}
            icon={quickAddLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          >
            {quickAddLoading ? 'Adding...' : 'Add Tag'}
          </Button>

          <Button
            variant="secondary"
            onClick={() => setShowNewCategoryInput(true)}
            icon={<FolderOpen className="w-4 h-4" />}
            tooltip="Create a new category"
          >
            New Category
          </Button>
        </div>

        {/* New Category Input */}
        {showNewCategoryInput && (
          <div className="mt-3 flex gap-2 items-center bg-blue-50 border border-blue-200 rounded-lg p-3">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') createCategory();
                if (e.key === 'Escape') { setNewCategoryName(''); setShowNewCategoryInput(false); }
              }}
              placeholder="Category name..."
              className="flex-1 h-9 rounded-lg border border-blue-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              autoFocus
            />
            <Button variant="primary" size="sm" onClick={createCategory} disabled={!newCategoryName.trim()}>
              Create
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setNewCategoryName(''); setShowNewCategoryInput(false); }}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Tags List (Grouped by Category) */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="space-y-4">
          {categories.map(category => {
            const categoryTags = tags.filter(t => (t.category || 'General') === category);
            const isCollapsed = collapsedCategories.has(category);

            return (
              <div key={category} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Category Header */}
                <div className="bg-slate-50 border-b border-slate-200">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      <h3 className="text-sm font-bold text-slate-900">{category}</h3>
                      <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-medium">
                        {categoryTags.length}
                      </span>
                    </div>
                    <Tooltip text={`Add tag to ${category}`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategoryQuickAdd(category);
                          setCategoryQuickAddValue('');
                        }}
                        className="p-1.5 rounded hover:bg-slate-200 transition-colors text-slate-400 hover:text-blue-600"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </Tooltip>
                  </button>
                  
                  {/* Quick Add Field for this category */}
                  {categoryQuickAdd === category && (
                    <div className="px-5 pb-3 flex gap-2">
                      <input
                        type="text"
                        value={categoryQuickAddValue}
                        onChange={(e) => setCategoryQuickAddValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCategoryQuickAdd(category);
                          if (e.key === 'Escape') setCategoryQuickAdd(null);
                        }}
                        placeholder={`Add tag to ${category}...`}
                        className="flex-1 h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                        autoFocus
                        disabled={categoryQuickAddLoading}
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleCategoryQuickAdd(category)}
                        disabled={categoryQuickAddLoading || !categoryQuickAddValue.trim()}
                        icon={categoryQuickAddLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      >
                        Add
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setCategoryQuickAdd(null)}
                        icon={<X className="w-4 h-4" />}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tags in Category */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {categoryTags.length === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <p className="text-sm text-slate-400">No tags in this category yet.</p>
                        <p className="text-xs text-slate-400 mt-1">Click the + button above to add a tag to "{category}"</p>
                      </div>
                    ) : (
                      categoryTags.map(tag => {
                      const isEditing = editingId === tag.id;
                      const isDeleting = deletingId === tag.id;
                      const sessionCount = sessionCounts[tag.id] || 0;

                      return (
                        <div key={tag.id} className="px-5 py-3 hover:bg-slate-50 transition-colors">
                          {isEditing ? (
                            // Edit Mode
                            <div className="space-y-3">
                              <div className="flex gap-3">
                                <EmojiPicker
                                  value={editEmoji}
                                  onChange={setEditEmoji}
                                  className="shrink-0"
                                />
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                    placeholder="Tag name"
                                  />
                                </div>
                                <select
                                  value={editCategory}
                                  onChange={(e) => setEditCategory(e.target.value)}
                                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                                >
                                  {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>
                              <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                                placeholder="Optional description"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => saveEdit(tag.id)}
                                  disabled={editLoading || !editName.trim()}
                                >
                                  {editLoading ? 'Saving...' : 'Save'}
                                </Button>
                                <Button variant="secondary" size="sm" onClick={cancelEdit}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <div className="flex items-center gap-3">
                              <span className="text-2xl shrink-0">{tag.emoji || '🎵'}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-slate-900">{tag.name}</span>
                                  {sessionCount > 0 && (
                                    <Tooltip text={`Used in ${sessionCount} session${sessionCount === 1 ? '' : 's'}`}>
                                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                                        {sessionCount}
                                      </span>
                                    </Tooltip>
                                  )}
                                </div>
                                {getDescriptionForTag(tag) && (
                                  <p className="text-xs text-slate-500 mt-0.5">{getDescriptionForTag(tag)}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Tooltip text="Edit tag">
                                  <button
                                    onClick={() => startEdit(tag)}
                                    className="p-1.5 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-blue-600"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                </Tooltip>
                                <Tooltip text={sessionCount > 0 ? `Cannot delete: used in ${sessionCount} sessions` : 'Delete tag'}>
                                  <button
                                    onClick={() => deleteTag(tag.id, tag.name)}
                                    disabled={isDeleting || sessionCount > 0}
                                    className="p-1.5 rounded hover:bg-red-50 transition-colors text-slate-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </Tooltip>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {categories.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-sm text-slate-500">No tags yet. Create your first tag above!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
