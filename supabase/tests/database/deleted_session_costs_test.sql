-- supabase/tests/database/deleted_session_costs_test.sql
--
-- Tests for the ledger that keeps a deleted session cost in the month's spend.
--
-- Tested:
-- - deleting a session with a cost adds its cost and start time to the ledger
-- - deleting a session with no cost adds nothing
-- - a user reads only their own ledger rows
-- - a user cannot insert, update or delete ledger rows
-- - deleting a user with a ledger does not fail
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106080000_deleted_session_costs.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('ea1', gen_random_uuid()),
  ('ea2', gen_random_uuid()),
  ('eb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com');
insert into public.sessions (id, user_id, title, cost_usd, created_at) values
  ((select id from t_ids where k = 'ea1'), (select id from t_ids where k = 'e0a'), 'Free chat', 0.000145, '2026-11-02T10:00:00+00'),
  ((select id from t_ids where k = 'ea2'), (select id from t_ids where k = 'e0a'), 'Free chat', 0, '2026-11-03T10:00:00+00'),
  ((select id from t_ids where k = 'eb1'), (select id from t_ids where k = 'e0b'), 'Free chat', 0.5, '2026-11-02T10:00:00+00');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0a'), true);

select is_empty($$select 1 from public.deleted_session_costs$$, 'the ledger starts empty');
select lives_ok($$delete from public.sessions where id = (select id from t_ids where k = 'ea1')$$, 'a user deletes a session with a cost');
select results_eq($$select cost_usd, created_at from public.deleted_session_costs$$, $$values (0.000145::numeric, '2026-11-02T10:00:00+00'::timestamptz)$$, 'the ledger has the cost and the start of the deleted session');
select lives_ok($$delete from public.sessions where id = (select id from t_ids where k = 'ea2')$$, 'a user deletes a session with no cost');
select results_eq($$select count(*) from public.deleted_session_costs$$, array[1::bigint], 'a zero cost adds nothing');
select throws_ok($$insert into public.deleted_session_costs (user_id, created_at, cost_usd) values ((select id from t_ids where k = 'e0a'), now(), 1)$$, '42501', null, 'a user cannot insert into the ledger');
select throws_ok($$update public.deleted_session_costs set cost_usd = 0.00000001$$, '42501', null, 'a user cannot update the ledger');
select throws_ok($$delete from public.deleted_session_costs$$, '42501', null, 'a user cannot delete from the ledger');

reset role;
insert into public.deleted_session_costs (user_id, created_at, cost_usd) values
  ((select id from t_ids where k = 'e0b'), now(), 2);
set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0a'), true);
select results_eq($$select count(*) from public.deleted_session_costs$$, array[1::bigint], 'a user does not read another user ledger rows');

reset role;
select lives_ok($$delete from auth.users where id = (select id from t_ids where k = 'e0b')$$, 'deleting a user with sessions and a ledger does not fail');
select is_empty($$select 1 from public.deleted_session_costs where user_id = (select id from t_ids where k = 'e0b')$$, 'the ledger of a deleted user is gone');

select * from finish();
rollback;
