/**
 * Generates a massive dataset for stress testing:
 * - 50 instructors
 * - 200+ templates  
 * - 30+ subjects
 */

const FIRST_NAMES = [
  'Maria', 'James', 'Aisha', 'David', 'Rachel', 'Marcus', 'Sofia', 'Andre', 'Emily', 'Carlos',
  'Isabella', 'Michael', 'Olivia', 'Daniel', 'Emma', 'Alexander', 'Sophia', 'William', 'Ava', 'Ethan',
  'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia', 'Mason', 'Harper', 'Logan', 'Evelyn', 'Jacob',
  'Abigail', 'Jackson', 'Ella', 'Levi', 'Scarlett', 'Sebastian', 'Grace', 'Mateo', 'Chloe', 'Jack',
  'Victoria', 'Owen', 'Madison', 'Theodore', 'Luna', 'Aiden', 'Lily', 'Samuel', 'Zoey', 'Joseph',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
];

const SUBJECTS = [
  'Strings', 'Piano', 'Brass', 'Percussion', 'Woodwinds', 'Choral', 'Guitar', 'Bass', 'Drums',
  'Saxophone', 'Trumpet', 'Trombone', 'Clarinet', 'Flute', 'Violin', 'Viola', 'Cello', 'Harp',
  'Composition', 'Music Theory', 'Jazz', 'Orchestra', 'Band', 'Ensemble', 'Voice', 'Opera',
  'Music History', 'Conducting', 'Recording', 'Production', 'Sound Design', 'Electronic Music',
];

const VENUES_LARGE = [
  { name: 'Concert Hall', space_type: 'performance', is_virtual: false },
  { name: 'Recital Room', space_type: 'performance', is_virtual: false },
  { name: 'Stage', space_type: 'performance', is_virtual: false },
  { name: 'Classroom A', space_type: 'classroom', is_virtual: false },
  { name: 'Classroom B', space_type: 'classroom', is_virtual: false },
  { name: 'Classroom C', space_type: 'classroom', is_virtual: false },
  { name: 'Music Lab 1', space_type: 'classroom', is_virtual: false },
  { name: 'Music Lab 2', space_type: 'classroom', is_virtual: false },
  { name: 'Practice Room 1', space_type: 'practice', is_virtual: false },
  { name: 'Practice Room 2', space_type: 'practice', is_virtual: false },
  { name: 'Practice Room 3', space_type: 'practice', is_virtual: false },
  { name: 'Practice Room 4', space_type: 'practice', is_virtual: false },
  { name: 'Auditorium', space_type: 'performance', is_virtual: false },
  { name: 'Cafegymatorium', space_type: 'multipurpose', is_virtual: false },
  { name: 'Google Meet', space_type: 'virtual', is_virtual: true },
  { name: 'Zoom Room', space_type: 'virtual', is_virtual: true },
];

function generateInstructors(count: number) {
  const instructors = [];
  for (let i = 0; i < count; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const skillCount = Math.floor(Math.random() * 4) + 1;
    const skills = [];
    const usedSubjects = new Set();
    
    while (skills.length < skillCount) {
      const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
      if (!usedSubjects.has(subject)) {
        skills.push(subject);
        usedSubjects.add(subject);
      }
    }

    const availability: Record<string, Array<{ start: string; end: string }>> = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const dayCount = Math.floor(Math.random() * 3) + 2; // 2-4 days
    
    for (let d = 0; d < dayCount; d++) {
      const day = days[Math.floor(Math.random() * days.length)];
      if (!availability[day]) {
        const startHour = 8 + Math.floor(Math.random() * 3); // 8-10am start
        const endHour = 14 + Math.floor(Math.random() * 3);  // 2-4pm end
        availability[day] = [{
          start: `${String(startHour).padStart(2, '0')}:00`,
          end: `${String(endHour).padStart(2, '0')}:00`,
        }];
      }
    }

    instructors.push({
      first_name: firstName,
      last_name: lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      phone: i % 3 === 0 ? null : `(212) 555-${String(i).padStart(4, '0')}`,
      skills,
      availability_json: availability,
      is_active: i < count - 3, // Last 3 inactive
      notes: `Instructor ${i + 1} - ${skills.join(', ')}`,
    });
  }
  return instructors;
}

function generateTemplates(count: number) {
  const templates = [];
  const grades = ['K', '1', '2', '3', '4', '5', '6'];
  
  for (let i = 0; i < count; i++) {
    const dayOfWeek = (i % 5) + 1; // Mon-Fri
    const grade = grades[i % grades.length];
    const subject = SUBJECTS[i % SUBJECTS.length];
    const duration = [30, 45, 60][i % 3];
    
    templates.push({
      day_of_week: dayOfWeek,
      grade_groups: [grade],
      start_time: null,
      end_time: null,
      duration_minutes: duration,
      venue: null,
      skills: [subject],
      instructor_index: null,
      sort_order: i + 1,
    });
  }
  
  return templates;
}

import { DEFAULT_TAGS, DEFAULT_SPACE_TYPES, type TagPreset } from './default-tags';

const subjectTags: TagPreset[] = SUBJECTS.slice(0, 15).map((subject, i) => ({
  name: `${subject} Sessions`,
  color: ['#6366F1', '#8B5CF6', '#EF4444', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#14B8A6', '#F97316', '#A855F7', '#06B6D4', '#84CC16', '#EAB308', '#F43F5E', '#22D3EE'][i % 15],
}));

// Merge defaults with subject tags, deduplicating by name
const allTags = [...DEFAULT_TAGS, ...DEFAULT_SPACE_TYPES, ...subjectTags];
const seen = new Set<string>();
const dedupedTags = allTags.filter(t => {
  if (seen.has(t.name)) return false;
  seen.add(t.name);
  return true;
});

export const fullDataset = {
  name: 'Full Stress Test Dataset',
  venues: VENUES_LARGE,
  tags: dedupedTags,
  instructors: generateInstructors(50),
  templates: generateTemplates(200),
};
