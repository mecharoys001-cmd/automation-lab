# Cache Invalidation Pattern

## Overview

The Symphonix Scheduler uses a request cache (`lib/requestCache.ts`) to deduplicate concurrent API calls and cache responses for 2 minutes. This improves performance during navigation but requires explicit invalidation after mutations.

## When to Invalidate

**Always invalidate the cache after:**
- DELETE operations (instructor, venue, template, session, etc.)
- POST/PUT operations (create/update)
- CSV imports
- Bulk operations (clear-all, clear-sessions)

## How to Invalidate

### Full Cache Clear

Use when clearing all data:

```typescript
import { requestCache } from '@/lib/requestCache';

// After successful delete-all operation
requestCache.clear();
```

### Pattern-Based Invalidation

Use when mutating specific resources:

```typescript
// After instructor operations
requestCache.invalidate(/\/api\/instructors/);

// After venue operations
requestCache.invalidate(/\/api\/venues/);

// After template operations
requestCache.invalidate(/\/api\/session_templates|\/api\/templates/);

// After session operations
requestCache.invalidate(/\/api\/sessions/);
```

## Examples

### Delete Operation
```typescript
async function handleDelete(id: string) {
  const res = await fetch(`/api/instructors/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');

  // ⚠️ CRITICAL: Invalidate cache
  requestCache.invalidate(/\/api\/instructors/);

  setToast({ message: 'Deleted', type: 'success' });
}
```

### CSV Import
```typescript
const res = await fetch('/api/venues/import', { method: 'POST', body: formData });
const data = await res.json();

if (data.success) {
  // ⚠️ CRITICAL: Invalidate cache
  requestCache.invalidate(/\/api\/venues/);
  
  setToast({ message: `Imported ${data.imported} venues`, type: 'success' });
}
```

## Testing Cache Invalidation

1. **Perform mutation** (delete, create, import)
2. **Navigate to another tab** that displays the affected data
3. **Expected:** Data should reflect changes WITHOUT hard refresh
4. **If stale data appears:** Cache invalidation is missing

## Common Mistakes

❌ **Forgetting to import:**
```typescript
// Missing import!
requestCache.invalidate(/\/api\/instructors/);
```

❌ **Invalidating before operation completes:**
```typescript
fetch('/api/delete', { method: 'DELETE' }); // No await!
requestCache.clear(); // Runs before delete finishes
```

❌ **Wrong regex pattern:**
```typescript
// Too broad — invalidates everything
requestCache.invalidate(/.*/);

// Better — target specific endpoints
requestCache.invalidate(/\/api\/instructors/);
```

## Performance Notes

- Cache invalidation is **instant** (no network calls)
- Next fetch after invalidation will trigger a fresh API call
- Cache TTL is 2 minutes — entries auto-expire
- Auto-cleanup runs every 60 seconds to remove expired entries
