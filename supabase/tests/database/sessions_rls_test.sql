-- supabase/tests/database/sessions_rls_test.sql
--
-- Tests for the row level security of sessions.
--
-- Tested:
-- - a user sees only their own sessions
-- - a session can only be created for the caller, with a limited set of columns
-- - no update
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a', 'a@test.com'),
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b', 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1', '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a', 'Free chat'),
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1', '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b', 'Free chat');

set local role authenticated;
set local request.jwt.claim.sub = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a';

select results_eq($$select count(*) from public.sessions$$, array[1::bigint], 'a user sees only their own sessions');
select is_empty($$select 1 from public.sessions where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1'$$, 'another user session by id is empty');
select throws_ok($$insert into public.sessions (user_id, title) values ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b', 'Free chat')$$, '42501', null, 'creating a session for another user is not allowed');
select results_eq($$insert into public.sessions (user_id, title) values ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a', 'Food') returning status, cost_usd$$, $$values ('active'::text, 0::numeric)$$, 'a new session is active and costs 0');
select throws_ok($$insert into public.sessions (user_id, title, status) values ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a', 'Food', 'ended')$$, '42501', null, 'setting the status on insert is not allowed');
select throws_ok($$update public.sessions set title = 'x' where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1'$$, '42501', null, 'updating their own session is not allowed');
select throws_ok($$update public.sessions set title = 'x' where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1'$$, '42501', null, 'updating another user session is not allowed');

select * from finish();
rollback;
