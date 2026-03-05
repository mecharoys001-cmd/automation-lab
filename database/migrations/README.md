# Database Migrations for Symphonix Scheduler

## Running Migrations

All migrations should be run in **Supabase SQL Editor** in sequence.

### Migration Order:

1. **002_add_tag_categories.sql** - Adds `category` column to tags table
2. **001_default_tags.sql** (in seeds/) - Pre-populates default Skills and Subject tags

## Migration: Tag Categories

### What Changed:
- Added `category` field to `tags` table
- Skills and Subjects are now tags in specific categories
- UI updated to use tag selectors instead of hardcoded arrays

### Steps:

1. **Run the migration:**
   ```sql
   -- In Supabase SQL Editor, run:
   \i database/migrations/002_add_tag_categories.sql
   ```

2. **Seed default tags:**
   ```sql
   -- In Supabase SQL Editor, run:
   \i database/seeds/001_default_tags.sql
   ```

3. **(Optional) Migrate existing data:**
   If you have existing instructors or templates with skills/subjects, you may want to:
   - Create tags from existing unique skill/subject values
   - Keep the array columns for backward compatibility

### New Categories:

- **Skills**: Percussion, Strings, Brass, Woodwind, Piano, Guitar, Choral, General Music
- **Subject**: Instrumental, Vocal, Theory, Performance, Ensemble
- **Event Type**: Field Trip, Guest Artist, Showcase, Workshop, Rehearsal
- **Administrative**: TA Check-In, Setup/Teardown, Assessment

### UI Changes:

**Classes Page:**
- "Required Skills" now uses TagSelector (Skills category)

**People Page:**
- Instructor skills now use TagSelector (Skills category)

### Benefits:

✅ **Flexible**: Admins can create custom skill/subject tags
✅ **Organized**: Tags grouped by category
✅ **Consistent**: Same tag system across the app
✅ **Filterable**: Categories show up in filter systems
✅ **No data loss**: Original array columns still work

## Rollback:

If needed, you can drop the category column:
```sql
ALTER TABLE tags DROP COLUMN IF EXISTS category;
DROP INDEX IF EXISTS idx_tags_category;
```

This will not break existing functionality (UI will fall back to "General" category).
