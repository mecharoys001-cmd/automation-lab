# Symphonix Scheduler Database Migrations

## ⚠️ IMPORTANT: Run these migrations before using the scheduler

The Symphonix Scheduler requires database tables to be set up in Supabase.

### Migration Location
Migrations are in: `/home/ethan/.openclaw/workspace/projects/symphonix-scheduler/supabase/migrations/`

### How to Run Migrations

1. Go to the Supabase SQL Editor:
   🔗 https://supabase.com/dashboard/project/djuygbsnqakbctkjlmvl/sql/new

2. Run each migration file **in order**:
   - `001_schema.sql` - Core database schema
   - `002_rls_policies.sql` - Row Level Security policies
   - `003_seed_data.sql` - Initial seed data
   - `004_phase4_exceptions.sql` - Exception handling
   - `006_venue_parameters.sql` - Venue configuration
   - `007_settings.sql` - Settings table

3. Copy the entire contents of each file and paste into the SQL Editor

4. Click "Run" for each migration

5. Verify successful execution (no errors)

### Alternative: Use Supabase CLI

If you have the Supabase CLI installed:

```bash
cd /home/ethan/.openclaw/workspace/automation-lab
supabase link --project-ref djuygbsnqakbctkjlmvl
supabase db push
```

### After Migrations

Once migrations are complete, the scheduler will be ready to use at:
http://localhost:3000/tools/scheduler
