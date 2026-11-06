-- supabase/tests/database/messages_rls_test.sql
--
-- Tests for the row level security of messages.
--
-- Tested:
-- - a user reads only the messages of their own sessions
-- - no insert, update or delete
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a', 'a@test.com'),
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b', 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1', '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a', 'Free chat'),
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1', '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0b', 'Free chat');
insert into public.messages (id, session_id, role, text) values
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ec1', '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1', 'user', 'Hello'),
  ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ed1', '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1', 'user', 'Hi');

set local role authenticated;
set local request.jwt.claim.sub = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5e0a';

select results_eq($$select text from public.messages where session_id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1'$$, array['Hello'], 'a user reads the messages of their own session');
select is_empty($$select 1 from public.messages where session_id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1'$$, 'the messages of another user session are empty');
select throws_ok($$insert into public.messages (session_id, role, text) values ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5eb1', 'user', 'x')$$, '42501', null, 'inserting into another user session is not allowed');
select throws_ok($$insert into public.messages (session_id, role, text) values ('6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ea1', 'user', 'x')$$, '42501', null, 'inserting into their own session is not allowed');
select throws_ok($$update public.messages set text = 'x' where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ed1'$$, '42501', null, 'updating a message is not allowed');
select throws_ok($$delete from public.messages where id = '6f1c2a4e-8d3b-4c5a-9e7f-1a2b3c4d5ed1'$$, '42501', null, 'deleting a message is not allowed');

select * from finish();
rollback;
