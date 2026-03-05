# Dynamic Filter Bar

**Auto-populates filter options from the tag system**

## Features

✅ **Dynamic Tag Filters** - Automatically creates filters from tag categories  
✅ **Static Filters** - Support for hardcoded filters (instructor, venue, status)  
✅ **Real-time Updates** - Filter options update when new tags are created  
✅ **Emoji Support** - Shows tag emojis in filter dropdown and pills  
✅ **Multi-select** - Select multiple values per filter  
✅ **Active Filter Pills** - Visual display of active filters  
✅ **Easy Integration** - Works with existing `useFilters` hook

---

## Basic Usage

```tsx
import { DynamicFilterBar } from '../components/layout/DynamicFilterBar';
import { useFilters } from '../hooks/useFilters';

function MyCalendarPage() {
  const { activeFilters, setActiveFilters, applyFilters } = useFilters();

  // Apply filters to your data
  const filteredSessions = applyFilters(sessions, {
    status: (session, values) => values.includes(session.status),
    tag_skills: (session, values) => 
      session.tags?.some(tag => values.includes(tag)),
  });

  return (
    <div>
      <DynamicFilterBar
        tagCategories={['Skills', 'Subject', 'Event Type']}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
      />
      
      {/* Your calendar/list view */}
      {filteredSessions.map(session => ...)}
    </div>
  );
}
```

---

## With Static Filters

Combine hardcoded filters (instructor, venue, status) with dynamic tag filters:

```tsx
import { User, MapPin, CircleDot } from 'lucide-react';

const staticFilters = [
  {
    key: 'instructor',
    label: 'Instructor',
    icon: User,
    tooltip: 'Filter by instructor',
    options: instructors.map(i => ({
      value: i.id,
      label: `${i.first_name} ${i.last_name}`,
    })),
  },
  {
    key: 'venue',
    label: 'Venue',
    icon: MapPin,
    tooltip: 'Filter by venue',
    options: venues.map(v => ({
      value: v.id,
      label: v.name,
    })),
  },
  {
    key: 'status',
    label: 'Status',
    icon: CircleDot,
    tooltip: 'Filter by session status',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'published', label: 'Published' },
      { value: 'canceled', label: 'Canceled' },
      { value: 'completed', label: 'Completed' },
    ],
  },
];

<DynamicFilterBar
  staticFilters={staticFilters}
  tagCategories={['Skills', 'Event Type']}
  activeFilters={activeFilters}
  onFiltersChange={setActiveFilters}
/>
```

---

## Filter Matcher Examples

### Session Filtering

```tsx
const filteredSessions = applyFilters(sessions, {
  // Match by instructor ID
  instructor: (session, values) => 
    session.instructor_id ? values.includes(session.instructor_id) : false,
  
  // Match by venue ID
  venue: (session, values) => 
    session.venue_id ? values.includes(session.venue_id) : false,
  
  // Match by status
  status: (session, values) => 
    values.includes(session.status),
  
  // Match tags (Skills category)
  tag_skills: (session, values) => 
    session.tags?.some(tag => values.includes(tag)) ?? false,
  
  // Match tags (Event Type category)
  tag_event_type: (session, values) => 
    session.tags?.some(tag => values.includes(tag)) ?? false,
});
```

### Instructor Filtering

```tsx
const filteredInstructors = applyFilters(instructors, {
  // Match by skills
  tag_skills: (instructor, values) => 
    instructor.skills?.some(skill => values.includes(skill)) ?? false,
  
  // Match by status
  status: (instructor, values) => 
    values.includes(instructor.is_active ? 'active' : 'inactive'),
});
```

---

## Tag Category Filter Keys

When you specify `tagCategories={['Skills', 'Subject']}`, the filter bar creates these keys:

| Category | Filter Key | Example Value |
|----------|-----------|---------------|
| Skills | `tag_skills` | "Percussion" |
| Subject | `tag_subject` | "Theory" |
| Event Type | `tag_event_type` | "Workshop" |
| Administrative | `tag_administrative` | "TA Check-In" |

**Formula:** `tag_${category.toLowerCase().replace(/\s+/g, '_')}`

---

## Available Tag Categories

