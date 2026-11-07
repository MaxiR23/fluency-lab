-- supabase/tests/database/profile_stats_test.sql
--
-- Tests for profile_stats, the numbers of the Profile screen.
--
-- Tested:
-- - a user with no sessions gets 0 sessions, no days and 0 new words
-- - the days are the caller's distinct session days in the given time zone, newest first
-- - the session count is the caller's sessions only
-- - new words are counted once across messages and correction threads, ignoring case and spaces;
--   blank, null and non-array thread words are skipped
-- - another user's sessions, new words and thread words are not counted
-- - a day with only a finished practice run is a day, and the run is not a session
-- - a started but unfinished run is not a day
-- - a chat and a finished run on the same day give that day once
-- - a finished run lands on the local date of finished_at in the given time zone
-- - another user's runs never appear in the days
-- - anon cannot execute the function
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106090000_profile_stats.sql
-- SEE: supabase/migrations/20261106130000_thread_word_totals.sql
-- SEE: supabase/migrations/20261108010000_profile_active_days.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('e0c', gen_random_uuid()),
  ('sa1', gen_random_uuid()),
  ('sa2', gen_random_uuid()),
  ('sa3', gen_random_uuid()),
  ('sb1', gen_random_uuid()),
  ('e0d', gen_random_uuid()),
  ('e0e', gen_random_uuid()),
  ('e0f', gen_random_uuid()),
  ('e0g', gen_random_uuid()),
  ('sf1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com'),
  ((select id from t_ids where k = 'e0c'), 'c@test.com'),
  ((select id from t_ids where k = 'e0d'), 'd@test.com'),
  ((select id from t_ids where k = 'e0e'), 'e@test.com'),
  ((select id from t_ids where k = 'e0f'), 'f@test.com'),
  ((select id from t_ids where k = 'e0g'), 'g@test.com');
-- 02:00Z is still the 4th in Buenos Aires; two sessions on the 5th count as one day.
insert into public.sessions (id, user_id, title, created_at) values
  ((select id from t_ids where k = 'sa1'), (select id from t_ids where k = 'e0a'), 'Free chat', '2026-11-05T02:00:00+00'),
  ((select id from t_ids where k = 'sa2'), (select id from t_ids where k = 'e0a'), 'Free chat', '2026-11-05T15:00:00+00'),
  ((select id from t_ids where k = 'sa3'), (select id from t_ids where k = 'e0a'), 'Free chat', '2026-11-03T12:00:00+00'),
  ((select id from t_ids where k = 'sb1'), (select id from t_ids where k = 'e0b'), 'Free chat', '2026-11-10T12:00:00+00'),
  ((select id from t_ids where k = 'sf1'), (select id from t_ids where k = 'e0f'), 'Free chat', '2026-11-02T12:00:00+00');
insert into public.messages (session_id, role, text, new_words) values
  ((select id from t_ids where k = 'sa1'), 'tutor', 'one', '["Definitely"]'),
  ((select id from t_ids where k = 'sa2'), 'tutor', 'two', '[" definitely ", "eager"]'),
  ((select id from t_ids where k = 'sa2'), 'user', 'three', null),
  ((select id from t_ids where k = 'sa3'), 'tutor', 'four', '"not an array"'),
  ((select id from t_ids where k = 'sa3'), 'tutor', 'five', '["  "]'),
  ((select id from t_ids where k = 'sb1'), 'tutor', 'six', '["zebra", "quokka", "eager"]');
insert into public.thread_messages (message_id, role, text, new_words) values
  ((select id from public.messages where text = 'three'), 'user', 'Is gregarious right?', '["Gregarious", " EAGER "]'),
  ((select id from public.messages where text = 'four'), 'tutor', 'odd', '"not an array"'),
  ((select id from public.messages where text = 'five'), 'tutor', 'blank', '["  "]'),
  ((select id from public.messages where text = 'three'), 'tutor', 'none', null),
  ((select id from public.messages where text = 'six'), 'user', 'What is a platypus?', '["platypus", "zebra"]');
-- Runs count by the local date of finished_at; an unfinished run never counts.
-- e0g finishes at 00:10 on the 8th in Tokyo, still the 7th in UTC.
insert into public.practice_runs (user_id, focus, target, created_at, finished_at) values
  ((select id from t_ids where k = 'e0d'), 'words', 5, '2026-11-04T12:00:00+00', '2026-11-04T12:10:00+00'),
  ((select id from t_ids where k = 'e0e'), 'words', 5, '2026-11-04T12:00:00+00', '2026-11-04T12:10:00+00'),
  ((select id from t_ids where k = 'e0e'), 'words', 5, '2026-11-05T12:00:00+00', null),
  ((select id from t_ids where k = 'e0f'), 'words', 5, '2026-11-02T15:00:00+00', '2026-11-02T15:10:00+00'),
  ((select id from t_ids where k = 'e0f'), 'words', 5, '2026-11-04T12:00:00+00', '2026-11-04T12:10:00+00'),
  ((select id from t_ids where k = 'e0g'), 'words', 5, '2026-11-07T14:50:00+00', '2026-11-07T15:10:00+00'),
  ((select id from t_ids where k = 'e0b'), 'words', 5, '2026-11-12T12:00:00+00', '2026-11-12T12:10:00+00');

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
  array[3::bigint],
  'new words are counted once across messages and threads, ignoring case and spaces'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0b'), true);
select results_eq(
  $$select session_count, new_words from public.profile_stats('UTC')$$,
  $$values (1::bigint, 4::bigint)$$,
  'another user sessions, new words and thread words are not counted'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0d'), true);
select results_eq(
  $$select session_count, session_days, new_words from public.profile_stats('UTC')$$,
  $$values (0::bigint, array['2026-11-04']::date[], 0::bigint)$$,
  'a day with only a finished run is a day, and the run is not a session'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0e'), true);
select results_eq(
  $$select session_days from public.profile_stats('UTC')$$,
  $$values (array['2026-11-04']::date[])$$,
  'a started but unfinished run is not a day'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0f'), true);
select results_eq(
  $$select session_count, session_days from public.profile_stats('UTC')$$,
  $$values (1::bigint, array['2026-11-04', '2026-11-02']::date[])$$,
  'a chat and a finished run on the same day give that day once'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0g'), true);
select results_eq(
  $$select session_days from public.profile_stats('Asia/Tokyo')$$,
  $$values (array['2026-11-08']::date[])$$,
  'a run finished just after midnight in the time zone lands on its local date'
);
select results_eq(
  $$select session_days from public.profile_stats('UTC')$$,
  $$values (array['2026-11-07']::date[])$$,
  'the same run is on the previous day in UTC'
);

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0b'), true);
select results_eq(
  $$select session_count, session_days from public.profile_stats('UTC')$$,
  $$values (1::bigint, array['2026-11-12', '2026-11-10']::date[])$$,
  'a user gets their own run days and never another user runs'
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
