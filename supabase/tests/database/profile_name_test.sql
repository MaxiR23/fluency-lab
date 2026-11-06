-- supabase/tests/database/profile_name_test.sql
--
-- Tests for the profile created for each new user.
--
-- Tested:
-- - the display name comes from full_name at sign-up
-- - an Apple name saved after sign-up fills a null display name
-- - a name already set is never overwritten
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

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e01', gen_random_uuid()),
  ('e02', gen_random_uuid()),
  ('e03', gen_random_uuid()),
  ('e04', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ((select id from t_ids where k = 'e01'), 'named@test.com', '{"full_name": "Ada Lovelace"}'),
  ((select id from t_ids where k = 'e02'), 'plain@test.com', '{}'),
  ((select id from t_ids where k = 'e03'), 'blank@test.com', '{"full_name": "   "}'),
  ((select id from t_ids where k = 'e04'), 'apple@test.com', '{}');

select results_eq($$select display_name from public.profiles where id = (select id from t_ids where k = 'e01')$$, array['Ada Lovelace'], 'an email user with a full_name gets that display name');
select results_eq($$select display_name is null from public.profiles where id = (select id from t_ids where k = 'e02')$$, array[true], 'a user with no name gets null');
select results_eq($$select display_name is null from public.profiles where id = (select id from t_ids where k = 'e03')$$, array[true], 'a blank full_name gets null');

update auth.users
  set raw_user_meta_data = '{"full_name": "Grace Hopper", "given_name": "Grace", "family_name": "Hopper"}'
  where id = (select id from t_ids where k = 'e04');
select results_eq($$select display_name from public.profiles where id = (select id from t_ids where k = 'e04')$$, array['Grace Hopper'], 'an Apple user whose name is saved after sign-up gets it');

update auth.users
  set raw_user_meta_data = '{"full_name": "Someone Else"}'
  where id = (select id from t_ids where k = 'e01');
select results_eq($$select display_name from public.profiles where id = (select id from t_ids where k = 'e01')$$, array['Ada Lovelace'], 'a later metadata change does not overwrite a display name already set');

select results_eq($$select count(*) from public.profiles where id in (select id from auth.users where email like '%@test.com')$$, array[4::bigint], 'every new user gets exactly one profile row');

select * from finish();
rollback;
