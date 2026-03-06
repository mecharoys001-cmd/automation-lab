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
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
          <Music className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Subject Overview</h3>
          <p className="text-xs text-slate-500">
            {totalTemplates} event template{totalTemplates !== 1 ? 's' : ''} across {stats.length} subject{stats.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      {stats.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-slate-400">
          No event templates yet
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-slate-100">
          {stats.map((stat) => (
            <SubjectCard key={stat.name} stat={stat} total={totalTemplates} />
          ))}
        </div>
      )}

      {/* Bar chart summary */}
      {stats.length > 0 && (
        <div className="border-t border-slate-100 px-6 py-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
            {stats.map((stat) => (
              <div
                key={stat.name}
                className="transition-all duration-300"
                style={{
                  width: `${(stat.count / totalTemplates) * 100}%`,
                  backgroundColor: stat.color.accent,
                }}
                title={`${stat.name}: ${stat.count}`}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {stats.map((stat) => (
              <div key={stat.name} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: stat.color.accent }}
                />
                {stat.name}
              </div>
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
    <div className="bg-white px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-base ${stat.color.badgeBg}`}
        >
          {stat.color.emoji}
        </span>
        <span className="text-sm font-medium text-slate-700">{stat.name}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold tabular-nums" style={{ color: stat.color.accent }}>
          {stat.count}
        </span>
        <span className="text-xs text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: stat.color.accent }}
        />
      </div>
    </div>
  );
}
