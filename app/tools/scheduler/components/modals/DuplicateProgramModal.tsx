'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, Copy, Info } from 'lucide-react';
import { Modal, ModalButton } from '../ui/Modal';
import { Tooltip } from '../ui/Tooltip';
import type { Program } from '@/types/database';

interface TagCategoryCount {
  category: string;
  count: number;
}

interface DuplicateProgramModalProps {
  open: boolean;
  onClose: () => void;
  sourceProgram: Program | null;
  onDuplicated: (newProgram: Program) => void;
}

interface DuplicateResult {
  staff: number;
  venues: number;
  tags: number;
  templates: number;
}

export function DuplicateProgramModal({
  open,
  onClose,
  sourceProgram,
  onDuplicated,
}: DuplicateProgramModalProps) {
  // Form fields
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Copy options
  const [copyTemplates, setCopyTemplates] = useState(true);
  const [copyTags, setCopyTags] = useState(true);
  const [copyStaff, setCopyStaff] = useState(true);
  const [copyVenues, setCopyVenues] = useState(true);

  // Tag category filtering
  const [tagCategories, setTagCategories] = useState<TagCategoryCount[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectAllCategories, setSelectAllCategories] = useState(true);

  // Counts from source
  const [staffCount, setStaffCount] = useState(0);
  const [venueCount, setVenueCount] = useState(0);
  const [tagCount, setTagCount] = useState(0);
  const [templateCount, setTemplateCount] = useState(0);

  // UI state
  const [loading, setLoading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DuplicateResult | null>(null);

  const fetchSourceCounts = useCallback(async (programId: string) => {
    setLoading(true);
    try {
      const [staffRes, venueRes, tagRes, templateRes] = await Promise.all([
        fetch(`/api/staff?program_id=${programId}`),
        fetch(`/api/venues?program_id=${programId}`),
        fetch(`/api/tags?program_id=${programId}`),
        fetch(`/api/templates?program_id=${programId}`),
      ]);

      const staffData = await staffRes.json();
      const venueData = await venueRes.json();
      const tagData = await tagRes.json();
      const templateData = await templateRes.json();

      setStaffCount(staffData.instructors?.length ?? 0);
      setVenueCount(venueData.venues?.length ?? 0);
      setTemplateCount(templateData.templates?.length ?? 0);

      const tags = tagData.tags ?? [];
      setTagCount(tags.length);

      // Group by category
      const catMap = new Map<string, number>();
      for (const tag of tags) {
        const cat = tag.category || 'Uncategorized';
        catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
      }

      const categories = Array.from(catMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => a.category.localeCompare(b.category));

      setTagCategories(categories);
      setSelectedCategories(new Set(categories.map(c => c.category)));
      setSelectAllCategories(true);
    } catch (err) {
      console.error('Failed to fetch source counts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset and populate when modal opens
  useEffect(() => {
    if (open && sourceProgram) {
      setName(`${sourceProgram.name} (Copy)`);
      setStartDate(sourceProgram.start_date);
      setEndDate(sourceProgram.end_date);
      setCopyTemplates(true);
      setCopyTags(true);
      setCopyStaff(true);
      setCopyVenues(true);
      setError(null);
      setResult(null);
      setDuplicating(false);
      fetchSourceCounts(sourceProgram.id);
    }
  }, [open, sourceProgram, fetchSourceCounts]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      setSelectAllCategories(next.size === tagCategories.length);
      return next;
    });
  };

  const toggleAllCategories = () => {
    if (selectAllCategories) {
      setSelectedCategories(new Set());
      setSelectAllCategories(false);
    } else {
      setSelectedCategories(new Set(tagCategories.map(c => c.category)));
      setSelectAllCategories(true);
    }
  };

  const handleDuplicate = async () => {
    if (!sourceProgram || duplicating) return;

    if (!name.trim()) {
      setError('Program name is required.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }

    setError(null);
    setDuplicating(true);

    try {
      const res = await fetch(`/api/programs/${sourceProgram.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          start_date: startDate,
          end_date: endDate,
          copy_templates: copyTemplates,
          copy_tags: copyTags,
          copy_staff: copyStaff,
          copy_venues: copyVenues,
          tag_categories: copyTags && !selectAllCategories
            ? Array.from(selectedCategories)
            : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Duplication failed');
      }

      const data = await res.json();
      setResult(data.counts);
      onDuplicated(data.program);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplication failed');
    } finally {
      setDuplicating(false);
    }
  };

  const nothingSelected = !copyTemplates && !copyTags && !copyStaff && !copyVenues;

  const footer = result ? (
    <ModalButton variant="primary" onClick={onClose}>
      Done
    </ModalButton>
  ) : (
    <div className="flex gap-2">
      <ModalButton variant="secondary" onClick={onClose}>
        Cancel
      </ModalButton>
      <Tooltip text={nothingSelected ? 'Select at least one data type to copy, or duplicate with just the name and dates' : 'Create a duplicate of this program'}>
        <ModalButton
          variant="primary"
          onClick={handleDuplicate}
          disabled={duplicating || !name.trim() || !startDate || !endDate}
          loading={duplicating}
          icon={<Copy className="w-4 h-4" />}
        >
          {duplicating ? 'Duplicating...' : 'Duplicate'}
        </ModalButton>
      </Tooltip>
    </div>
  );

  const inputClass =
    'w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500';
  const labelClass = 'block text-xs font-semibold text-slate-600 mb-1.5';
  const checkboxClass = 'w-4 h-4 rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duplicate Program"
      subtitle={sourceProgram ? `From: ${sourceProgram.name}` : undefined}
      footer={footer}
      width={540}
    >
      {result ? (
        <div className="text-center py-6 px-6">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Duplication Complete</h3>
          <p className="text-sm text-slate-600 mb-3">
            <span className="font-medium text-slate-900">{name}</span> has been created.
          </p>
          <div className="space-y-1 text-sm text-slate-600">
            {result.templates > 0 && <p>{result.templates} event template{result.templates !== 1 ? 's' : ''} copied</p>}
            {result.staff > 0 && <p>{result.staff} staff member{result.staff !== 1 ? 's' : ''} copied</p>}
            {result.venues > 0 && <p>{result.venues} venue{result.venues !== 1 ? 's' : ''} copied</p>}
            {result.tags > 0 && <p>{result.tags} tag{result.tags !== 1 ? 's' : ''} copied</p>}
            {result.templates === 0 && result.staff === 0 && result.venues === 0 && result.tags === 0 && (
              <p>Program created with no data copied.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5 px-6 py-5">
          {/* Program name */}
          <div>
            <label htmlFor="dup-program-name" className={labelClass}>
              New Program Name
            </label>
            <input
              id="dup-program-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Enter program name"
              autoFocus
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dup-start-date" className={labelClass}>
                Start Date
              </label>
              <input
                id="dup-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="dup-end-date" className={labelClass}>
                End Date
              </label>
              <input
                id="dup-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Data to Copy</h3>
              <Tooltip text="Select which configuration data to bring into the new program. Sessions, reports, and version history are never copied.">
                <Info className="w-3.5 h-3.5 text-slate-400" />
              </Tooltip>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-700 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading source data...
              </div>
            ) : (
              <div className="space-y-3">
                {/* Event Templates */}
                <div>
                  <Tooltip text="Copy event template definitions (schedule structure). Venue and staff assignments depend on those being copied too.">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyTemplates}
                        onChange={(e) => setCopyTemplates(e.target.checked)}
                        className={checkboxClass}
                      />
                      <span className="text-sm text-slate-700">
                        Event Templates ({templateCount} template{templateCount !== 1 ? 's' : ''})
                      </span>
                    </label>
                  </Tooltip>
                  {copyTemplates && (!copyVenues || !copyStaff || !copyTags) && (
                    <div className="ml-7 mt-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      {!copyVenues && <p>Venue assignments will be cleared on duplicated templates.</p>}
                      {!copyStaff && <p>Staff assignments will be cleared on duplicated templates.</p>}
                      {!copyTags && <p>Tag references will be cleared on duplicated templates.</p>}
                      {copyTags && !selectAllCategories && selectedCategories.size < tagCategories.length && (
                        <p>Template tags will be filtered to only include tags from selected categories.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Staff */}
                <Tooltip text="Copy staff members and their profiles into the new program">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={copyStaff}
                      onChange={(e) => setCopyStaff(e.target.checked)}
                      className={checkboxClass}
                    />
                    <span className="text-sm text-slate-700">
                      Staff ({staffCount} member{staffCount !== 1 ? 's' : ''})
                    </span>
                  </label>
                </Tooltip>

                {/* Venues */}
                <Tooltip text="Copy venue definitions and their configurations into the new program">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={copyVenues}
                      onChange={(e) => setCopyVenues(e.target.checked)}
                      className={checkboxClass}
                    />
                    <span className="text-sm text-slate-700">
                      Venues ({venueCount} venue{venueCount !== 1 ? 's' : ''})
                    </span>
                  </label>
                </Tooltip>

                {/* Tags */}
                <div>
                  <Tooltip text="Copy tags and labels. You can filter by category below.">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={copyTags}
                        onChange={(e) => setCopyTags(e.target.checked)}
                        className={checkboxClass}
                      />
                      <span className="text-sm text-slate-700">
                        Tags ({tagCount} tag{tagCount !== 1 ? 's' : ''})
                      </span>
                    </label>
                  </Tooltip>

                  {copyTags && tagCategories.length > 0 && (
                    <div className="ml-7 mt-2 space-y-1.5 p-3 bg-slate-50 rounded-lg">
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectAllCategories}
                          onChange={toggleAllCategories}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
                        />
                        Select All
                      </label>
                      {tagCategories.map(cat => (
                        <label key={cat.category} className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedCategories.has(cat.category)}
                            onChange={() => toggleCategory(cat.category)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
                          />
                          {cat.category} ({cat.count} tag{cat.count !== 1 ? 's' : ''})
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
