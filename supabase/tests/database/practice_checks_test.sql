-- supabase/tests/database/practice_checks_test.sql
--
-- Tests for the practice_checks table and its row level security.
--
-- Tested:
-- - RLS is on and anon has no privilege
-- - authenticated selects and inserts, and never updates or deletes
-- - a row defaults user_id to the caller
-- - a user inserts only into their own runs and reads only their own rows
-- - the stage, checker model, reason, solver answer and exercise checks
-- - deleting a user removes their check rows
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261108060000_practice_checks.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('u0a', gen_random_uuid()),
  ('u0b', gen_random_uuid()),
  ('ra1', gen_random_uuid()),
  ('rb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'u0a'), 'a@test.com'),
  ((select id from t_ids where k = 'u0b'), 'b@test.com');
insert into public.practice_runs (id, user_id, focus, topic_id, target) values
  ((select id from t_ids where k = 'ra1'), (select id from t_ids where k = 'u0a'), 'mistakes', null, 5),
  ((select id from t_ids where k = 'rb1'), (select id from t_ids where k = 'u0b'), 'topic', 'conditionals', 10);
insert into public.practice_checks (user_id, run_id, stage, generator_model, checker_model, passed, reason, exercise) values
  ((select id from t_ids where k = 'u0b'), (select id from t_ids where k = 'rb1'), 'code', 'claude-haiku-5-5', null, false, 'limit', '{"kind":"fix"}'::jsonb);

select results_eq($$select relrowsecurity from pg_class where oid = 'public.practice_checks'::regclass$$, array[true], 'RLS is on for practice_checks');
select ok(not has_table_privilege('anon', 'public.practice_checks', 'select, insert, update, delete'), 'anon has no privilege on practice_checks');
select ok(has_table_privilege('authenticated', 'public.practice_checks', 'select') and has_any_column_privilege('authenticated', 'public.practice_checks', 'insert'), 'authenticated selects and inserts');
select ok(not has_any_column_privilege('authenticated', 'public.practice_checks', 'update') and not has_table_privilege('authenticated', 'public.practice_checks', 'delete'), 'authenticated cannot update or delete');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0a'), true);

select results_eq($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, exercise) values ((select id from t_ids where k = 'ra1'), 'code', 'claude-haiku-5-5', null, true, '{"kind":"gap"}'::jsonb) returning user_id$$, $$select id from t_ids where k = 'u0a'$$, 'a row defaults user_id to the caller');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, exercise) values ((select id from t_ids where k = 'rb1'), 'code', 'claude-haiku-5-5', null, true, '{"kind":"gap"}'::jsonb)$$, '42501', null, 'a user cannot insert into another user run');
select results_eq($$select count(*) from public.practice_checks$$, array[1::bigint], 'a user reads only their own rows');
select throws_ok($$update public.practice_checks set passed = false$$, '42501', null, 'a user cannot update a row');
select throws_ok($$delete from public.practice_checks$$, '42501', null, 'a user cannot delete a row');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, exercise) values ((select id from t_ids where k = 'ra1'), 'code', 'claude-haiku-5-5', 'claude-haiku-5-5', true, '{"kind":"gap"}'::jsonb)$$, '23514', null, 'a code row with a checker model fails');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, exercise) values ((select id from t_ids where k = 'ra1'), 'solver', 'claude-haiku-5-5', null, true, '{"kind":"gap"}'::jsonb)$$, '23514', null, 'a solver row without a checker model fails');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, exercise) values ((select id from t_ids where k = 'ra1'), 'code', 'claude-haiku-5-5', null, false, '{"kind":"gap"}'::jsonb)$$, '23514', null, 'a failed row with no reason fails');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, exercise) values ((select id from t_ids where k = 'ra1'), 'other', 'claude-haiku-5-5', null, true, '{"kind":"gap"}'::jsonb)$$, '23514', null, 'an unknown stage fails');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, reason, exercise) values ((select id from t_ids where k = 'ra1'), 'code', 'claude-haiku-5-5', null, false, '', '{"kind":"gap"}'::jsonb)$$, '23514', null, 'an empty reason fails');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, reason, exercise) values ((select id from t_ids where k = 'ra1'), 'code', 'claude-haiku-5-5', null, false, repeat('x', 301), '{"kind":"gap"}'::jsonb)$$, '23514', null, 'a 301-character reason fails');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, solver_answer, exercise) values ((select id from t_ids where k = 'ra1'), 'solver', 'claude-haiku-5-5', 'claude-haiku-5-5', true, '', '{"kind":"gap"}'::jsonb)$$, '23514', null, 'an empty solver answer fails');
select throws_ok($$insert into public.practice_checks (run_id, stage, generator_model, checker_model, passed, exercise) values ((select id from t_ids where k = 'ra1'), 'code', 'claude-haiku-5-5', null, true, '[1]'::jsonb)$$, '23514', null, 'an exercise that is not an object fails');

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0b'), true);
select results_eq($$select count(*) from public.practice_checks where run_id = (select id from t_ids where k = 'ra1')$$, array[0::bigint], 'user B reads none of the rows of A');

reset role;
select lives_ok($$delete from auth.users where id = (select id from t_ids where k = 'u0a')$$, 'deleting a user with check rows does not fail');
select is((select count(*) from public.practice_checks where run_id = (select id from t_ids where k = 'ra1')), 0::bigint, 'the check rows of a deleted user are gone');

select * from finish();
rollback;
