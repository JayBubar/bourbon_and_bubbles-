-- Seed data: admins, settings, sponsor levels, seating inventory, milestone tasks.

insert into public.allowed_users (email, name, role) values
  ('jaybubar@gmail.com', 'Jay Bubar', 'admin'),
  ('virginia@opaslearningacademy.org', 'Virginia Wells', 'admin'),
  ('ashley@opaslearningacademy.org', 'Ashley Bubar', 'admin')
on conflict (email) do nothing;

insert into public.settings (id) values (1) on conflict (id) do nothing;

insert into public.sponsor_levels (name, price, tickets_included, reserved_table, table_note, benefits, sort_order) values
  ('Presenting', 5000, 8, true, 'Reserved table of 8 near stage', array[
    'Exclusive Presenting Sponsor recognition',
    'Top logo placement on event materials',
    'Recognition in remarks',
    'Event signage',
    'Private reserve bourbon tasting',
    'Reserve bottle at table',
    'Promotions (social/email)',
    'Post-event acknowledgment'], 1),
  ('Bourbon', 2500, 8, true, 'Reserved table of 8', array[
    'Prominent logo placement',
    'Recognition in remarks',
    'Event signage',
    'Private table tasting by distributor partner',
    'Promotions (social/email)',
    'Post-event acknowledgment'], 2),
  ('Believe', 1000, 4, false, null, array[
    'Name/logo on event materials',
    'Signage recognition',
    'Post-event acknowledgment'], 3),
  ('Belong', 500, 2, false, null, array[
    'Name on event materials',
    'Post-event acknowledgment'], 4),
  ('Friend', 250, 0, false, null, array[
    'Name recognition',
    'Gift for sponsors who can''t attend'], 5)
on conflict (name) do nothing;

insert into public.event_tables (label, type, seats, sort_order)
select 'Round ' || n, 'round', 8, n from generate_series(1, 10) n;
insert into public.event_tables (label, type, seats, sort_order)
select 'Banquet ' || n, 'banquet', 8, 10 + n from generate_series(1, 2) n;
insert into public.event_tables (label, type, seats, notes, sort_order)
select 'Cocktail ' || n, 'cocktail', 0, 'Standing cocktail table (not seated)', 20 + n from generate_series(1, 4) n;

-- Milestones counted back from Friday April 9, 2027. All editable; start unassigned.
insert into public.tasks (title, description, due_date, is_milestone) values
  ('Finalize sponsor target list', 'Agree on the companies to approach and assign owners.', '2026-11-13', true),
  ('Send first wave of sponsorship asks', 'Email/mail the sponsorship packet to the first wave of targets.', '2026-11-20', true),
  ('Book entertainment (band/DJ)', 'Sign contract and pay deposit.', '2026-12-11', true),
  ('Send save-the-date', 'Email + social save-the-date for April 9, 2027.', '2027-01-08', true),
  ('Confirm distributor & brand partners', 'Lock in spirits distributors and tasting hosts for the bourbon trail.', '2027-01-15', true),
  ('Open ticket sales', 'Ticket link live and announced.', '2027-01-22', true),
  ('Finalize caterer and menu', null, '2027-02-05', true),
  ('Silent auction solicitation push complete', 'All auction targets contacted at least twice.', '2027-02-19', true),
  ('Sponsor commitment deadline (for print)', 'Final day to be included on printed materials; collect logos.', '2027-03-05', true),
  ('Order signage & printed materials', null, '2027-03-12', true),
  ('Auction items due', 'All donated items received and logged.', '2027-03-19', true),
  ('Final headcount to venue & caterer', null, '2027-03-26', true),
  ('Seating chart & bid sheets finalized', null, '2027-04-02', true),
  ('Volunteer event-day briefing', 'Roles, timeline, setup and teardown.', '2027-04-07', true),
  ('Post-event thank-yous & sponsor acknowledgments', null, '2027-04-23', true);
