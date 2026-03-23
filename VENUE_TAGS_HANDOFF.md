# Venue Tags Implementation Handoff

## What's Done ✅

### 1. Database Schema
- **Migration created**: `database/migrations/003_add_venue_tags.sql`
  - Creates `venue_tags` junction table (venues ↔ tags)
  - Adds indexes for performance
  
- **Seed file created**: `database/seeds/002_venue_tags.sql`
  - Adds default tags: "indoor" 🏢 and "outdoor" 🌳
  - Category: "Venue Tags"

### 2. Types
- **Updated**: `types/database.ts`
  - Added `VenueTag` interface
  - Added `VenueTagInsert` type

### 3. API Routes
- **Created**: `app/api/venue-tags/route.ts`
  - POST: Assign tag to venue
  - DELETE: Remove tag from venue
  
- **Updated**: `app/api/venues/route.ts` (GET)
  - Now includes tags via LEFT JOIN
  
- **Updated**: `app/api/venues/[id]/route.ts` (GET)
  - Now includes tags via LEFT JOIN

## What's Needed ⏳

### 1. Run Migrations
```sql
-- In Supabase SQL Editor:
\i database/migrations/003_add_venue_tags.sql
\i database/seeds/002_venue_tags.sql
```

### 2. UI Components Needed

**New components:**
1. `VenueTagSelector.tsx` - Multi-select dropdown with search
   - Should follow pattern from existing tag selectors
   - Allow inline tag creation
   - Filter to "Venue Tags" category only
   
2. `VenueTagChip.tsx` - Display tag with emoji and color
   - Can probably reuse existing `TagChip` component if available

**Components to update:**
1. `VenueModal.tsx` - Add tag selector section
2. `VenueList.tsx` - Display tags as chips on venue cards
3. `FilterPanel.tsx` - Add venue tag filter (multi-select, OR logic)
4. `TagsPage.tsx` (admin/tags/page.tsx) - Add "Venue Tags" section for CRUD

### 3. Frontend Integration Pattern

**Fetching venues with tags:**
```typescript
// API returns:
{
  venues: [
    {
      id: "...",
      name: "Main Hall",
      space_type: "Auditorium",
      venue_tags: [
        {
          tag_id: "...",
          tags: {
            id: "...",
            name: "indoor",
            emoji: "🏢",
            color: "#3B82F6",
            category: "Venue Tags"
          }
        }
      ]
    }
  ]
}
```

**Transform for UI:**
```typescript
const venueWithTags = {
  ...venue,
  tags: venue.venue_tags?.map(vt => vt.tags) || []
};
```

**Assigning tags:**
```typescript
await fetch('/api/venue-tags', {
  method: 'POST',
  body: JSON.stringify({ venue_id, tag_id })
});
```

**Removing tags:**
```typescript
await fetch('/api/venue-tags', {
  method: 'DELETE',
  body: JSON.stringify({ venue_id, tag_id })
});
```

### 4. Filter Logic

**Staff & Venues tab:**
- Multi-select tag filter
- OR logic: Show venues with ANY selected tag
- Clear indication when filters active

**Calendar:**
- Filter events by venue tags
- If venue tags selected, only show events at venues matching those tags

```typescript
// Example filter logic
const filteredVenues = venues.filter(venue => {
  if (selectedVenueTags.length === 0) return true;
  return venue.tags.some(tag => selectedVenueTags.includes(tag.id));
});
```

### 5. Existing Tag UI Patterns to Follow

Look at how these existing tag systems work:
- Instructor skills (Skills category)
- Class tags (Subject, Event Type categories)
- Session tags

The tag selector should:
- Show autocomplete/dropdown
- Allow creating new tags inline
- Filter to "Venue Tags" category
- Support multi-select

## Testing Checklist

- [ ] Run migrations in Supabase
- [ ] Create new venue with tags
- [ ] Edit venue tags (add/remove)
- [ ] Delete venue (tags cleaned up automatically via CASCADE)
- [ ] Create/edit/delete venue tags from Tags page
- [ ] Delete tag in use (should warn + cascade)
- [ ] Filter venues by tags in Staff & Venues
- [ ] Filter calendar by venue tags
- [ ] Verify existing venues still work (no tags)

## Design Constraints

- Space Type remains **primary** visual indicator (bold/prominent)
- Tags shown as **secondary** metadata (smaller chips below venue name)
- Use same color palette as other tags
- Unlimited tags per venue
- Follow existing tag UI patterns for consistency

## Files Modified

- `database/migrations/003_add_venue_tags.sql` (NEW)
- `database/seeds/002_venue_tags.sql` (NEW)
- `types/database.ts` (UPDATED - added VenueTag)
- `app/api/venue-tags/route.ts` (NEW)
- `app/api/venues/route.ts` (UPDATED - GET includes tags)
- `app/api/venues/[id]/route.ts` (UPDATED - GET includes tags)

## Next Steps

The backend is complete and ready. Frontend integration is needed:
1. Run migrations
2. Create/update UI components
3. Integrate tag selector into venue modal
4. Add filters to Staff & Venues and Calendar
5. Add Venue Tags section to Tags management page
6. Test full flow

Estimated effort: 4-6 hours of frontend work.
