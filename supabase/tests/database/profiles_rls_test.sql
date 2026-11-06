-- supabase/tests/database/profiles_rls_test.sql
--
-- Tests for the row level security of profiles.
--
-- Tested:
-- - a user sees and updates only their own profile
-- - no insert, no delete, no change of id
-- - anon cannot read
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('e0c', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0a'), true);

select results_eq($$select count(*) from public.profiles$$, array[1::bigint], 'a user sees only their own profile');
select is_empty($$select 1 from public.profiles where id = (select id from t_ids where k = 'e0b')$$, 'reading another profile by id is empty');
select is_empty($$update public.profiles set level = 'advanced' where id = (select id from t_ids where k = 'e0b') returning 1$$, 'updating another profile changes no row');
select results_eq($$update public.profiles set level = 'advanced' where id = (select id from t_ids where k = 'e0a') returning level$$, array['advanced'], 'updating their own level returns it');
select throws_ok($$update public.profiles set id = (select id from t_ids where k = 'e0c') where id = (select id from t_ids where k = 'e0a')$$, '42501', null, 'changing their own id is not allowed');
select throws_ok($$insert into public.profiles (id) values ((select id from t_ids where k = 'e0c'))$$, '42501', null, 'inserting a profile is not allowed');
select throws_ok($$delete from public.profiles where id = (select id from t_ids where k = 'e0b')$$, '42501', null, 'deleting a profile is not allowed');

reset role;
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot select profiles');

select * from finish();
rollback;
