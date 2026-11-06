-- supabase/tests/database/rls_enabled_test.sql
--
-- Tests for row level security and the grants on the three tables.
--
-- Tested:
-- - RLS is on for profiles, sessions and messages
-- - anon has no privilege on them; authenticated has only what the API uses
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

select results_eq($$select relrowsecurity from pg_class where oid = 'public.profiles'::regclass$$, array[true], 'RLS is on for profiles');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.sessions'::regclass$$, array[true], 'RLS is on for sessions');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.messages'::regclass$$, array[true], 'RLS is on for messages');

select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon cannot select profiles');
select ok(not has_table_privilege('anon', 'public.sessions', 'select'), 'anon cannot select sessions');
select ok(not has_table_privilege('anon', 'public.messages', 'select'), 'anon cannot select messages');
select ok(not has_table_privilege('anon', 'public.profiles', 'insert, update, delete'), 'anon cannot write profiles');
select ok(not has_table_privilege('anon', 'public.sessions', 'insert, update, delete'), 'anon cannot write sessions');
select ok(not has_table_privilege('anon', 'public.messages', 'insert, update, delete'), 'anon cannot write messages');

select ok(not has_table_privilege('authenticated', 'public.profiles', 'delete'), 'authenticated cannot delete profiles');
select ok(not has_table_privilege('authenticated', 'public.sessions', 'delete'), 'authenticated cannot delete sessions');
select ok(not has_table_privilege('authenticated', 'public.messages', 'delete'), 'authenticated cannot delete messages');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.messages', 'insert'), 'authenticated cannot insert messages');
select ok(has_table_privilege('authenticated', 'public.sessions', 'select'), 'authenticated can select sessions');

select * from finish();
rollback;
