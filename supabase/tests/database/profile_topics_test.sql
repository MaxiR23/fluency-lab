-- supabase/tests/database/profile_topics_test.sql
--
-- Tests that the profile topics are no longer checked by the database: they live only in packages/shared.
--
-- Tested:
-- - profiles_topics_check is gone
-- - profiles keeps its goals, level, monthly limit and provider checks
-- - a profile stores a topic outside the catalog, and topics stays not null
-- - a goal outside its list still fails
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261108040000_profile_topics_check.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values ('u0', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'u0'), 'a@test.com');

select is((select count(*)::int from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_topics_check'), 0, 'profiles has no topics check');
select is((select string_agg(conname::text, ',' order by conname) from pg_constraint where conrelid = 'public.profiles'::regclass and contype = 'c'), 'profiles_goals_check,profiles_level_check,profiles_monthly_limit_usd_check,profiles_provider_check', 'profiles keeps its other checks');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0'), true);
select results_eq($$update public.profiles set topics = array['cooking', 'food'] where id = (select id from t_ids where k = 'u0') returning topics$$, $$select array['cooking', 'food']::text[]$$, 'a profile stores a topic outside the catalog');
select throws_ok($$update public.profiles set topics = null where id = (select id from t_ids where k = 'u0')$$, '23502', null, 'topics stays not null');
select throws_ok($$update public.profiles set goals = array['cooking'] where id = (select id from t_ids where k = 'u0')$$, '23514', null, 'a goal outside its list still fails');

select * from finish();
rollback;
