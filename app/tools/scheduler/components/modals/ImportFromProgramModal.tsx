'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check } from 'lucide-react';
import { Modal, ModalButton } from '../ui/Modal';
import type { Program } from '@/types/database';

interface TagCategoryCount {
  category: string;
  count: number;
}

interface ImportFromProgramModalProps {
  open: boolean;
  onClose: () => void;
  targetProgramId: string;
  programs: Program[];
}

export function ImportFromProgramModal({
  open,
  onClose,
  targetProgramId,
  programs,
}: ImportFromProgramModalProps) {
  const [sourceProgramId, setSourceProgramId] = useState('');
  const [importStaff, setImportStaff] = useState(true);
  const [importVenues, setImportVenues] = useState(true);
  const [importTags, setImportTags] = useState(true);
  const [tagCategories, setTagCategories] = useState<TagCategoryCount[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectAllCategories, setSelectAllCategories] = useState(true);

  // Counts from source program
  const [staffCount, setStaffCount] = useState(0);
  const [venueCount, setVenueCount] = useState(0);
  const [tagCount, setTagCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ instructors: number; venues: number; tags: number } | null>(null);

  const otherPrograms = programs.filter(p => p.id !== targetProgramId);

  const fetchSourceCounts = useCallback(async (programId: string) => {
    if (!programId) return;
    setLoading(true);
    try {
      const [instrRes, venueRes, tagRes] = await Promise.all([
        fetch(`/api/instructors?program_id=${programId}`),
        fetch(`/api/venues?program_id=${programId}`),
        fetch(`/api/tags?program_id=${programId}`),
      ]);

      const instrData = await instrRes.json();
      const venueData = await venueRes.json();
      const tagData = await tagRes.json();

      setStaffCount(instrData.instructors?.length ?? 0);
      setVenueCount(venueData.venues?.length ?? 0);

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

  useEffect(() => {
    if (sourceProgramId) {
      fetchSourceCounts(sourceProgramId);
    }
  }, [sourceProgramId, fetchSourceCounts]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSourceProgramId('');
      setImportStaff(true);
      setImportVenues(true);
      setImportTags(true);
      setResult(null);
      setStaffCount(0);
      setVenueCount(0);
      setTagCount(0);
      setTagCategories([]);
    }
  }, [open]);

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

  const handleImport = async () => {
    if (!sourceProgramId || importing) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/programs/${targetProgramId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_program_id: sourceProgramId,
          import_staff: importStaff,
          import_venues: importVenues,
          import_tags: importTags,
          tag_categories: importTags && !selectAllCategories
            ? Array.from(selectedCategories)
            : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const data = await res.json();
      setResult(data.counts);
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setImporting(false);
    }
  };

  const footer = result ? (
    <ModalButton variant="primary" onClick={onClose}>
      Done
    </ModalButton>
  ) : (
    <div className="flex gap-2">
      <ModalButton variant="secondary" onClick={onClose}>
        Cancel
      </ModalButton>
      <ModalButton
        variant="primary"
        onClick={handleImport}
        disabled={!sourceProgramId || importing || (!importStaff && !importVenues && !importTags)}
      >
        {importing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            Importing...
          </>
        ) : (
          'Import'
        )}
      </ModalButton>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import from Existing Program"
      footer={footer}
      width={520}
    >
      {result ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Import Complete</h3>
          <div className="space-y-1 text-sm text-slate-600">
            {result.instructors > 0 && <p>{result.instructors} staff member(s) imported</p>}
            {result.venues > 0 && <p>{result.venues} venue(s) imported</p>}
            {result.tags > 0 && <p>{result.tags} tag(s) imported</p>}
            {result.instructors === 0 && result.venues === 0 && result.tags === 0 && (
              <p>No items were imported.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Source program */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Source Program
            </label>
            <select
              value={sourceProgramId}
              onChange={(e) => setSourceProgramId(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500"
            >
              <option value="">Select a program...</option>
              {otherPrograms.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading source data...
            </div>
          )}

          {sourceProgramId && !loading && (
            <>
              {/* Staff */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importStaff}
                  onChange={(e) => setImportStaff(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  Import Staff ({staffCount} instructor{staffCount !== 1 ? 's' : ''})
                </span>
              </label>

              {/* Venues */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importVenues}
                  onChange={(e) => setImportVenues(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  Import Venues ({venueCount} venue{venueCount !== 1 ? 's' : ''})
                </span>
              </label>

              {/* Tags */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importTags}
                    onChange={(e) => setImportTags(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    Import Tags ({tagCount} tag{tagCount !== 1 ? 's' : ''})
                  </span>
                </label>

                {importTags && tagCategories.length > 0 && (
                  <div className="ml-7 mt-2 space-y-1.5 p-3 bg-slate-50 rounded-lg">
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectAllCategories}
                        onChange={toggleAllCategories}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500"
                      />
                      Select All
                    </label>
                    {tagCategories.map(cat => (
                      <label key={cat.category} className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={selectedCategories.has(cat.category)}
                          onChange={() => toggleCategory(cat.category)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-500 focus-visible:ring-blue-500"
                        />
                        {cat.category} ({cat.count} tag{cat.count !== 1 ? 's' : ''})
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
