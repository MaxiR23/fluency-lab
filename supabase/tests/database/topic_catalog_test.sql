-- supabase/tests/database/topic_catalog_test.sql
--
-- Tests that the topic ids are no longer checked by the database: they live only in packages/shared.
--
-- Tested:
-- - sessions_topic_id_check and practice_runs_topic_id_check are gone
-- - practice_runs keeps its focus, note, target, cost and focus/topic checks
-- - a session and a topic run store a topic id outside the catalog
-- - a topic run without a topic and a mistakes run with a topic still fail
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261108030000_topic_catalog_checks.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values ('u0', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'u0'), 'a@test.com');

select is((select count(*)::int from pg_constraint where conrelid = 'public.sessions'::regclass and conname = 'sessions_topic_id_check'), 0, 'sessions has no topic_id check');
select is((select count(*)::int from pg_constraint where conrelid = 'public.practice_runs'::regclass and conname = 'practice_runs_topic_id_check'), 0, 'practice_runs has no topic_id check');
select is((select string_agg(conname::text, ',' order by conname) from pg_constraint where conrelid = 'public.practice_runs'::regclass and contype = 'c'), 'practice_runs_check,practice_runs_cost_usd_check,practice_runs_focus_check,practice_runs_note_check,practice_runs_target_check', 'practice_runs keeps its other checks');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0'), true);
select results_eq($$insert into public.sessions (user_id, topic_id, title) values ((select id from t_ids where k = 'u0'), 'cooking', 'Cooking') returning topic_id$$, array['cooking'::text], 'a session stores a topic outside the catalog');
select results_eq($$insert into public.practice_runs (focus, topic_id, target) values ('topic', 'subjunctive', 5) returning topic_id$$, array['subjunctive'::text], 'a topic run stores a topic outside the catalog');
select throws_ok($$insert into public.practice_runs (focus, target) values ('topic', 5)$$, '23514', null, 'a topic run without a topic still fails');
select throws_ok($$insert into public.practice_runs (focus, topic_id, target) values ('mistakes', 'subjunctive', 5)$$, '23514', null, 'a mistakes run with a topic still fails');

select * from finish();
rollback;
