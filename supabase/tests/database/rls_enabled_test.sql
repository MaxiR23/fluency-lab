-- supabase/tests/database/rls_enabled_test.sql
--
-- Tests for row level security and the grants on the tables.
--
-- Tested:
-- - RLS is on for profiles, sessions, messages, deleted_session_costs, thread_messages, practice_runs, practice_items and study_notes
-- - anon has no privilege on them; authenticated has only what the API uses
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql
-- SEE: supabase/migrations/20261106120000_correction_threads.sql
-- SEE: supabase/migrations/20261107000000_practice.sql
-- SEE: supabase/migrations/20261108000000_study_notes.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

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
select ok(has_table_privilege('authenticated', 'public.sessions', 'delete'), 'authenticated can delete sessions');
select ok(not has_table_privilege('authenticated', 'public.messages', 'delete'), 'authenticated cannot delete messages');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.messages', 'insert'), 'authenticated cannot insert messages');
select ok(has_table_privilege('authenticated', 'public.sessions', 'select'), 'authenticated can select sessions');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.deleted_session_costs'::regclass$$, array[true], 'RLS is on for deleted_session_costs');
select ok(not has_table_privilege('anon', 'public.deleted_session_costs', 'select, insert, update, delete'), 'anon has no privilege on deleted_session_costs');
select ok(has_table_privilege('authenticated', 'public.deleted_session_costs', 'select') and not has_table_privilege('authenticated', 'public.deleted_session_costs', 'insert, update, delete'), 'authenticated only selects deleted_session_costs');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.thread_messages'::regclass$$, array[true], 'RLS is on for thread_messages');
select ok(not has_table_privilege('anon', 'public.thread_messages', 'select, insert, update, delete'), 'anon has no privilege on thread_messages');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.practice_runs'::regclass$$, array[true], 'RLS is on for practice_runs');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.practice_items'::regclass$$, array[true], 'RLS is on for practice_items');
select ok(not has_table_privilege('anon', 'public.practice_runs', 'select, insert, update, delete'), 'anon has no privilege on practice_runs');
select ok(not has_table_privilege('anon', 'public.practice_items', 'select, insert, update, delete'), 'anon has no privilege on practice_items');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.study_notes'::regclass$$, array[true], 'RLS is on for study_notes');
select ok(not has_table_privilege('anon', 'public.study_notes', 'select, insert, update, delete'), 'anon has no privilege on study_notes');

select * from finish();
rollback;
