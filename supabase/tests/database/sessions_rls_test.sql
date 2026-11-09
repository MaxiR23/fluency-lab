-- supabase/tests/database/sessions_rls_test.sql
--
-- Tests for the row level security of sessions.
--
-- Tested:
-- - a user sees only their own sessions
-- - a session can only be created for the caller, with a limited set of columns
-- - a user ends their own session; no column outside status, cost, context and title can be updated
-- - a user deletes their own session and its messages; another user's session is untouched
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql
--      supabase/migrations/20261106035530_chat_writes.sql
--      supabase/migrations/20261106063500_session_delete.sql
--      supabase/migrations/20261108050000_session_titles.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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

select results_eq($$select count(*) from public.sessions$$, array[1::bigint], 'a user sees only their own sessions');
select is_empty($$select 1 from public.sessions where id = (select id from t_ids where k = 'eb1')$$, 'another user session by id is empty');
select throws_ok($$insert into public.sessions (user_id, title) values ((select id from t_ids where k = 'e0b'), 'Free chat')$$, '42501', null, 'creating a session for another user is not allowed');
select results_eq($$insert into public.sessions (user_id, title) values ((select id from t_ids where k = 'e0a'), 'Food') returning status, cost_usd$$, $$values ('active'::text, 0::numeric)$$, 'a new session is active and costs 0');
select throws_ok($$insert into public.sessions (user_id, title, status) values ((select id from t_ids where k = 'e0a'), 'Food', 'ended')$$, '42501', null, 'setting the status on insert is not allowed');
select throws_ok($$update public.sessions set topic_id = 'food' where id = (select id from t_ids where k = 'ea1')$$, '42501', null, 'updating their own session is not allowed');
select throws_ok($$update public.sessions set topic_id = 'food' where id = (select id from t_ids where k = 'eb1')$$, '42501', null, 'updating another user session is not allowed');
select results_eq($$update public.sessions set status = 'ended' where id = (select id from t_ids where k = 'ea1') returning status$$, array['ended'::text], 'a user ends their own session');
select is_empty($$update public.sessions set status = 'ended' where id = (select id from t_ids where k = 'eb1') returning 1$$, 'ending another user session changes no row');
select is_empty($$delete from public.sessions where id = (select id from t_ids where k = 'eb1') returning 1$$, 'deleting another user session deletes no row');
select results_eq($$delete from public.sessions where id = (select id from t_ids where k = 'ea1') returning id$$, $$select id from t_ids where k = 'ea1'$$, 'a user deletes their own session');

reset role;
select is_empty($$select 1 from public.messages where session_id = (select id from t_ids where k = 'ea1')$$, 'the deleted session messages are gone');
select results_eq($$select count(*) from public.messages where session_id = (select id from t_ids where k = 'eb1')$$, array[1::bigint], 'the other user session keeps its messages');

select * from finish();
rollback;
