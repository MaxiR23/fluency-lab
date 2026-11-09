-- supabase/tests/database/session_context_test.sql
--
-- Tests for the chat's summary of its older turns: the context_summary and context_through_id columns.
--
-- Tested:
-- - sessions has both columns and a composite foreign key to a message of the same session
-- - authenticated updates only the context columns and inserts neither
-- - the owner sets the summary and the message it covers
-- - another user cannot set the context of a session
-- - a message of another session or another user is rejected
-- - the summary is 1 to 2000 characters and both columns can be cleared
-- - deleting the covered message clears the point and keeps the summary
-- - a session with a context can be deleted
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261108020000_session_context.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('c0a', gen_random_uuid()),
  ('c0b', gen_random_uuid()),
  ('ca1', gen_random_uuid()),
  ('ca2', gen_random_uuid()),
  ('cb1', gen_random_uuid()),
  ('cta1', gen_random_uuid()),
  ('cta2', gen_random_uuid()),
  ('ctb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'c0a'), 'a@test.com'),
  ((select id from t_ids where k = 'c0b'), 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ((select id from t_ids where k = 'ca1'), (select id from t_ids where k = 'c0a'), 'Free chat'),
  ((select id from t_ids where k = 'ca2'), (select id from t_ids where k = 'c0a'), 'Free chat'),
  ((select id from t_ids where k = 'cb1'), (select id from t_ids where k = 'c0b'), 'Free chat');
insert into public.messages (id, session_id, role, text) values
  ((select id from t_ids where k = 'cta1'), (select id from t_ids where k = 'ca1'), 'tutor', 'Hello'),
  ((select id from t_ids where k = 'cta2'), (select id from t_ids where k = 'ca2'), 'tutor', 'Hello'),
  ((select id from t_ids where k = 'ctb1'), (select id from t_ids where k = 'cb1'), 'tutor', 'Hello');

select has_column('public', 'sessions', 'context_summary', 'sessions has context_summary');
select has_column('public', 'sessions', 'context_through_id', 'sessions has context_through_id');
select fk_ok('public', 'sessions', array['context_through_id', 'id']::name[], 'public', 'messages', array['id', 'session_id']::name[], 'context_through_id and id reference a message of the same session');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'c0a'), true);

select ok(
  has_column_privilege('authenticated', 'public.sessions', 'context_summary', 'UPDATE')
  and has_column_privilege('authenticated', 'public.sessions', 'context_through_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.sessions', 'context_summary', 'INSERT')
  and not has_column_privilege('authenticated', 'public.sessions', 'context_through_id', 'INSERT'),
  'authenticated updates only the context columns, and inserts neither'
);
select throws_ok($$update public.sessions set topic_id = 'food' where id = (select id from t_ids where k = 'ca1')$$, '42501', null, 'no other column of sessions becomes updatable');
select results_eq(
  $$update public.sessions set context_summary = 'The learner lives in Lisbon.', context_through_id = (select id from t_ids where k = 'cta1') where id = (select id from t_ids where k = 'ca1') returning context_summary, context_through_id$$,
  $$select 'The learner lives in Lisbon.'::text, id from t_ids where k = 'cta1'$$,
  'the owner sets the summary and the message it covers'
);
select is_empty($$update public.sessions set context_summary = 'x' where id = (select id from t_ids where k = 'cb1') returning id$$, 'another user cannot set the context of a session');
select throws_ok($$update public.sessions set context_through_id = (select id from t_ids where k = 'cta2') where id = (select id from t_ids where k = 'ca1')$$, '23503', null, 'a message from another session of the same user is rejected');
select throws_ok($$update public.sessions set context_through_id = (select id from t_ids where k = 'ctb1') where id = (select id from t_ids where k = 'ca1')$$, '23503', null, 'a message from another user session is rejected');
select throws_ok($$update public.sessions set context_summary = '' where id = (select id from t_ids where k = 'ca1')$$, '23514', null, 'an empty summary is rejected');
select throws_ok($$update public.sessions set context_summary = repeat('a', 2001) where id = (select id from t_ids where k = 'ca1')$$, '23514', null, 'a summary over 2000 characters is rejected');
select lives_ok($$update public.sessions set context_summary = repeat('a', 2000) where id = (select id from t_ids where k = 'ca1')$$, 'a summary of exactly 2000 characters is stored');
select lives_ok($$update public.sessions set context_summary = null, context_through_id = null where id = (select id from t_ids where k = 'ca1')$$, 'both columns can be cleared');

reset role;
select is((select context_summary from public.sessions where id = (select id from t_ids where k = 'cb1')), null, 'the other user session keeps no summary');

update public.sessions
set context_summary = 'The learner lives in Lisbon.', context_through_id = (select id from t_ids where k = 'cta1')
where id = (select id from t_ids where k = 'ca1');
delete from public.messages where id = (select id from t_ids where k = 'cta1');
select ok(
  exists (
    select 1 from public.sessions
    where id = (select id from t_ids where k = 'ca1') and context_summary is not null and context_through_id is null
  ),
  'deleting the covered message clears the point and keeps the summary and the session'
);

update public.sessions
set context_summary = 'Summary.', context_through_id = (select id from t_ids where k = 'cta2')
where id = (select id from t_ids where k = 'ca2');
delete from public.sessions where id = (select id from t_ids where k = 'ca2');
select is((select count(*) from public.sessions where id = (select id from t_ids where k = 'ca2')), 0::bigint, 'a session with a context can still be deleted');
select is((select count(*) from public.messages where session_id = (select id from t_ids where k = 'ca2')), 0::bigint, 'its messages are deleted with it');

select * from finish();
rollback;
