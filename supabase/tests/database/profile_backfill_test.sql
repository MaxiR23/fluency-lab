-- supabase/tests/database/profile_backfill_test.sql
--
-- Tests for the profiles of users created before the profiles table.
--
-- Tested:
-- - the display name is read from full_name and then from name
-- - the backfill creates a missing profile and fills a null name
-- - the backfill never overwrites a name already set
-- - ensure_profile creates the caller's own missing row, once
-- - who can execute ensure_profile and backfill_profiles
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106023843_fill_missing_profiles.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('f01', gen_random_uuid()),
  ('f02', gen_random_uuid()),
  ('f03', gen_random_uuid()),
  ('f04', gen_random_uuid());
grant select on t_ids to authenticated;

select is(public.display_name_from_metadata('{"name": "Grace Hopper"}'), 'Grace Hopper', 'the name key is read');
select is(public.display_name_from_metadata('{"full_name": "Ada", "name": "Other"}'), 'Ada', 'full_name wins over name');
select is(public.display_name_from_metadata('{"name": "  "}'), null, 'a blank name gives null');

insert into auth.users (id, email, raw_user_meta_data) values
  ((select id from t_ids where k = 'f01'), 'old@test.com', '{"name": "Grace Hopper"}'),
  ((select id from t_ids where k = 'f02'), 'nullname@test.com', '{"full_name": "Grace Hopper"}'),
  ((select id from t_ids where k = 'f03'), 'named@test.com', '{"full_name": "Ada Lovelace"}'),
  ((select id from t_ids where k = 'f04'), 'second@test.com', '{"full_name": "Alan Turing"}');

delete from public.profiles where id in (select id from t_ids where k in ('f01', 'f04'));
update public.profiles set display_name = null where id = (select id from t_ids where k = 'f02');
update auth.users set raw_user_meta_data = '{"full_name": "Someone Else"}' where id = (select id from t_ids where k = 'f03');

select public.backfill_profiles();

select results_eq($$select display_name from public.profiles where id = (select id from t_ids where k = 'f01')$$, array['Grace Hopper'], 'the backfill creates the missing profile with the name');
select results_eq($$select display_name from public.profiles where id = (select id from t_ids where k = 'f02')$$, array['Grace Hopper'], 'the backfill fills a null display name');
select results_eq($$select display_name from public.profiles where id = (select id from t_ids where k = 'f03')$$, array['Ada Lovelace'], 'the backfill does not overwrite a name already set');

delete from public.profiles where id = (select id from t_ids where k = 'f04');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'f04'), true);

select results_eq($$select display_name from public.ensure_profile()$$, array['Alan Turing'], 'ensure_profile creates the missing row and returns the name');
select results_eq($$select count(*) from public.profiles where id = (select id from t_ids where k = 'f04')$$, array[1::bigint], 'ensure_profile created exactly one row');
select lives_ok($$select * from public.ensure_profile()$$, 'a second ensure_profile call succeeds');
select results_eq($$select count(*) from public.profiles where id = (select id from t_ids where k = 'f04')$$, array[1::bigint], 'a second call still leaves one row');

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'f03'), true);
select results_eq($$select display_name from public.ensure_profile()$$, array['Ada Lovelace'], 'ensure_profile returns an existing row unchanged');

reset role;
set local role anon;
select throws_ok($$select * from public.ensure_profile()$$, '42501', null, 'anon cannot execute ensure_profile');

reset role;
select ok(not has_function_privilege('authenticated', 'public.backfill_profiles()', 'execute'), 'authenticated cannot execute backfill_profiles');

select * from finish();
rollback;
