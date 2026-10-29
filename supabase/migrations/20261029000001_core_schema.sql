-- Bourbon & Bubbles Volunteer Hub: core schema, helper functions, RLS.
-- Access model: only emails in allowed_users can read/write anything.
-- Admins additionally manage users, settings, sponsor levels and the budget.

-- ---------------------------------------------------------------------------
-- Allowlist (created first; helper functions depend on it)
-- ---------------------------------------------------------------------------
create table public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and email like '%@%'),
  name text not null,
  role text not null default 'volunteer' check (role in ('admin', 'volunteer')),
  reminders_enabled boolean not null default true,
  created_by uuid references public.allowed_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index allowed_users_email_key on public.allowed_users (email);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies can consult allowed_users)
-- ---------------------------------------------------------------------------
create or replace function public.current_email()
returns text
language sql stable
set search_path = ''
as $$
  select lower(trim(coalesce(auth.jwt() ->> 'email', '')))
$$;

create or replace function public.is_allowed()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_users where email = public.current_email()
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_users
    where email = public.current_email() and role = 'admin'
  )
$$;

-- allowed_users.id of the signed-in user (null if not listed)
create or replace function public.my_user_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select id from public.allowed_users where email = public.current_email()
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.allowed_users alter column created_by set default public.my_user_id();

-- ---------------------------------------------------------------------------
-- Settings (single row)
-- ---------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  event_name text not null default 'Bourbon & Bubbles 2027',
  event_starts_at timestamptz not null default '2027-04-09 18:00:00-04',
  venue text not null default 'The Laundry, 2046 Talley St, Columbia SC 29201',
  ticket_price numeric(10,2) not null default 150,
  capacity int not null default 140,
  revenue_goal numeric(12,2) not null default 50000,
  reminders_enabled boolean not null default false,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sponsor levels
-- ---------------------------------------------------------------------------
create table public.sponsor_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null default 0,
  tickets_included int not null default 0,
  reserved_table boolean not null default false,
  table_note text,
  benefits text[] not null default '{}',
  sort_order int not null default 0,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tables (seating inventory)
-- ---------------------------------------------------------------------------
create table public.event_tables (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  type text not null default 'round' check (type in ('round', 'banquet', 'cocktail', 'other')),
  seats int not null default 8 check (seats >= 0),
  notes text,
  sort_order int not null default 0,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Companies: auction targets, sponsors, distributors
-- ---------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('auction', 'sponsor', 'distributor')),
  name text not null check (length(trim(name)) > 0),
  category text,
  contact_name text,
  contact_title text,
  email text,
  phone text,
  website text,
  address text,
  owner_id uuid references public.allowed_users (id) on delete set null,
  status text not null default 'not_contacted'
    check (status in ('not_contacted', 'reached_out', 'following_up', 'yes', 'no')),
  last_contact_date date,
  notes text,
  -- sponsor fields
  sponsor_level_id uuid references public.sponsor_levels (id) on delete set null,
  amount_committed numeric(12,2),
  amount_paid numeric(12,2),
  invoice_sent boolean not null default false,
  tickets_included int,
  table_id uuid references public.event_tables (id) on delete set null,
  tax_deductible numeric(12,2),
  -- distributor fields
  product_provided text,
  tasting_host text,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- dedupe on company name within a list
create unique index companies_kind_name_key on public.companies (kind, lower(trim(name)));
create index companies_owner_idx on public.companies (owner_id);

create table public.auction_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  description text not null,
  estimated_value numeric(12,2),
  received boolean not null default false,
  bid_sheet_number text,
  donor_display_name text,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auction_items_company_idx on public.auction_items (company_id);

create table public.sponsor_deliverables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  description text not null,
  done boolean not null default false,
  sort_order int not null default 0,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sponsor_deliverables_company_idx on public.sponsor_deliverables (company_id);

