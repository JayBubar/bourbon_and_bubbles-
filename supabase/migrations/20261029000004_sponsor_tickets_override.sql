-- When a sponsor's level changes, only reset tickets_included to the level default
-- if the same save didn't also set tickets explicitly.
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
    if (tg_op = 'INSERT' and new.tickets_included is null)
       or (tg_op = 'UPDATE' and new.tickets_included is not distinct from old.tickets_included) then
      new.tickets_included := lvl.tickets_included;
    end if;
    if new.amount_committed is null then
      new.amount_committed := lvl.price;
    end if;
  end if;
  return new;
end;
$$;
