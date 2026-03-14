'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Check, X, Loader2, Plus } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface Tag {
  id: string;
  name: string;
  emoji?: string | null;
  category: string;
  description?: string | null;
}

interface TagSelectorProps {
  /** Selected tag names */
  value: string[];
  /** Callback when selection changes */
  onChange: (tags: string[]) => void;
  /** Filter tags by category (e.g., "Event Type", "Space Types") */
  category?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
}

export function TagSelector({
  value,
  onChange,
  category,
  placeholder = 'Select tags...',
  className = '',
  disabled = false,
}: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  // Inline "Add New Tag" state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagEmoji, setNewTagEmoji] = useState('');
  const [savingTag, setSavingTag] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) throw new Error('Failed to load tags');
      const json = await res.json();
      let tags = json.tags ?? [];

      // Filter by category if specified
      if (category) {
        // Normalize category: "Event Type" matches both "Event Type" and legacy "Subjects"/"Subject"
        const normalizeCategory = (cat: string) => {
          const lower = cat.toLowerCase().trim();
          if (lower === 'subject' || lower === 'subjects') return 'Event Type';
          return cat;
        };
        tags = tags.filter((t: Tag) => normalizeCategory(t.category) === normalizeCategory(category));
      }

      setAllTags(tags);
    } catch (err) {
      console.error('TagSelector: Failed to fetch tags:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleAddTag = async () => {
    if (!newTagName.trim() || savingTag) return;
    setSavingTag(true);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTagName.trim(),
          emoji: newTagEmoji.trim() || null,
          category: category || 'General',
        }),
      });
      if (!res.ok) throw new Error('Failed to create tag');
      const created = await res.json();
      const tagName = created.tag?.name ?? newTagName.trim();
      await fetchTags();
      // Auto-select the new tag
      if (!value.includes(tagName)) {
        onChange([...value, tagName]);
      }
      setNewTagName('');
      setNewTagEmoji('');
      setShowAddForm(false);
    } catch (err) {
      console.error('TagSelector: Failed to create tag:', err);
    } finally {
      setSavingTag(false);
    }
  };

  const toggleTag = (tagName: string) => {
    if (disabled) return;
    
    if (value.includes(tagName)) {
      onChange(value.filter(t => t !== tagName));
    } else {
      onChange([...value, tagName]);
    }
  };

  const removeTag = (tagName: string) => {
    if (disabled) return;
    onChange(value.filter(t => t !== tagName));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Loading tags...</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selected Tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map(tagName => {
            const tag = allTags.find(t => t.name === tagName);
            return (
              <Tooltip key={tagName} text={tag?.description || tagName}>
                <button
                  type="button"
                  onClick={() => removeTag(tagName)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {tag?.emoji && <span>{tag.emoji}</span>}
                  <span>{tagName}</span>
                  {!disabled && <X className="w-3 h-3" />}
                </button>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* Dropdown Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          if (!showDropdown && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
          }
          setShowDropdown(!showDropdown);
        }}
        disabled={disabled}
        className="w-full flex items-center justify-between text-left text-sm text-slate-500 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{value.length === 0 ? placeholder : `${value.length} selected`}</span>
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 20 20">
          <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 8l4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown */}
      {showDropdown && !disabled && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown Menu */}
          <div
            className="fixed z-[80] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg"
            style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
          >
            {allTags.length === 0 && !showAddForm ? (
              <div className="px-3 py-3 text-center">
                <p className="text-sm text-slate-400 mb-2">
                  No tags available{category && ` in "${category}" category`}
                </p>
                <Tooltip text="Create a new tag in this category">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add New Tag
                  </button>
                </Tooltip>
              </div>
            ) : (
              <>
                {allTags.map(tag => {
                  const isSelected = value.includes(tag.name);
                  return (
                    <Tooltip key={tag.id} text={tag.description || tag.name} position="right">
                      <button
                        type="button"
                        onClick={() => toggleTag(tag.name)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                          isSelected
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {tag.emoji && <span className="text-base">{tag.emoji}</span>}
                        <span className="truncate">{tag.name}</span>
                      </button>
                    </Tooltip>
                  );
                })}

                {/* Divider + Add New Tag */}
                <div className="border-t border-slate-100">
                  {showAddForm ? (
                    <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Tooltip text="Emoji for the new tag (optional)">
                          <input
                            type="text"
                            placeholder="🎵"
                            value={newTagEmoji}
                            onChange={(e) => setNewTagEmoji(e.target.value)}
                            maxLength={2}
                            className="w-10 h-8 text-center rounded border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                        </Tooltip>
                        <Tooltip text="Name for the new tag">
                          <input
                            type="text"
                            placeholder="Tag name..."
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                            className="flex-1 h-8 rounded border border-slate-200 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          />
                        </Tooltip>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <Tooltip text="Cancel creating tag">
                          <button
                            type="button"
                            onClick={() => { setShowAddForm(false); setNewTagName(''); setNewTagEmoji(''); }}
                            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </Tooltip>
                        <Tooltip text="Save new tag">
                          <button
                            type="button"
                            onClick={handleAddTag}
                            disabled={!newTagName.trim() || savingTag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                          >
                            {savingTag ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Save
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  ) : (
                    <Tooltip text="Create a new tag in this category">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add New Tag
                      </button>
                    </Tooltip>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