-- ---------------------------------------------------------------------------
-- Ticket sales (tracking only)
-- ---------------------------------------------------------------------------
create table public.ticket_sales (
  id uuid primary key default gen_random_uuid(),
  buyer_name text not null,
  email text,
  phone text,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(10,2) not null default 150,
  amount_paid numeric(12,2) not null default 0,
  payment_method text check (payment_method in ('check', 'card', 'cash', 'other')),
  sale_date date not null default (now() at time zone 'America/New_York')::date,
  sold_by_id uuid references public.allowed_users (id) on delete set null,
  guest_names text,
  dietary_notes text,
  table_id uuid references public.event_tables (id) on delete set null,
  tax_deductible numeric(12,2),
  notes text,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ideas board
-- ---------------------------------------------------------------------------
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'other'
    check (category in ('entertainment', 'venue_decor', 'food', 'drinks', 'program', 'auction', 'other')),
  status text not null default 'idea'
    check (status in ('idea', 'considering', 'finalized', 'rejected')),
  title text not null,
  description text,
  link text,
  estimated_cost numeric(12,2),
  vendor_name text,
  vendor_contact text,
  contract_signed boolean not null default false,
  deposit_amount numeric(12,2),
  deposit_due date,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.idea_votes (
  idea_id uuid not null references public.ideas (id) on delete cascade,
  user_id uuid not null references public.allowed_users (id) on delete cascade default public.my_user_id(),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assignee_id uuid references public.allowed_users (id) on delete set null,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  company_id uuid references public.companies (id) on delete set null,
  idea_id uuid references public.ideas (id) on delete set null,
  is_milestone boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_assignee_due_idx on public.tasks (assignee_id, due_date);

-- ---------------------------------------------------------------------------
-- Comments (polymorphic)
-- ---------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('company', 'idea', 'task', 'ticket', 'auction_item')),
  entity_id uuid not null,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  author_id uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_entity_idx on public.comments (entity_type, entity_id, created_at);

-- ---------------------------------------------------------------------------
-- Budget (admin only)
-- ---------------------------------------------------------------------------
create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'Other',
  description text not null,
  vendor text,
  estimated_amount numeric(12,2) not null default 0,
  actual_amount numeric(12,2),
  paid boolean not null default false,
  due_date date,
  idea_id uuid references public.ideas (id) on delete set null,
  created_by uuid references public.allowed_users (id) on delete set null default public.my_user_id(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reminder log (written by the scheduled function with the service role)
-- ---------------------------------------------------------------------------
create table public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.allowed_users (id) on delete cascade,
  sent_on date not null,
  task_count int not null,
  provider_id text,
  created_by uuid references public.allowed_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sent_on)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'allowed_users', 'settings', 'sponsor_levels', 'event_tables', 'companies',
    'auction_items', 'sponsor_deliverables', 'ticket_sales', 'ideas', 'tasks',
    'comments', 'budget_items', 'reminder_log'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.allowed_users        enable row level security;
alter table public.settings             enable row level security;
alter table public.sponsor_levels       enable row level security;
alter table public.event_tables         enable row level security;
alter table public.companies            enable row level security;
alter table public.auction_items        enable row level security;
alter table public.sponsor_deliverables enable row level security;
alter table public.ticket_sales         enable row level security;
alter table public.ideas                enable row level security;
alter table public.idea_votes           enable row level security;
alter table public.tasks                enable row level security;
alter table public.comments             enable row level security;
alter table public.budget_items         enable row level security;
alter table public.reminder_log         enable row level security;

-- Read: any listed user. Write: admins only.
create policy "allowed read" on public.allowed_users for select to authenticated using (public.is_allowed());
create policy "admin write" on public.allowed_users for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "allowed read" on public.settings for select to authenticated using (public.is_allowed());
create policy "admin write" on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "allowed read" on public.sponsor_levels for select to authenticated using (public.is_allowed());
create policy "admin write" on public.sponsor_levels for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Read and edit: any listed user.
do $$
declare t text;
begin
  foreach t in array array[
    'event_tables', 'companies', 'auction_items', 'sponsor_deliverables',
    'ticket_sales', 'ideas', 'tasks'
  ] loop
    execute format(
      'create policy "allowed all" on public.%I for all to authenticated
         using (public.is_allowed()) with check (public.is_allowed())', t);
  end loop;
end $$;

-- Votes: everyone sees them, each user adds/removes only their own.
create policy "allowed read" on public.idea_votes for select to authenticated using (public.is_allowed());
create policy "own insert" on public.idea_votes for insert to authenticated
  with check (public.is_allowed() and user_id = public.my_user_id());
create policy "own delete" on public.idea_votes for delete to authenticated
  using (public.is_allowed() and user_id = public.my_user_id());

-- Comments: everyone reads and posts as themselves; authors (or admins) edit/delete.
create policy "allowed read" on public.comments for select to authenticated using (public.is_allowed());
create policy "own insert" on public.comments for insert to authenticated
  with check (public.is_allowed() and author_id = public.my_user_id());
create policy "own update" on public.comments for update to authenticated
  using (public.is_allowed() and (author_id = public.my_user_id() or public.is_admin()))
  with check (public.is_allowed());
create policy "own delete" on public.comments for delete to authenticated
  using (public.is_allowed() and (author_id = public.my_user_id() or public.is_admin()));

-- Budget: admins only, for everything.
create policy "admin all" on public.budget_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Reminder log: admins can look; only the service role writes.
create policy "admin read" on public.reminder_log for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants: nothing for anon; authenticated is gated by RLS above.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.current_email(), public.is_allowed(), public.is_admin(), public.my_user_id() to authenticated;
revoke execute on function public.is_allowed(), public.is_admin(), public.my_user_id() from anon, public;
