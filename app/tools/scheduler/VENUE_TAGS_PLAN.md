# Venue Tags Implementation Plan

## Overview
Implement a tagging system for venues that allows admins to categorize venues with custom tags (e.g., "indoor", "outdoor", "accessible", "has-piano"). Tags should be filterable on the calendar and Staff & Venues page.

## Database Schema

### venue_tags table
```sql
CREATE TABLE venue_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### venue_tag_assignments junction table
```sql
CREATE TABLE venue_tag_assignments (
  venue_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (venue_id, tag_id),
  FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES venue_tags(id) ON DELETE CASCADE
);
```

### Seed data
```sql
INSERT INTO venue_tags (name, description, color) VALUES
  ('indoor', 'Indoor space', '#3B82F6'),
  ('outdoor', 'Outdoor space', '#10B981');
```

## Type Definitions (types/scheduler.ts)

```typescript
export interface VenueTag {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

// Update Venue interface
export interface Venue {
  id: number;
  name: string;
  spaceType: string;
  capacity?: number;
  tags?: VenueTag[]; // NEW
  created_at: string;
  updated_at: string;
}
```

## Data Access Layer (lib/db.ts)

### New functions to add:
- `getVenueTags(): VenueTag[]`
- `getVenueTag(id: number): VenueTag | null`
- `createVenueTag(data: { name, description?, color? }): VenueTag`
- `updateVenueTag(id: number, data: Partial<VenueTag>): VenueTag`
- `deleteVenueTag(id: number): void`
- `assignTagToVenue(venueId: number, tagId: number): void`
- `removeTagFromVenue(venueId: number, tagId: number): void`
- `getVenuesByTag(tagId: number): Venue[]`

### Update existing functions:
- `getVenues()` - Add LEFT JOIN to include tags
- `getVenue(id)` - Add LEFT JOIN to include tags

## UI Components

### New Components
1. **VenueTagSelector.tsx** - Multi-select dropdown with search and inline creation
2. **VenueTagChip.tsx** - Color-coded tag display (or reuse existing TagChip if available)
3. **VenueTagManager.tsx** - CRUD interface for tags page

### Components to Update
1. **VenueModal.tsx** - Add tag selector section
2. **VenueList.tsx** - Display tag chips on venue cards
3. **FilterPanel.tsx** - Add venue tag multi-select filter (OR logic)
4. **TagsPage** (admin/tags/page.tsx) - Add "Venue Tags" section

## Filter Logic
- **OR logic**: Show venues with ANY of the selected tags
- Apply to both Staff & Venues tab and Calendar view

## Implementation Order
1. Database schema + seed data
2. Type definitions
3. Data access layer functions
4. Tag management page (CRUD UI)
5. Venue modal tag selector
6. Venue list tag display
7. Filter implementation (Staff & Venues + Calendar)
8. Full flow testing

## Design Constraints
- Use fixed color palette (like class tags)
- Space Type remains primary visual indicator
- Tags shown as secondary metadata (smaller chips)
- Unlimited tags per venue
- Follow existing tag UI patterns for consistency