Default categories (can be created in Tags page):

- **Skills** — Instructor competencies (Percussion, Strings, Brass, etc.)
- **Subject** — Class types (Instrumental, Vocal, Theory, etc.)
- **Event Type** — Special events (Field Trip, Showcase, Workshop, etc.)
- **Administrative** — Internal tags (TA Check-In, Setup, etc.)
- **General** — Catch-all category

---

## How It Works

1. **Component mounts** → Fetches tags from `/api/tags`
2. **Groups tags by category** → Creates a filter for each requested category
3. **Populates options** → Tag names become filter options
4. **User selects filters** → Updates `activeFilters` state
5. **Parent component** → Uses `applyFilters()` to filter data
6. **Auto-updates** → When new tags are created, they appear in filters

---

## Customizing Category Icons

Edit `CATEGORY_ICONS` in `DynamicFilterBar.tsx`:

```tsx
import { Music, Book, Calendar, Settings } from 'lucide-react';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Skills: Music,
  Subject: Book,
  'Event Type': Calendar,
  Administrative: Settings,
};
```

---

## Real-World Example: Calendar Page

```tsx
'use client';

import { useState, useEffect } from 'react';
import { DynamicFilterBar } from '../components/layout/DynamicFilterBar';
import { useFilters } from '../hooks/useFilters';
import { User, MapPin, CircleDot } from 'lucide-react';

export default function CalendarPage() {
  const [sessions, setSessions] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [venues, setVenues] = useState([]);
  
  const { activeFilters, setActiveFilters, applyFilters } = useFilters();

  useEffect(() => {
    // Fetch data...
  }, []);

  // Build static filters from data
  const staticFilters = [
    {
      key: 'instructor',
      label: 'Instructor',
      icon: User,
      tooltip: 'Filter by instructor',
      options: instructors.map(i => ({
        value: i.id,
        label: `${i.first_name} ${i.last_name}`,
      })),
    },
    {
      key: 'venue',
      label: 'Venue',
      icon: MapPin,
      tooltip: 'Filter by venue',
      options: venues.map(v => ({ value: v.id, label: v.name })),
    },
    {
      key: 'status',
      label: 'Status',
      icon: CircleDot,
      tooltip: 'Filter by status',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'published', label: 'Published' },
        { value: 'canceled', label: 'Canceled' },
      ],
    },
  ];

  // Filter sessions
  const filteredSessions = applyFilters(sessions, {
    instructor: (s, vals) => s.instructor_id && vals.includes(s.instructor_id),
    venue: (s, vals) => s.venue_id && vals.includes(s.venue_id),
    status: (s, vals) => vals.includes(s.status),
    tag_skills: (s, vals) => s.tags?.some(t => vals.includes(t)),
    tag_event_type: (s, vals) => s.tags?.some(t => vals.includes(t)),
  });

  return (
    <div>
      <DynamicFilterBar
        staticFilters={staticFilters}
        tagCategories={['Skills', 'Event Type']}
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
      />
      
      <div className="p-6">
        {filteredSessions.map(session => (
          <div key={session.id}>{session.title}</div>
        ))}
      </div>
    </div>
  );
}
```

---

## Migration from Static FilterBar

**Before:**
```tsx
import { FilterBar } from '../components/layout/FilterBar';
// Hardcoded options in defaultFilters array
```

**After:**
```tsx
import { DynamicFilterBar } from '../components/layout/DynamicFilterBar';
// Options auto-populate from tags!

<DynamicFilterBar
  tagCategories={['Skills', 'Subject']}
  activeFilters={activeFilters}
  onFiltersChange={setActiveFilters}
/>
```

---

## Benefits

✅ **No more hardcoded filter options**  
✅ **Admins can create custom filters via Tags page**  
✅ **Consistent with tag system**  
✅ **Auto-syncs when tags change**  
✅ **Reusable across all pages**

---

## Next Steps

1. **Run tag migrations** (see `/database/migrations/README.md`)
2. **Seed default tags** (Skills, Subject, Event Type categories)
3. **Replace `FilterBar` with `DynamicFilterBar` in your pages**
4. **Enjoy auto-populating filters!** 🎉
