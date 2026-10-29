-- Activity feed, sponsor defaults, task completion stamps, admin safeguards.

-- ---------------------------------------------------------------------------
-- Activity log (written only by triggers)
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('created', 'updated', 'deleted')),
  summary text not null,
  admin_only boolean not null default false,
  actor_id uuid references public.allowed_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;
create policy "allowed read" on public.activity_log for select to authenticated
  using (public.is_allowed() and (not admin_only or public.is_admin()));
grant select on public.activity_log to authenticated;
revoke all on public.activity_log from anon;

create or replace function public.log_activity()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  rec jsonb;
  old_rec jsonb;
  entity text := tg_argv[0];
  label_col text := tg_argv[1];
  label text;
  act text;
  summary text;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
    act := 'deleted';
  else
    rec := to_jsonb(new);
    act := case when tg_op = 'INSERT' then 'created' else 'updated' end;
  end if;

  label := coalesce(left(rec ->> label_col, 80), entity);
  summary := act || ' ' || replace(entity, '_', ' ') || ' "' || label || '"';

  if tg_op = 'UPDATE' then
    old_rec := to_jsonb(old);
    -- skip no-op saves
    if (rec - 'updated_at') = (old_rec - 'updated_at') then
      return null;
    end if;
    if rec ? 'status' and rec ->> 'status' is distinct from old_rec ->> 'status' then
      summary := summary || ': status → ' || replace(rec ->> 'status', '_', ' ');
    end if;
  end if;

  insert into public.activity_log (entity_type, entity_id, action, summary, admin_only, actor_id)
  values (entity, (rec ->> 'id')::uuid, act, summary, entity = 'budget_item', public.my_user_id());
  return null;
end;
$$;
revoke execute on function public.log_activity() from anon, authenticated, public;

create trigger log_activity after insert or update or delete on public.companies
  for each row execute function public.log_activity('company', 'name');
create trigger log_activity after insert or update or delete on public.auction_items
  for each row execute function public.log_activity('auction_item', 'description');
create trigger log_activity after insert or update or delete on public.ticket_sales
  for each row execute function public.log_activity('ticket_sale', 'buyer_name');
create trigger log_activity after insert or update or delete on public.ideas
  for each row execute function public.log_activity('idea', 'title');
create trigger log_activity after insert or update or delete on public.tasks
  for each row execute function public.log_activity('task', 'title');
create trigger log_activity after insert on public.comments
  for each row execute function public.log_activity('comment', 'body');
create trigger log_activity after insert or update or delete on public.budget_items
  for each row execute function public.log_activity('budget_item', 'description');

-- ---------------------------------------------------------------------------
-- Sponsors: default tickets from level; seed deliverables from level benefits
-- ---------------------------------------------------------------------------
create or replace function public.sponsor_level_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
declare lvl public.sponsor_levels;
begin
  if new.sponsor_level_id is not null
     and (tg_op = 'INSERT' or new.sponsor_level_id is distinct from old.sponsor_level_id) then
    select * into lvl from public.sponsor_levels where id = new.sponsor_level_id;
    -- on insert keep an explicit value; on a level change reset to the level default
    if tg_op = 'UPDATE' or new.tickets_included is null then
      new.tickets_included := lvl.tickets_included;
    end if;
    if new.amount_committed is null then
      new.amount_committed := lvl.price;
    end if;
  end if;
  return new;
end;
$$;

create trigger sponsor_level_defaults before insert or update of sponsor_level_id on public.companies
  for each row execute function public.sponsor_level_defaults();

create or replace function public.seed_sponsor_deliverables()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.sponsor_level_id is not null
     and not exists (select 1 from public.sponsor_deliverables where company_id = new.id) then
    insert into public.sponsor_deliverables (company_id, description, sort_order, created_by)
    select new.id, b.benefit, b.ord, public.my_user_id()
    from public.sponsor_levels l,
         unnest(l.benefits) with ordinality as b(benefit, ord)
    where l.id = new.sponsor_level_id;
  end if;
  return null;
end;
$$;
revoke execute on function public.seed_sponsor_deliverables() from anon, authenticated, public;

create trigger seed_sponsor_deliverables after insert or update of sponsor_level_id on public.companies
  for each row execute function public.seed_sponsor_deliverables();

-- ---------------------------------------------------------------------------
-- Tasks: stamp completed_at
-- ---------------------------------------------------------------------------
create or replace function public.task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger task_completed_at before insert or update of status on public.tasks
  for each row execute function public.task_completed_at();

-- ---------------------------------------------------------------------------
-- Allowlist safeguards: normalize email, never remove/demote the last admin
-- ---------------------------------------------------------------------------
create or replace function public.normalize_allowed_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

create trigger normalize_email before insert or update of email on public.allowed_users
  for each row execute function public.normalize_allowed_email();

create or replace function public.protect_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and (select count(*) from public.allowed_users where role = 'admin' and id <> old.id) = 0 then
    raise exception 'Cannot remove or demote the last admin';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_last_admin before update of role or delete on public.allowed_users
  for each row execute function public.protect_last_admin();

-- Each user can turn their own reminder emails on/off (they can't otherwise write allowed_users).
create or replace function public.set_my_reminders(enabled boolean)
returns void
language sql security definer
set search_path = ''
as $$
  update public.allowed_users set reminders_enabled = enabled where email = public.current_email();
$$;
revoke execute on function public.set_my_reminders(boolean) from anon, public;
grant execute on function public.set_my_reminders(boolean) to authenticated;

-- Future tables get the same baseline grants (RLS still decides).
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public revoke all on tables from anon;
