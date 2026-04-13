/**
 * Mock data presets for testing
 * 
 * - small: Minimal dataset (2 instructors, 1 venue, 5 templates) for focused testing
 * - medium: Standard dataset (10 instructors, 4 venues, 36 templates) for integration testing
 * - full: Massive dataset (50 instructors, 16 venues, 200+ templates) for stress/load testing
 */

import { fullDataset } from './generate-large-dataset';
import { mergeWithDefaults, type TagPreset } from './default-tags';

export type { TagPreset } from './default-tags';
export { DEFAULT_STAFF_TYPES, DEFAULT_TAGS, DEFAULT_SPACE_TYPES, mergeWithDefaults } from './default-tags';

export interface DatasetPreset {
  name: string;
  venues: Array<{ name: string; space_type: string; is_virtual: boolean }>;
  tags: TagPreset[];
  instructors: Array<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    skills: string[];
    availability_json: Record<string, Array<{ start: string; end: string }>>;
    is_active: boolean;
    notes: string;
  }>;
  templates: Array<{
    day_of_week: number;
    grade_groups: string[];
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number;
    venue: string | null;
    skills: string[];
    instructor_index: number | null;
    sort_order: number;
  }>;
}

export const datasets: Record<'small' | 'medium' | 'full', DatasetPreset> = {
  // ═══════════════════════════════════════════════════════════
  // SMALL DATASET — For intimate testing (5 templates, 2 instructors, 1 venue)
  // ═══════════════════════════════════════════════════════════
  small: {
    name: 'Small Test Dataset',
    venues: [
      { name: 'Classroom', space_type: 'classroom', is_virtual: false },
    ],
    tags: mergeWithDefaults([
      { name: 'Lead TAs Away', color: '#6366F1' },
      { name: 'Percussion Sessions', color: '#10B981' },
    ]),
    instructors: [
      {
        first_name: 'Maria',
        last_name: 'Santos',
        email: 'maria.santos@example.com',
        phone: '(212) 555-0101',
        skills: ['Strings', 'Choral'],
        availability_json: {
          monday: [{ start: '09:00', end: '15:00' }],
          wednesday: [{ start: '09:00', end: '15:00' }],
          thursday: [{ start: '10:00', end: '14:00' }],
        },
        is_active: true,
        notes: 'Lead strings instructor.',
      },
      {
        first_name: 'James',
        last_name: 'Wilson',
        email: 'james.wilson@example.com',
        phone: '(212) 555-0102',
        skills: ['Percussion'],
        availability_json: {
          monday: [{ start: '08:00', end: '16:00' }],
          tuesday: [{ start: '08:00', end: '16:00' }],
          wednesday: [{ start: '08:00', end: '16:00' }],
          thursday: [{ start: '08:00', end: '16:00' }],
        },
        is_active: true,
        notes: 'Drum circle expert.',
      },
    ],
    templates: [
      { day_of_week: 1, grade_groups: ['1'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 1 },
      { day_of_week: 1, grade_groups: ['2'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 2 },
      { day_of_week: 3, grade_groups: ['3'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 3 },
      { day_of_week: 3, grade_groups: ['4'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 4 },
      { day_of_week: 4, grade_groups: ['5'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 5 },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // MEDIUM DATASET — Standard mock data for integration testing
  // ═══════════════════════════════════════════════════════════
  medium: {
    name: 'Medium Test Dataset',
    venues: [
      { name: 'Stage', space_type: 'performance', is_virtual: false },
      { name: 'Classroom', space_type: 'classroom', is_virtual: false },
      { name: 'Google Meet', space_type: 'virtual', is_virtual: true },
      { name: 'Cafegymatorium', space_type: 'multipurpose', is_virtual: false },
    ],
    tags: mergeWithDefaults([
      { name: 'Lead TAs Away', color: '#6366F1' },
      { name: 'TA Check-ins', color: '#8B5CF6' },
      { name: 'Field Trip / Guest Artist', color: '#EF4444' },
      { name: 'Showcase', color: '#EC4899' },
      { name: 'Choral Sessions', color: '#F59E0B' },
      { name: 'Percussion Sessions', color: '#10B981' },
    ]),
    instructors: [
      { first_name: 'Maria', last_name: 'Santos', email: 'maria.santos@example.com', phone: '(212) 555-0101', skills: ['Strings', 'Choral'], availability_json: { monday: [{ start: '09:00', end: '15:00' }], wednesday: [{ start: '09:00', end: '15:00' }], thursday: [{ start: '10:00', end: '14:00' }] }, is_active: true, notes: 'Lead strings instructor. 5 years with Symphonix.' },
      { first_name: 'James', last_name: 'Wilson', email: 'james.wilson@example.com', phone: '(212) 555-0102', skills: ['Percussion'], availability_json: { monday: [{ start: '08:00', end: '16:00' }], tuesday: [{ start: '08:00', end: '16:00' }], wednesday: [{ start: '08:00', end: '16:00' }], thursday: [{ start: '08:00', end: '16:00' }] }, is_active: true, notes: 'Drum circle expert.' },
      { first_name: 'Aisha', last_name: 'Johnson', email: 'aisha.johnson@example.com', phone: '(212) 555-0103', skills: ['Woodwinds', 'Brass'], availability_json: { tuesday: [{ start: '09:00', end: '15:00' }], thursday: [{ start: '09:00', end: '15:00' }], friday: [{ start: '09:00', end: '13:00' }] }, is_active: true, notes: 'Clarinet and trumpet specialist.' },
      { first_name: 'David', last_name: 'Chen', email: 'david.chen@example.com', phone: '(212) 555-0104', skills: ['Strings'], availability_json: { monday: [{ start: '10:00', end: '15:00' }], wednesday: [{ start: '10:00', end: '15:00' }] }, is_active: true, notes: 'Violin/viola specialist. Prefers K-4.' },
      { first_name: 'Rachel', last_name: 'Kim', email: 'rachel.kim@example.com', phone: '(212) 555-0105', skills: ['Choral', 'Woodwinds'], availability_json: { monday: [{ start: '08:00', end: '14:00' }], tuesday: [{ start: '08:00', end: '14:00' }], wednesday: [{ start: '08:00', end: '14:00' }], thursday: [{ start: '08:00', end: '14:00' }] }, is_active: true, notes: 'Voice and flute. Very flexible schedule.' },
      { first_name: 'Marcus', last_name: 'Brown', email: 'marcus.brown@example.com', phone: '(212) 555-0106', skills: ['Percussion', 'Brass'], availability_json: { wednesday: [{ start: '09:00', end: '16:00' }], thursday: [{ start: '09:00', end: '16:00' }], friday: [{ start: '09:00', end: '16:00' }] }, is_active: true, notes: 'Jazz percussion and brass.' },
      { first_name: 'Sofia', last_name: 'Rodriguez', email: 'sofia.rodriguez@example.com', phone: null, skills: ['Strings', 'Choral'], availability_json: { monday: [{ start: '11:00', end: '15:00' }], tuesday: [{ start: '11:00', end: '15:00' }], wednesday: [{ start: '11:00', end: '15:00' }] }, is_active: true, notes: 'Bilingual instruction (English/Spanish).' },
      { first_name: 'Andre', last_name: 'Thompson', email: 'andre.thompson@example.com', phone: '(212) 555-0108', skills: ['Brass'], availability_json: { monday: [{ start: '09:00', end: '14:00' }], thursday: [{ start: '09:00', end: '14:00' }] }, is_active: true, notes: 'Trumpet and trombone. Part-time.' },
      { first_name: 'Emily', last_name: 'Park', email: 'emily.park@example.com', phone: '(212) 555-0109', skills: ['Woodwinds'], availability_json: { tuesday: [{ start: '10:00', end: '15:00' }], friday: [{ start: '10:00', end: '15:00' }] }, is_active: false, notes: 'On leave until January 2026.' },
      { first_name: 'Carlos', last_name: 'Mendez', email: 'carlos.mendez@example.com', phone: '(212) 555-0110', skills: ['Percussion', 'Strings', 'Piano'], availability_json: { monday: [{ start: '08:00', end: '15:00' }], tuesday: [{ start: '08:00', end: '15:00' }], wednesday: [{ start: '08:00', end: '15:00' }], thursday: [{ start: '08:00', end: '15:00' }], friday: [{ start: '08:00', end: '13:00' }] }, is_active: true, notes: 'Versatile. Can sub for any role.' },
    ],
    templates: [
      // Monday (8)
      { day_of_week: 1, grade_groups: ['1'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 1 },
      { day_of_week: 1, grade_groups: ['1'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Piano'], instructor_index: null, sort_order: 2 },
      { day_of_week: 1, grade_groups: ['2'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Brass'], instructor_index: null, sort_order: 3 },
      { day_of_week: 1, grade_groups: ['2'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 4 },
      { day_of_week: 1, grade_groups: ['3'], start_time: null, end_time: null, duration_minutes: 60, venue: null, skills: ['Woodwinds'], instructor_index: null, sort_order: 5 },
      { day_of_week: 1, grade_groups: ['3'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Choral'], instructor_index: null, sort_order: 6 },
      { day_of_week: 1, grade_groups: ['4'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 7 },
      { day_of_week: 1, grade_groups: ['4'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Piano'], instructor_index: null, sort_order: 8 },
      // Tuesday (7)
      { day_of_week: 2, grade_groups: ['4'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Brass'], instructor_index: null, sort_order: 9 },
      { day_of_week: 2, grade_groups: ['4'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 10 },
      { day_of_week: 2, grade_groups: ['5'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Woodwinds'], instructor_index: null, sort_order: 11 },
      { day_of_week: 2, grade_groups: ['5'], start_time: null, end_time: null, duration_minutes: 60, venue: null, skills: ['Choral'], instructor_index: null, sort_order: 12 },
      { day_of_week: 2, grade_groups: ['5'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 13 },
      { day_of_week: 2, grade_groups: ['5'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Piano'], instructor_index: null, sort_order: 14 },
      { day_of_week: 2, grade_groups: ['6'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Brass'], instructor_index: null, sort_order: 15 },
      // Wednesday (7)
      { day_of_week: 3, grade_groups: ['6'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 16 },
      { day_of_week: 3, grade_groups: ['6'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Woodwinds'], instructor_index: null, sort_order: 17 },
      { day_of_week: 3, grade_groups: ['6'], start_time: null, end_time: null, duration_minutes: 60, venue: null, skills: ['Choral'], instructor_index: null, sort_order: 18 },
      { day_of_week: 3, grade_groups: ['1'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Brass'], instructor_index: null, sort_order: 19 },
      { day_of_week: 3, grade_groups: ['1'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 20 },
      { day_of_week: 3, grade_groups: ['2'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 21 },
      { day_of_week: 3, grade_groups: ['2'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Piano'], instructor_index: null, sort_order: 22 },
      // Thursday (7)
      { day_of_week: 4, grade_groups: ['2'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Woodwinds'], instructor_index: null, sort_order: 23 },
      { day_of_week: 4, grade_groups: ['2'], start_time: null, end_time: null, duration_minutes: 60, venue: null, skills: ['Choral'], instructor_index: null, sort_order: 24 },
      { day_of_week: 4, grade_groups: ['3'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 25 },
      { day_of_week: 4, grade_groups: ['3'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Piano'], instructor_index: null, sort_order: 26 },
      { day_of_week: 4, grade_groups: ['3'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Brass'], instructor_index: null, sort_order: 27 },
      { day_of_week: 4, grade_groups: ['3'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 28 },
      { day_of_week: 4, grade_groups: ['4'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Woodwinds'], instructor_index: null, sort_order: 29 },
      // Friday (7)
      { day_of_week: 5, grade_groups: ['4'], start_time: null, end_time: null, duration_minutes: 60, venue: null, skills: ['Choral'], instructor_index: null, sort_order: 30 },
      { day_of_week: 5, grade_groups: ['5'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Brass'], instructor_index: null, sort_order: 31 },
      { day_of_week: 5, grade_groups: ['5'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Percussion'], instructor_index: null, sort_order: 32 },
      { day_of_week: 5, grade_groups: ['6'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Strings'], instructor_index: null, sort_order: 33 },
      { day_of_week: 5, grade_groups: ['6'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Piano'], instructor_index: null, sort_order: 34 },
      { day_of_week: 5, grade_groups: ['1'], start_time: null, end_time: null, duration_minutes: 60, venue: null, skills: ['Woodwinds'], instructor_index: null, sort_order: 35 },
      { day_of_week: 5, grade_groups: ['1'], start_time: null, end_time: null, duration_minutes: 45, venue: null, skills: ['Choral'], instructor_index: null, sort_order: 36 },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // FULL DATASET — Massive stress test data (50 instructors, 200+ templates, 30+ subjects)
  // ═══════════════════════════════════════════════════════════
  full: fullDataset,
};
