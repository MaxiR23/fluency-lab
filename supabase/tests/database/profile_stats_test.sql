-- supabase/tests/database/profile_stats_test.sql
--
-- Tests for profile_stats, the numbers of the Profile screen.
--
-- Tested:
-- - a user with no sessions gets 0 sessions, no days and 0 new words
-- - the days are the caller's distinct session days in the given time zone, newest first
-- - the session count is the caller's sessions only
-- - new words are counted once across messages, ignoring case and spaces
-- - another user's sessions and new words are not counted
-- - anon cannot execute the function
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106090000_profile_stats.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('e0c', gen_random_uuid()),
  ('sa1', gen_random_uuid()),
  ('sa2', gen_random_uuid()),
  ('sa3', gen_random_uuid()),
  ('sb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com'),
  ((select id from t_ids where k = 'e0c'), 'c@test.com');
-- 02:00Z is still the 4th in Buenos Aires; two sessions on the 5th count as one day.
insert into public.sessions (id, user_id, title, created_at) values
  ((select id from t_ids where k = 'sa1'), (select id from t_ids where k = 'e0a'), 'Free chat', '2026-11-05T02:00:00+00'),
  ((select id from t_ids where k = 'sa2'), (select id from t_ids where k = 'e0a'), 'Free chat', '2026-11-05T15:00:00+00'),
  ((select id from t_ids where k = 'sa3'), (select id from t_ids where k = 'e0a'), 'Free chat', '2026-11-03T12:00:00+00'),
  ((select id from t_ids where k = 'sb1'), (select id from t_ids where k = 'e0b'), 'Free chat', '2026-11-10T12:00:00+00');
insert into public.messages (session_id, role, text, new_words) values
  ((select id from t_ids where k = 'sa1'), 'tutor', 'one', '["Definitely"]'),
  ((select id from t_ids where k = 'sa2'), 'tutor', 'two', '[" definitely ", "eager"]'),
  ((select id from t_ids where k = 'sa2'), 'user', 'three', null),
  ((select id from t_ids where k = 'sa3'), 'tutor', 'four', '"not an array"'),
  ((select id from t_ids where k = 'sa3'), 'tutor', 'five', '["  "]'),
  ((select id from t_ids where k = 'sb1'), 'tutor', 'six', '["zebra", "quokka", "eager"]');

set local role authenticated;

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0c'), true);
select results_eq(
  $$select session_count, session_days, new_words from public.profile_stats('UTC')$$,
  $$values (0::bigint, '{}'::date[], 0::bigint)$$,
  'a user with no sessions gets 0 sessions, no days and 0 new words'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0a'), true);
select results_eq(
  $$select session_count, session_days from public.profile_stats('UTC')$$,
  $$values (3::bigint, array['2026-11-05', '2026-11-03']::date[])$$,
  'the days are the caller distinct days in UTC, newest first, and the count is the caller sessions only'
);
select results_eq(
  $$select session_days from public.profile_stats('America/Argentina/Buenos_Aires')$$,
  $$values (array['2026-11-05', '2026-11-04', '2026-11-03']::date[])$$,
  'the days follow the given time zone'
);
select results_eq(
  $$select new_words from public.profile_stats('UTC')$$,
  array[2::bigint],
  'new words are counted once across messages, ignoring case and spaces'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0b'), true);
select results_eq(
  $$select session_count, new_words from public.profile_stats('UTC')$$,
  $$values (1::bigint, 3::bigint)$$,
  'another user sessions and new words are not counted'
);

reset role;
select is(
  has_function_privilege('anon', 'public.profile_stats(text)', 'execute'),
  false,
  'anon cannot execute profile_stats'
);
select is(
  has_function_privilege('authenticated', 'public.profile_stats(text)', 'execute'),
  true,
  'a signed-in user can execute profile_stats'
);

select * from finish();
rollback;
