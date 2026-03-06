'use client';

import { useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
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
  /** Filter tags by category (e.g., "Skills", "Subject") */
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

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch('/api/tags');
        if (!res.ok) throw new Error('Failed to load tags');
        const json = await res.json();
        let tags = json.tags ?? [];
        
        // Filter by category if specified
        if (category) {
          tags = tags.filter((t: Tag) => t.category === category);
        }
        
        setAllTags(tags);
      } catch (err) {
        console.error('TagSelector: Failed to fetch tags:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, [category]);

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
        type="button"
        onClick={() => !disabled && setShowDropdown(!showDropdown)}
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
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
            {allTags.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400 text-center">
                No tags available{category && ` in "${category === 'Skills' ? 'Subjects' : category}" category`}
              </div>
            ) : (
              allTags.map(tag => {
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
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
