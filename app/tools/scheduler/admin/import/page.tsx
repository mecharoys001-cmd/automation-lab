'use client';

import { useState } from 'react';
import { Upload, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { Button } from '../../components/ui/Button';

interface ImportResults {
  venues?: { created: number; skipped: number };
  tags?: { created: number; skipped: number };
  event_templates?: { created: number; skipped: number };
}

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const seedData = {
    venues: [
      { name: 'Stage', space_type: 'auditorium', max_capacity: 100 },
      { name: 'Classroom', space_type: 'classroom', max_capacity: 30 },
      { name: 'Google Meet', space_type: 'virtual', max_capacity: null, is_virtual: true },
      { name: 'Guest Artist Space', space_type: 'other', max_capacity: 50 },
      { name: 'Grade 5 Classroom - 307', space_type: 'classroom', max_capacity: 30 },
      { name: 'Grade 7 Classroom - 201', space_type: 'classroom', max_capacity: 30 },
      { name: 'Stage in Cafe (behind divider)', space_type: 'auditorium', max_capacity: 75 },
      { name: 'Cafegymatorium', space_type: 'auditorium', max_capacity: 200 },
    ],
    tags: [
      { name: "Lead TA's Away", emoji: '👥', description: 'Lead teaching artists away from regular sessions' },
      { name: 'TA Check-ins', emoji: '📋', description: 'Teaching artist check-in sessions' },
      { name: 'Field Trip / Guest Artist', emoji: '🎭', description: 'Field trips or guest artist visits' },
      { name: 'Showcase', emoji: '🌟', description: 'Student showcase performances' },
      { name: 'Choral Sessions', emoji: '🎤', description: 'Vocal and choir training' },
      { name: 'Percussion Sessions', emoji: '🥁', description: 'Drumming and percussion sessions' },
      // Space Types
      { name: 'Auditorium', emoji: '🎭', description: 'Large performance or assembly space', category: 'Space Types' },
      { name: 'Classroom', emoji: '🏫', description: 'Standard classroom space', category: 'Space Types' },
      { name: 'Virtual', emoji: '💻', description: 'Online or virtual meeting space', category: 'Space Types' },
      { name: 'Outdoor', emoji: '🌳', description: 'Outdoor or open-air space', category: 'Space Types' },
      { name: 'Multipurpose', emoji: '🔄', description: 'Flexible multi-use space', category: 'Space Types' },
    ],
    event_templates: [
      { name: 'Grade K', description: 'Kindergarten session', duration_minutes: 30, color: '#3B82F6' },
      { name: 'Grade 1', description: 'Grade 1 session', duration_minutes: 30, color: '#10B981' },
      { name: 'Grade 2', description: 'Grade 2 session', duration_minutes: 30, color: '#8B5CF6' },
      { name: 'Grade 3', description: 'Grade 3 session', duration_minutes: 40, color: '#EC4899' },
      { name: 'Grade 4', description: 'Grade 4 session', duration_minutes: 40, color: '#F59E0B' },
      { name: 'Grade 5', description: 'Grade 5 session', duration_minutes: 45, color: '#EF4444' },
      { name: 'Grade 6', description: 'Grade 6 session', duration_minutes: 45, color: '#14B8A6' },
      { name: 'Grade 7', description: 'Grade 7 session', duration_minutes: 45, color: '#6366F1' },
      { name: 'Grade 8', description: 'Grade 8 session', duration_minutes: 45, color: '#F97316' },
    ],
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch('/api/import/seed-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seedData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="overflow-y-auto h-full"
      style={{ backgroundColor: '#F8FAFC', padding: 32 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
        {/* Page Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Import Seed Data
          </h1>
          <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
            Load Symphonix schedule data from the 2025-2026 program CSV
          </p>
        </div>

        {/* Import Card */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              What will be imported?
            </h2>
            <ul style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, paddingLeft: 20 }}>
              <li><strong>8 Venues:</strong> Stage, Classroom, Google Meet, Grade 5 & 7 classrooms, Cafegymatorium, etc.</li>
              <li><strong>6 Tags:</strong> Lead TA's Away, TA Check-ins, Field Trip / Guest Artist, Showcase, Choral Sessions, Percussion Sessions</li>
              <li><strong>9 Event Templates:</strong> Sessions for grades K-8 with appropriate durations</li>
            </ul>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
              ⚠️ This will create new venues, tags, and event templates. Existing items with the same names will be skipped.
            </p>
          </div>

          {/* Import Button */}
          <div style={{ paddingTop: 8 }}>
            <Tooltip text="Import seed data from the Symphonix 2025-2026 schedule">
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={importing}
                style={{
                  height: 44,
                  borderRadius: 8,
                  padding: '0 24px',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import Seed Data
                  </>
                )}
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              border: '1px solid #10B981',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check className="w-5 h-5 text-emerald-600" />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Import Complete
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.venues && (
                <div style={{ fontSize: 14, color: '#64748B' }}>
                  <strong>Venues:</strong> {results.venues.created} created, {results.venues.skipped} skipped
                </div>
              )}
              {results.tags && (
                <div style={{ fontSize: 14, color: '#64748B' }}>
                  <strong>Tags:</strong> {results.tags.created} created, {results.tags.skipped} skipped
                </div>
              )}
              {results.event_templates && (
                <div style={{ fontSize: 14, color: '#64748B' }}>
                  <strong>Event Templates:</strong> {results.event_templates.created} created, {results.event_templates.skipped} skipped
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: '1px solid #EF4444',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div style={{ fontSize: 14, color: '#EF4444' }}>
              {error}
            </div>
          </div>
        )}

        {/* Preview Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Preview Data
          </h2>

          {/* Venues Preview */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>
              Venues ({seedData.venues.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seedData.venues.map((venue, idx) => (
                <div key={idx} style={{ fontSize: 13, color: '#64748B', paddingLeft: 12 }}>
                  • {venue.name} <span style={{ color: '#94A3B8' }}>({venue.space_type})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tags Preview */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>
              Tags ({seedData.tags.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seedData.tags.map((tag, idx) => (
                <div key={idx} style={{ fontSize: 13, color: '#64748B', paddingLeft: 12 }}>
                  • {tag.emoji} {tag.name}
                </div>
              ))}
            </div>
          </div>

          {/* Event Templates Preview */}
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 20,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>
              Event Templates ({seedData.event_templates.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seedData.event_templates.map((cls, idx) => (
                <div key={idx} style={{ fontSize: 13, color: '#64748B', paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      backgroundColor: cls.color,
                      flexShrink: 0,
                    }}
                  />
                  {cls.name} <span style={{ color: '#94A3B8' }}>({cls.duration_minutes} min)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
