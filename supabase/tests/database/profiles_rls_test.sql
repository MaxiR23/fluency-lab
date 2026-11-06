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

insert into auth.users (id, email) values
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a', 'a@test.com'),
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b', 'b@test.com');

set local role authenticated;
set local request.jwt.claim.sub = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a';

select results_eq($$select count(*) from public.profiles$$, array[1::bigint], 'a user sees only their own profile');
select is_empty($$select 1 from public.profiles where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b'$$, 'reading another profile by id is empty');
select is_empty($$update public.profiles set level = 'advanced' where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b' returning 1$$, 'updating another profile changes no row');
select results_eq($$update public.profiles set level = 'advanced' where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a' returning level$$, array['advanced'], 'updating their own level returns it');
select throws_ok($$update public.profiles set id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0c' where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a'$$, '42501', null, 'changing their own id is not allowed');
select throws_ok($$insert into public.profiles (id) values ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0c')$$, '42501', null, 'inserting a profile is not allowed');
select throws_ok($$delete from public.profiles where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b'$$, '42501', null, 'deleting a profile is not allowed');

reset role;
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot select profiles');

select * from finish();
rollback;
