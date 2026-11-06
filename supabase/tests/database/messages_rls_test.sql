-- supabase/tests/database/messages_rls_test.sql
--
-- Tests for the row level security of messages.
--
-- Tested:
-- - a user reads only the messages of their own sessions
-- - a user inserts into their own sessions only; no update or delete
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql
--      supabase/migrations/20261106035530_chat_writes.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('ea1', gen_random_uuid()),
  ('eb1', gen_random_uuid()),
  ('ec1', gen_random_uuid()),
  ('ed1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ((select id from t_ids where k = 'ea1'), (select id from t_ids where k = 'e0a'), 'Free chat'),
  ((select id from t_ids where k = 'eb1'), (select id from t_ids where k = 'e0b'), 'Free chat');
insert into public.messages (id, session_id, role, text) values
  ((select id from t_ids where k = 'ec1'), (select id from t_ids where k = 'ea1'), 'user', 'Hello'),
  ((select id from t_ids where k = 'ed1'), (select id from t_ids where k = 'eb1'), 'user', 'Hi');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0a'), true);

select results_eq($$select text from public.messages where session_id = (select id from t_ids where k = 'ea1')$$, array['Hello'], 'a user reads the messages of their own session');
select is_empty($$select 1 from public.messages where session_id = (select id from t_ids where k = 'eb1')$$, 'the messages of another user session are empty');
select throws_ok($$insert into public.messages (session_id, role, text) values ((select id from t_ids where k = 'eb1'), 'user', 'x')$$, '42501', null, 'inserting into another user session is not allowed');
select lives_ok($$insert into public.messages (session_id, role, text) values ((select id from t_ids where k = 'ea1'), 'user', 'x')$$, 'a user inserts a message into their own session');
select throws_ok($$update public.messages set text = 'x' where id = (select id from t_ids where k = 'ed1')$$, '42501', null, 'updating a message is not allowed');
select throws_ok($$delete from public.messages where id = (select id from t_ids where k = 'ed1')$$, '42501', null, 'deleting a message is not allowed');

select * from finish();
rollback;
