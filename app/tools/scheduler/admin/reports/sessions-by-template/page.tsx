'use client';

import { useState, useEffect, useMemo } from 'react';
import { useProgram } from '../../ProgramContext';
import {
  FileText, Download, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown,
  Calendar, Tag as TagIcon, Users, MapPin, Filter, X,
} from 'lucide-react';
import { Tooltip } from '../../../components/ui/Tooltip';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';

interface TemplateSessionCount {
  template_id: string;
  template_name: string;
  grade_groups: string[];
  subjects: string[];
  day_of_week: number;
  session_count: number;
  published_count: number;
  draft_count: number;
  completed_count: number;
  canceled_count: number;
}

type SortField = 'template_name' | 'grade' | 'subject' | 'session_count' | 'published_count';
type SortDirection = 'asc' | 'desc';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SessionsByTemplatePage() {
  const { selectedProgramId } = useProgram();
  const [data, setData] = useState<TemplateSessionCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string[]>([]);
  const [dayFilter, setDayFilter] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('template_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    if (selectedProgramId) {
      fetchData();
    }
  }, [selectedProgramId]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/sessions-by-template?program_id=${selectedProgramId}`);
      const json = await res.json();
      setData(json.data ?? []);
    } catch (err) {
      console.error('Failed to load sessions by template:', err);
    } finally {
      setLoading(false);
    }
  }

  // Extract unique values for filters
  const allGrades = useMemo(() => {
    const grades = new Set<string>();
    data.forEach((row) => row.grade_groups.forEach((g) => grades.add(g)));
    return Array.from(grades).sort();
  }, [data]);

  const allSubjects = useMemo(() => {
    const subjects = new Set<string>();
    data.forEach((row) => row.subjects.forEach((s) => subjects.add(s)));
    return Array.from(subjects).sort();
  }, [data]);

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter((row) => {
      // Grade filter
      if (gradeFilter.length > 0 && !row.grade_groups.some((g) => gradeFilter.includes(g))) {
        return false;
      }
      // Subject filter
      if (subjectFilter.length > 0 && !row.subjects.some((s) => subjectFilter.includes(s))) {
        return false;
      }
      // Day filter
      if (dayFilter.length > 0 && !dayFilter.includes(row.day_of_week)) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        const relevantCount =
          statusFilter === 'published' ? row.published_count :
          statusFilter === 'draft' ? row.draft_count :
          statusFilter === 'completed' ? row.completed_count :
          row.canceled_count;
        if (relevantCount === 0) return false;
      }
      return true;
    });
  }, [data, gradeFilter, subjectFilter, dayFilter, statusFilter]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case 'template_name':
          aVal = a.template_name.toLowerCase();
          bVal = b.template_name.toLowerCase();
          break;
        case 'grade':
          aVal = a.grade_groups[0] || '';
          bVal = b.grade_groups[0] || '';
          break;
        case 'subject':
          aVal = a.subjects[0] || '';
          bVal = b.subjects[0] || '';
          break;
        case 'session_count':
          aVal = a.session_count;
          bVal = b.session_count;
          break;
        case 'published_count':
          aVal = a.published_count;
          bVal = b.published_count;
          break;
        default:
          aVal = a.template_name;
          bVal = b.template_name;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortField, sortDirection]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function getSortIcon(field: SortField) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    return sortDirection === 'asc' ?
      <ArrowUp className="w-3.5 h-3.5 text-blue-500" /> :
      <ArrowDown className="w-3.5 h-3.5 text-blue-500" />;
  }

  function clearFilters() {
    setGradeFilter([]);
    setSubjectFilter([]);
    setDayFilter([]);
    setStatusFilter('all');
  }

  const activeFilterCount =
    gradeFilter.length + subjectFilter.length + dayFilter.length + (statusFilter !== 'all' ? 1 : 0);

  function exportCSV() {
    const headers = ['Template', 'Grade', 'Event Type', 'Day', 'Total Sessions', 'Published', 'Draft', 'Completed', 'Canceled'];
    const rows = sortedData.map((row) => [
      row.template_name,
      row.grade_groups.join(', '),
      row.subjects.join(', '),
      DAY_NAMES[row.day_of_week],
      row.session_count,
      row.published_count,
      row.draft_count,
      row.completed_count,
      row.canceled_count,
    ]);

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-by-template-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-8 py-4 sm:py-6 bg-white border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sessions by Template</h1>
          <p className="text-[13px] text-slate-500 mt-1">
            View session counts by template with filtering and sorting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip text="Export filtered data to CSV">
            <Button
              variant="secondary"
              icon={<Download className="w-4 h-4" />}
              onClick={exportCSV}
              disabled={sortedData.length === 0}
            >
              Export CSV
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Grade Filter */}
          <div className="relative">
            <Tooltip text="Filter by grade level">
              <select
                multiple
                value={gradeFilter}
                onChange={(e) => setGradeFilter(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="h-9 px-3 pr-8 rounded-lg border border-slate-200 text-[13px] text-slate-900 bg-white focus:outline-none focus-visible:ring-2 focus:ring-blue-500"
                size={1}
              >
                <option value="" disabled>Grade</option>
                {allGrades.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Tooltip>
          </div>

          {/* Subject Filter */}
          <div className="relative">
            <Tooltip text="Filter by event type">
              <select
                multiple
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="h-9 px-3 pr-8 rounded-lg border border-slate-200 text-[13px] text-slate-900 bg-white focus:outline-none focus-visible:ring-2 focus:ring-blue-500"
                size={1}
              >
                <option value="" disabled>Event Type</option>
                {allSubjects.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Tooltip>
          </div>

          {/* Day Filter */}
          <div className="relative">
            <Tooltip text="Filter by day of week">
              <select
                multiple
                value={dayFilter.map(String)}
                onChange={(e) => setDayFilter(Array.from(e.target.selectedOptions, (o) => Number(o.value)))}
                className="h-9 px-3 pr-8 rounded-lg border border-slate-200 text-[13px] text-slate-900 bg-white focus:outline-none focus-visible:ring-2 focus:ring-blue-500"
                size={1}
              >
                <option value="" disabled>Day</option>
                {DAY_NAMES.map((day, i) => (
                  <option key={i} value={i}>{day}</option>
                ))}
              </select>
            </Tooltip>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Tooltip text="Filter by event status">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 pr-8 rounded-lg border border-slate-200 text-[13px] text-slate-900 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 appearance-none"
              >
                <option value="all">All Status</option>
                <option value="published">Published Only</option>
                <option value="draft">Draft Only</option>
                <option value="completed">Completed Only</option>
                <option value="canceled">Canceled Only</option>
              </select>
            </Tooltip>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {activeFilterCount > 0 && (
            <Tooltip text="Clear all filters">
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear ({activeFilterCount})
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : sortedData.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-400">
            {data.length === 0 ? 'No sessions found.' : 'No sessions match your filters.'}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-[13px] min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('template_name')}
                      className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Template {getSortIcon('template_name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('grade')}
                      className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Grade {getSortIcon('grade')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('subject')}
                      className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900"
                    >
                      Event Type {getSortIcon('subject')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Day</th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort('session_count')}
                      className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 ml-auto"
                    >
                      Total {getSortIcon('session_count')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort('published_count')}
                      className="flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 ml-auto"
                    >
                      Published {getSortIcon('published_count')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Draft</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Completed</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Canceled</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row) => (
                  <tr key={row.template_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{row.template_name}</td>
                    <td className="px-4 py-3 text-slate-600">{row.grade_groups.join(', ')}</td>
                    <td className="px-4 py-3 text-slate-600">{row.subjects.join(', ')}</td>
                    <td className="px-4 py-3 text-slate-600">{DAY_NAMES[row.day_of_week]}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{row.session_count}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{row.published_count}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{row.draft_count}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{row.completed_count}</td>
                    <td className="px-4 py-3 text-right text-red-600">{row.canceled_count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 font-semibold text-slate-900">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">
                    {sortedData.reduce((sum, row) => sum + row.session_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                    {sortedData.reduce((sum, row) => sum + row.published_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-500">
                    {sortedData.reduce((sum, row) => sum + row.draft_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-600">
                    {sortedData.reduce((sum, row) => sum + row.completed_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">
                    {sortedData.reduce((sum, row) => sum + row.canceled_count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
