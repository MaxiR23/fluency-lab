-- supabase/tests/database/practice_test.sql
--
-- Tests for the daily practice tables, their row level security and add_practice_cost.
--
-- Tested:
-- - RLS is on and anon has no privilege on practice_runs and practice_items
-- - authenticated selects, inserts and updates only the named columns, and never deletes
-- - a run defaults user_id to the caller
-- - the focus, topic, target, options, accepted and position checks
-- - a duplicate position fails and on conflict do nothing lives as authenticated
-- - add_practice_cost adds the exact amount, ignores a negative amount and another user run
-- - add_practice_cost is security invoker and anon cannot execute it
-- - a user reads and writes only their own runs and items
-- - deleting a user removes their runs and items
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261107000000_practice.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(51);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('u0a', gen_random_uuid()),
  ('u0b', gen_random_uuid()),
  ('ra1', gen_random_uuid()),
  ('rb1', gen_random_uuid()),
  ('ia1', gen_random_uuid()),
  ('ib1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'u0a'), 'a@test.com'),
  ((select id from t_ids where k = 'u0b'), 'b@test.com');
insert into public.practice_runs (id, user_id, focus, topic_id, target) values
  ((select id from t_ids where k = 'ra1'), (select id from t_ids where k = 'u0a'), 'mistakes', null, 5),
  ((select id from t_ids where k = 'rb1'), (select id from t_ids where k = 'u0b'), 'topic', 'conditionals', 10);
insert into public.practice_items (id, run_id, position, kind, rule, prompt, options, accepted, explanation) values
  ((select id from t_ids where k = 'ia1'), (select id from t_ids where k = 'ra1'), 0, 'choose', 'Present perfect', 'I ___ there twice.', '["have been","was","am"]'::jsonb, '["have been"]'::jsonb, 'Experience.'),
  ((select id from t_ids where k = 'ib1'), (select id from t_ids where k = 'rb1'), 0, 'fix', 'Articles', 'I has a car.', null, '["I have a car."]'::jsonb, 'Use have.');

select results_eq($$select relrowsecurity from pg_class where oid = 'public.practice_runs'::regclass$$, array[true], 'RLS is on for practice_runs');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.practice_items'::regclass$$, array[true], 'RLS is on for practice_items');
select ok(not has_table_privilege('anon', 'public.practice_runs', 'select, insert, update, delete'), 'anon has no privilege on practice_runs');
select ok(not has_table_privilege('anon', 'public.practice_items', 'select, insert, update, delete'), 'anon has no privilege on practice_items');
select ok(has_table_privilege('authenticated', 'public.practice_runs', 'select') and has_table_privilege('authenticated', 'public.practice_items', 'select'), 'authenticated selects both tables');
select ok(not has_table_privilege('authenticated', 'public.practice_runs', 'delete') and not has_table_privilege('authenticated', 'public.practice_items', 'delete'), 'authenticated cannot delete from either table');
select ok(not has_function_privilege('anon', 'public.add_practice_cost(uuid,numeric)', 'execute'), 'anon cannot execute add_practice_cost');
select is((select prosecdef from pg_proc where oid = 'public.add_practice_cost(uuid,numeric)'::regprocedure), false, 'add_practice_cost is security invoker');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0a'), true);

select results_eq($$select id from public.practice_runs$$, $$select id from t_ids where k = 'ra1'$$, 'a user reads only their own runs');
select results_eq($$select id from public.practice_items$$, $$select id from t_ids where k = 'ia1'$$, 'a user reads only their own items');
select results_eq($$insert into public.practice_runs (focus, target) values ('words', 15) returning user_id$$, $$select id from t_ids where k = 'u0a'$$, 'a run defaults user_id to the caller');
select results_eq($$insert into public.practice_runs (focus, topic_id, target) values ('topic', 'articles', 5) returning topic_id$$, array['articles'::text], 'a topic run stores its topic');
select throws_ok($$insert into public.practice_runs (focus, target) values ('chat', 5)$$, '23514', null, 'an unknown focus fails');
select throws_ok($$insert into public.practice_runs (focus, topic_id, target) values ('topic', 'sports', 5)$$, '23514', null, 'an unknown topic fails');
select throws_ok($$insert into public.practice_runs (focus, target) values ('topic', 5)$$, '23514', null, 'a topic run without a topic fails');
select throws_ok($$insert into public.practice_runs (focus, topic_id, target) values ('mistakes', 'articles', 5)$$, '23514', null, 'a mistakes run with a topic fails');
select throws_ok($$insert into public.practice_runs (focus, target) values ('mistakes', 7)$$, '23514', null, 'a target of 7 fails');
select throws_ok($$insert into public.practice_runs (user_id, focus, target) values ((select id from t_ids where k = 'u0b'), 'mistakes', 5)$$, '42501', null, 'a user cannot insert a run as another user');

select lives_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 1, 'gap', 'Articles', 'I saw ___ owl.', null, '["an"]'::jsonb, 'Vowel sound.')$$, 'a user inserts an item into their own run');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 1, 'gap', 'Articles', 'I saw ___ owl.', null, '["an"]'::jsonb, 'Vowel sound.')$$, '23505', null, 'a duplicate position fails');
select lives_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 1, 'gap', 'Articles', 'Other.', null, '["an"]'::jsonb, 'Other.') on conflict (run_id, position) do nothing$$, 'on conflict do nothing lives as authenticated');
select results_eq($$select prompt from public.practice_items where run_id = (select id from t_ids where k = 'ra1') and position = 1$$, array['I saw ___ owl.'::text], 'on conflict do nothing keeps the first item');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 15, 'gap', 'r', 'p ___', null, '["an"]'::jsonb, 'e')$$, '23514', null, 'a position of 15 fails');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 2, 'riddle', 'r', 'p', null, '["an"]'::jsonb, 'e')$$, '23514', null, 'an unknown kind fails');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 2, 'choose', 'r', 'p ___', '["a","b"]'::jsonb, '["a"]'::jsonb, 'e')$$, '23514', null, 'a choose item with two options fails');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 2, 'choose', 'r', 'p ___', null, '["a"]'::jsonb, 'e')$$, '23514', null, 'a choose item without options fails');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 2, 'fix', 'r', 'p', '["a","b","c"]'::jsonb, '["a"]'::jsonb, 'e')$$, '23514', null, 'a fix item with options fails');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 2, 'choose', 'r', 'p ___', '["a",2,"c"]'::jsonb, '["a"]'::jsonb, 'e')$$, '23514', null, 'options that are not strings fail');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 2, 'fix', 'r', 'p', null, '[]'::jsonb, 'e')$$, '23514', null, 'no accepted answer fails');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'ra1'), 2, 'fix', 'r', 'p', null, '["a",3]'::jsonb, 'e')$$, '23514', null, 'an accepted answer that is not a string fails');
select throws_ok($$insert into public.practice_items (run_id, position, kind, rule, prompt, options, accepted, explanation) values ((select id from t_ids where k = 'rb1'), 5, 'fix', 'r', 'p', null, '["a"]'::jsonb, 'e')$$, '42501', null, 'a user cannot insert an item into another user run');

