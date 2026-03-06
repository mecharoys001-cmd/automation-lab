'use client';

import { useMemo } from 'react';
import { Music } from 'lucide-react';
import { SUBJECT_COLORS, getSubjectColor } from '../../lib/subjectColors';
import type { SubjectColor } from '../../lib/subjectColors';

interface EventTemplate {
  id: string;
  tags?: { name: string }[] | string[];
  required_skills?: string[] | null;
}

interface SubjectDashboardProps {
  /** All event templates to summarise */
  templates: EventTemplate[];
  className?: string;
}

interface SubjectStat {
  name: string;
  count: number;
  color: SubjectColor;
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

export function SubjectDashboard({ templates, className = '' }: SubjectDashboardProps) {
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
        sorted.push({ name: title, count, color: getSubjectColor(title) });
        counts.delete(title);
      }
    }
    // Remaining (unknown subjects)
    for (const [name, count] of Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      sorted.push({ name, count, color: getSubjectColor(name) });
    }
    return sorted;
  }, [templates]);

  const totalTemplates = templates.length;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {/* Stats inline */}
      {stats.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-slate-400">
          No event templates yet
        </div>
      ) : (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Subjects</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">{totalTemplates} total</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.map((stat) => (
              <SubjectCard key={stat.name} stat={stat} total={totalTemplates} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubjectCard({ stat, total }: { stat: SubjectStat; total: number }) {
  const pct = total > 0 ? Math.round((stat.count / total) * 100) : 0;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-all hover:shadow-sm"
      style={{
        backgroundColor: stat.color.eventBg,
        borderLeft: `3px solid ${stat.color.accent}`,
      }}
    >
      <span className="text-sm">{stat.color.emoji}</span>
      <span className="text-xs font-medium text-slate-700">{stat.name}</span>
      <span
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded text-xs font-semibold tabular-nums"
        style={{
          backgroundColor: stat.color.accent,
          color: '#FFFFFF',
        }}
      >
        {stat.count}
      </span>
    </div>
  );
}
