-- RLS smoke test. Run in the Supabase SQL editor (or via MCP execute_sql).
-- Everything happens inside a transaction that is rolled back, so no data changes.
-- Every row in the output should read "denied"/"blocked"/0 for outsiders and match the
-- expectations noted for volunteer/admin. Anything containing "ALLOWED (bad)" is a failure.
begin;
create temp table t(n serial, who text, chk text, result text);
grant all on t to authenticated, anon;
grant usage on sequence t_n_seq to authenticated, anon;

insert into public.allowed_users (email, name, role) values ('Vol.Test@Gmail.com', 'Test Volunteer', 'volunteer');
insert into public.budget_items (description, estimated_amount) values ('fixture budget line', 100);
insert into public.ideas (title) values ('fixture idea');

-- anon: no table access at all
set local role anon;
do $$ begin
  perform count(*) from public.tasks;
  insert into t(who,chk,result) values ('anon','select tasks','ALLOWED (bad)');
exception when others then insert into t(who,chk,result) values ('anon','select tasks','denied'); end $$;
reset role;

-- outsider: signed in with Google but not on the allowlist -> sees and changes nothing
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"stranger@gmail.com","role":"authenticated"}', true);
insert into t(who,chk,result) select 'outsider','tasks visible (0)', count(*)::text from public.tasks;
insert into t(who,chk,result) select 'outsider','allowed_users visible (0)', count(*)::text from public.allowed_users;
do $$ begin
  insert into public.tasks(title) values ('hack');
  insert into t(who,chk,result) values ('outsider','insert task','ALLOWED (bad)');
exception when others then insert into t(who,chk,result) values ('outsider','insert task','denied'); end $$;
do $$ begin
  insert into public.allowed_users(email,name,role) values ('stranger@gmail.com','me','admin');
  insert into t(who,chk,result) values ('outsider','self-add to allowlist','ALLOWED (bad)');
exception when others then insert into t(who,chk,result) values ('outsider','self-add to allowlist','denied'); end $$;
reset role;

-- volunteer (email casing differs on purpose): everything except budget/users/settings
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"VOL.test@gmail.com","role":"authenticated"}', true);
insert into t(who,chk,result) select 'volunteer','is_allowed / is_admin (true / false)', public.is_allowed()::text||' / '||public.is_admin()::text;
insert into t(who,chk,result) select 'volunteer','budget visible (0)', count(*)::text from public.budget_items;
insert into t(who,chk,result) select 'volunteer','admin-only activity visible (0)', count(*)::text from public.activity_log where admin_only;
do $$ begin
  insert into public.budget_items(description) values ('vol line');
  insert into t(who,chk,result) values ('volunteer','insert budget','ALLOWED (bad)');
exception when others then insert into t(who,chk,result) values ('volunteer','insert budget','denied'); end $$;
with u as (update public.allowed_users set role='admin' where email='vol.test@gmail.com' returning 1)
  insert into t(who,chk,result) select 'volunteer','self-promote rows (0)', count(*)::text from u;
with u as (update public.settings set capacity = 999 returning 1)
  insert into t(who,chk,result) select 'volunteer','settings rows updated (0)', count(*)::text from u;
insert into public.companies(kind,name,sponsor_level_id) select 'sponsor','Test Sponsor Co', id from public.sponsor_levels where name='Bourbon';
insert into t(who,chk,result) select 'volunteer','sponsor tickets/committed (8 / 2500)', tickets_included::text||' / '||amount_committed::text from public.companies where name='Test Sponsor Co';
insert into t(who,chk,result) select 'volunteer','deliverables seeded (6)', count(*)::text from public.sponsor_deliverables d join public.companies c on c.id=d.company_id where c.name='Test Sponsor Co';
do $$ begin
  insert into public.idea_votes(idea_id,user_id) select i.id, u.id from public.ideas i, public.allowed_users u where i.title='fixture idea' and u.email='jaybubar@gmail.com';
  insert into t(who,chk,result) values ('volunteer','vote as someone else','ALLOWED (bad)');
exception when others then insert into t(who,chk,result) values ('volunteer','vote as someone else','denied'); end $$;
reset role;

-- admin: budget and settings
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"Ashley@OpasLearningAcademy.org","role":"authenticated"}', true);
insert into t(who,chk,result) select 'admin','is_admin (true)', public.is_admin()::text;
insert into t(who,chk,result) select 'admin','budget visible (1)', count(*)::text from public.budget_items;
with u as (update public.settings set revenue_goal = 60000 returning 1)
  insert into t(who,chk,result) select 'admin','settings rows updated (1)', count(*)::text from u;
reset role;

select who, chk, result from t order by n;
rollback;
