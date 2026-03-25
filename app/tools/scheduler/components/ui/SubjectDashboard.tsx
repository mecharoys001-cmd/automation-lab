'use client';

import { useMemo, useEffect, useState } from 'react';
import { SUBJECT_COLORS, getSubjectColor } from '../../lib/subjectColors';
import type { SubjectColor } from '../../lib/subjectColors';
import { useProgram } from '../../admin/ProgramContext';

interface EventTemplate {
  id: string;
  tags?: { name: string }[] | string[];
  required_skills?: string[] | null;
}

interface SubjectDashboardProps {
  /** All event templates to summarise */
  templates: EventTemplate[];
  className?: string;
  /** Called when a tag card is clicked. Receives the tag name. */
  onTagClick?: (tagName: string) => void;
  /** Currently selected/active tag name (for highlight). */
  selectedTag?: string | null;
}

interface SubjectStat {
  name: string;
  count: number;
  color: SubjectColor;
  emoji: string | null;
}

interface Tag {
  id: string;
  name: string;
  emoji: string | null;
  category: string;
}

function extractSubjects(template: EventTemplate): string[] {
  const subjects: string[] = [];
  if (template.tags) {
    for (const tag of template.tags) {
      const name = typeof tag === 'string' ? tag : tag.name;
      subjects.push(name);
    }
  }
  if (template.required_skills) {
    for (const skill of template.required_skills) {
      if (!subjects.some((s) => s.toLowerCase() === skill.toLowerCase())) {
        subjects.push(skill);
      }
    }
  }
  return subjects;
}

export function SubjectDashboard({ templates, className = '', onTagClick, selectedTag }: SubjectDashboardProps) {
  const { selectedProgramId } = useProgram();
  const [tags, setTags] = useState<Tag[]>([]);

  // Fetch tags with emoji from the API
  useEffect(() => {
    if (!selectedProgramId) return;
    const fetchTags = async () => {
      try {
        const res = await fetch(`/api/tags?program_id=${selectedProgramId}&category=Event Type`);
        if (res.ok) {
          const data = await res.json();
          setTags(data.tags ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch tags:', err);
      }
    };
    fetchTags();
  }, [selectedProgramId]);

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of templates) {
      const subjects = extractSubjects(t);
      if (subjects.length === 0) {
        counts.set('Other', (counts.get('Other') ?? 0) + 1);
      } else {
        for (const s of subjects) {
          const key = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }

    // Sort known subjects first (by SUBJECT_COLORS order), then unknowns alphabetically
    const knownKeys = Object.keys(SUBJECT_COLORS);
    const sorted: SubjectStat[] = [];
    for (const known of knownKeys) {
      const title = known.charAt(0).toUpperCase() + known.slice(1);
      const count = counts.get(title);
      if (count) {
        const tag = tags.find((t) => t.name.toLowerCase() === title.toLowerCase());
        sorted.push({ 
          name: title, 
          count, 
          color: getSubjectColor(title),
          emoji: tag?.emoji ?? null,
        });
        counts.delete(title);
      }
    }
    // Remaining (unknown subjects)
    for (const [name, count] of Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      sorted.push({ 
        name, 
        count, 
        color: getSubjectColor(name),
        emoji: tag?.emoji ?? null,
      });
    }
    return sorted;
  }, [templates, tags]);

  const totalTemplates = templates.length;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {/* Stats inline */}
      {stats.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-700">
          No event templates yet
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Event Types</span>
            <span className="text-xs text-slate-700">·</span>
            <span className="text-xs text-slate-600">{totalTemplates} total</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.map((stat) => (
              <SubjectCard
                key={stat.name}
                stat={stat}
                total={totalTemplates}
                selected={selectedTag === stat.name}
                onClick={onTagClick ? () => onTagClick(stat.name) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectCard({ stat, total, selected, onClick }: {
  stat: SubjectStat;
  total: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  const pct = total > 0 ? Math.round((stat.count / total) * 100) : 0;
  // Use real emoji from database tag if available, otherwise fall back to color emoji
  const displayEmoji = stat.emoji || stat.color.emoji;
  const isClickable = !!onClick;

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all border-0',
        isClickable ? 'cursor-pointer hover:shadow-md active:scale-[0.97]' : '',
        selected ? 'shadow-md' : 'hover:shadow-sm',
      ].join(' ')}
      style={{
        backgroundColor: selected ? `${stat.color.accent}30` : stat.color.eventBg,
        borderLeft: `3px solid ${stat.color.accent}`,
        outline: selected ? `2px solid ${stat.color.accent}` : 'none',
        outlineOffset: selected ? '0px' : undefined,
      }}
    >
      <span className="text-sm">{displayEmoji}</span>
      <span className={`text-xs font-medium ${selected ? 'text-slate-900' : 'text-slate-700'}`}>{stat.name}</span>
      <span
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-xs font-semibold tabular-nums"
        style={{
          backgroundColor: stat.color.accent,
          color: '#FFFFFF',
        }}
      >
        {stat.count}
      </span>
    </button>
  );
}
