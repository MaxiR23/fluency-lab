-- supabase/tests/database/chat_writes_test.sql
--
-- Tests for the writes the chat needs: add_session_cost and message inserts.
--
-- Tested:
-- - add_session_cost adds the exact amount, with 8 decimals of precision
-- - add_session_cost ignores a negative amount and another user session, and leaves
--   the other session cost unchanged
-- - add_session_cost is security invoker
-- - a message stores its corrections and new words as json
-- - a user cannot insert a message into another user session
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106035530_chat_writes.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('ea1', gen_random_uuid()),
  ('eb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ((select id from t_ids where k = 'ea1'), (select id from t_ids where k = 'e0a'), 'Free chat'),
  ((select id from t_ids where k = 'eb1'), (select id from t_ids where k = 'e0b'), 'Free chat');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0a'), true);

select results_eq($$select cost_usd from public.add_session_cost((select id from t_ids where k = 'ea1'), 0.000145)$$, array[0.000145::numeric], 'add_session_cost adds 0.000145 to a session at 0 and keeps the precision');
select results_eq($$select cost_usd from public.add_session_cost((select id from t_ids where k = 'ea1'), 0.000145)$$, array[0.00029::numeric], 'two calls add up');
select is_empty($$select 1 from public.add_session_cost((select id from t_ids where k = 'ea1'), -1)$$, 'a negative amount changes nothing');
select is_empty($$select 1 from public.add_session_cost((select id from t_ids where k = 'eb1'), 1)$$, 'another user session returns no row');
select results_eq($$select cost_usd from public.sessions where id = (select id from t_ids where k = 'ea1')$$, array[0.00029::numeric], 'the cost is the sum of the valid calls');
select results_eq($$insert into public.messages (session_id, role, text, corrections, new_words) values ((select id from t_ids where k = 'ea1'), 'user', 'I never been', '{"items":[{"original":"I never been","corrected":"I have never been"}],"explanation":"Use the present perfect."}'::jsonb, '["definitely"]'::jsonb) returning corrections->'items'->0->>'corrected', new_words->>0$$, $$values ('I have never been'::text, 'definitely'::text)$$, 'a message stores corrections and new words');
select throws_ok($$insert into public.messages (session_id, role, text) values ((select id from t_ids where k = 'eb1'), 'user', 'x')$$, '42501', null, 'a user cannot insert a message into another user session');

reset role;
select results_eq($$select cost_usd from public.sessions where id = (select id from t_ids where k = 'eb1')$$, array[0::numeric], 'the other user session cost is unchanged');
select is((select prosecdef from pg_proc where oid = 'public.add_session_cost(uuid,numeric)'::regprocedure), false, 'add_session_cost is security invoker');

select * from finish();
rollback;