select results_eq($$update public.practice_items set user_answer = 'have been', correct = true, answered_at = now() where id = (select id from t_ids where k = 'ia1') returning correct$$, array[true], 'a user answers their own item');
select throws_ok($$update public.practice_items set prompt = 'changed' where id = (select id from t_ids where k = 'ia1')$$, '42501', null, 'a user cannot change the prompt of an item');
select throws_ok($$update public.practice_runs set focus = 'words' where id = (select id from t_ids where k = 'ra1')$$, '42501', null, 'a user cannot change the focus of a run');
select results_eq($$update public.practice_runs set target = 10 where id = (select id from t_ids where k = 'ra1') returning target$$, array[10], 'a user raises the target of their own run');
select results_eq($$update public.practice_runs set finished_at = now() where id = (select id from t_ids where k = 'ra1') returning finished_at is not null$$, array[true], 'a user finishes their own run');
select throws_ok($$delete from public.practice_runs where id = (select id from t_ids where k = 'ra1')$$, '42501', null, 'a user cannot delete a run');
select throws_ok($$delete from public.practice_items where id = (select id from t_ids where k = 'ia1')$$, '42501', null, 'a user cannot delete an item');

select results_eq($$select cost_usd from public.add_practice_cost((select id from t_ids where k = 'ra1'), 0.000145)$$, array[0.000145::numeric], 'add_practice_cost adds 0.000145 to a run at 0 and keeps the precision');
select results_eq($$select cost_usd from public.add_practice_cost((select id from t_ids where k = 'ra1'), 0.000145)$$, array[0.00029::numeric], 'two calls add up');
select is_empty($$select 1 from public.add_practice_cost((select id from t_ids where k = 'ra1'), -1)$$, 'a negative amount changes nothing');
select is_empty($$select 1 from public.add_practice_cost((select id from t_ids where k = 'rb1'), 1)$$, 'another user run returns no row');

select is_empty($$update public.practice_runs set target = 15 where id = (select id from t_ids where k = 'rb1') returning 1$$, 'an update of another user run touches no row');
select is_empty($$update public.practice_items set correct = true where id = (select id from t_ids where k = 'ib1') returning 1$$, 'an update of another user item touches no row');

reset role;
select results_eq($$select cost_usd from public.practice_runs where id = (select id from t_ids where k = 'rb1')$$, array[0::numeric], 'the other user run cost is unchanged');
select results_eq($$select count(*) from public.practice_items where run_id = (select id from t_ids where k = 'rb1')$$, array[1::bigint], 'the other user run has only its own item');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0b'), true);
select results_eq($$select count(*) from public.practice_runs where id = (select id from t_ids where k = 'ra1')$$, array[0::bigint], 'user B reads none of the runs of A');
select results_eq($$select count(*) from public.practice_items where id = (select id from t_ids where k = 'ia1')$$, array[0::bigint], 'user B reads none of the items of A');

reset role;
select lives_ok($$delete from auth.users where id = (select id from t_ids where k = 'u0a')$$, 'deleting a user with runs and items does not fail');
select is_empty($$select 1 from public.practice_runs where user_id = (select id from t_ids where k = 'u0a')$$, 'the runs of a deleted user are gone');
select is_empty($$select 1 from public.practice_items where id = (select id from t_ids where k = 'ia1')$$, 'the items of a deleted user are gone');

select * from finish();
rollback;
