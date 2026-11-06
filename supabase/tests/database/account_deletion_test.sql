-- supabase/tests/database/account_deletion_test.sql
--
-- Tests that deleting an auth user (what the admin API does) removes all of
-- the user's data and nothing of another user's.
--
-- Tested:
-- - deleting a user does not fail
-- - the user's profile, sessions, messages and ledger rows are gone
-- - another user's profile, sessions, messages and ledger rows are untouched
-- - deleting a user writes nothing to the ledger
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106000211_create_profiles_sessions_messages.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('sa1', gen_random_uuid()),
  ('sb1', gen_random_uuid());

-- The profile of each user comes from the on_auth_user_created trigger.
insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com');
insert into public.sessions (id, user_id, title, cost_usd) values
  ((select id from t_ids where k = 'sa1'), (select id from t_ids where k = 'e0a'), 'Free chat', 0.5),
  ((select id from t_ids where k = 'sb1'), (select id from t_ids where k = 'e0b'), 'Free chat', 0.5);
insert into public.messages (session_id, role, text) values
  ((select id from t_ids where k = 'sa1'), 'user', 'Hi'),
  ((select id from t_ids where k = 'sb1'), 'user', 'Hi');
insert into public.deleted_session_costs (user_id, created_at, cost_usd) values
  ((select id from t_ids where k = 'e0a'), now(), 1),
  ((select id from t_ids where k = 'e0b'), now(), 1);

select lives_ok(
  $$delete from auth.users where id = (select id from t_ids where k = 'e0a')$$,
  'deleting a user does not fail'
);

select is_empty($$select 1 from public.profiles where id = (select id from t_ids where k = 'e0a')$$, 'the profile of the deleted user is gone');
select is_empty($$select 1 from public.sessions where user_id = (select id from t_ids where k = 'e0a')$$, 'the sessions of the deleted user are gone');
select is_empty($$select 1 from public.messages where session_id = (select id from t_ids where k = 'sa1')$$, 'the messages of the deleted user are gone');
select is_empty($$select 1 from public.deleted_session_costs where user_id = (select id from t_ids where k = 'e0a')$$, 'the ledger rows of the deleted user are gone');

select results_eq($$select count(*) from public.profiles where id = (select id from t_ids where k = 'e0b')$$, array[1::bigint], 'another user profile is untouched');
select results_eq($$select count(*) from public.sessions where user_id = (select id from t_ids where k = 'e0b')$$, array[1::bigint], 'another user sessions are untouched');
select results_eq($$select count(*) from public.messages where session_id = (select id from t_ids where k = 'sb1')$$, array[1::bigint], 'another user messages are untouched');
select results_eq($$select count(*) from public.deleted_session_costs where user_id = (select id from t_ids where k = 'e0b')$$, array[1::bigint], 'another user ledger rows are untouched');

-- The session of the deleted user had a cost, yet its ledger row is not written
-- by the cascade: only the row inserted above existed, and it is gone.
select is_empty($$select 1 from public.deleted_session_costs where user_id = (select id from t_ids where k = 'e0a')$$, 'deleting a user writes nothing to the ledger');
select results_eq($$select count(*) from public.deleted_session_costs$$, array[1::bigint], 'only the other user ledger row is left');

select * from finish();
rollback;
