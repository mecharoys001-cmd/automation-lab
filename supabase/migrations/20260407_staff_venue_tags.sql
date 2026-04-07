-- Junction table: staff ↔ tags
create table if not exists public.staff_tags (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (staff_id, tag_id)
);

-- Junction table: venues ↔ tags
create table if not exists public.venue_tags (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (venue_id, tag_id)
);

-- RLS policies
alter table public.staff_tags enable row level security;
alter table public.venue_tags enable row level security;

create policy "Service role full access on staff_tags"
  on public.staff_tags for all
  using (true)
  with check (true);

create policy "Service role full access on venue_tags"
  on public.venue_tags for all
  using (true)
  with check (true);
