-- supabase/tests/database/session_title_test.sql
--
-- Tests for automatic titles and renaming: sessions.title_source and set_session_title.
--
-- Tested:
-- - title_source exists, is not null, defaults to default and only holds default, auto or user
-- - set_session_title is security invoker, has a fixed search_path and only authenticated runs it
-- - authenticated updates title and title_source, inserts neither source, and no other column
-- - an auto title is written only over a default title; a user title always wins
-- - a skipped auto title returns the row unchanged
-- - the title is trimmed and must be 1 to 60 characters
-- - the source must be auto or user
-- - another user's session returns no row and stays unchanged
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261108050000_session_titles.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('t0a', gen_random_uuid()),
  ('t0b', gen_random_uuid()),
  ('ta1', gen_random_uuid()),
  ('ta2', gen_random_uuid()),
  ('ta3', gen_random_uuid()),
  ('tb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 't0a'), 'a@test.com'),
  ((select id from t_ids where k = 't0b'), 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ((select id from t_ids where k = 'ta1'), (select id from t_ids where k = 't0a'), 'Free chat'),
  ((select id from t_ids where k = 'ta2'), (select id from t_ids where k = 't0a'), 'Free chat'),
  ((select id from t_ids where k = 'ta3'), (select id from t_ids where k = 't0a'), 'Free chat'),
  ((select id from t_ids where k = 'tb1'), (select id from t_ids where k = 't0b'), 'Free chat');

select has_column('public', 'sessions', 'title_source', 'sessions has title_source');
select col_not_null('public', 'sessions', 'title_source', 'title_source is not null');
select col_default_is('public', 'sessions', 'title_source', 'default', 'title_source defaults to default');
select is((select title_source from public.sessions where id = (select id from t_ids where k = 'ta1')), 'default', 'a row inserted without title_source reads default');
select throws_ok($$update public.sessions set title_source = 'other' where id = (select id from t_ids where k = 'ta1')$$, '23514', null, 'an unknown title_source is rejected');

select has_function('public', 'set_session_title', array['uuid', 'text', 'text'], 'set_session_title exists');
select is((select prosecdef from pg_proc where oid = 'public.set_session_title(uuid,text,text)'::regprocedure), false, 'set_session_title is security invoker');
select ok((select proconfig from pg_proc where oid = 'public.set_session_title(uuid,text,text)'::regprocedure) @> array['search_path=""'], 'set_session_title has an empty search_path');
select ok(not has_function_privilege('anon', 'public.set_session_title(uuid,text,text)', 'execute'), 'anon cannot execute set_session_title');
select ok(has_function_privilege('authenticated', 'public.set_session_title(uuid,text,text)', 'execute'), 'authenticated can execute set_session_title');
select ok(
  has_column_privilege('authenticated', 'public.sessions', 'title', 'UPDATE')
  and has_column_privilege('authenticated', 'public.sessions', 'title_source', 'UPDATE'),
  'authenticated updates title and title_source'
);
select ok(not has_column_privilege('authenticated', 'public.sessions', 'title_source', 'INSERT'), 'authenticated does not insert title_source');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 't0a'), true);

select throws_ok($$update public.sessions set topic_id = 'food' where id = (select id from t_ids where k = 'ta1')$$, '42501', null, 'topic_id stays not updatable');

select results_eq(
  $$select title, title_source from public.set_session_title((select id from t_ids where k = 'ta1'), 'Ramen spots in Tokyo', 'auto')$$,
  $$values ('Ramen spots in Tokyo'::text, 'auto'::text)$$,
  'an auto title is written over a default one'
);
select results_eq(
  $$select title, title_source from public.set_session_title((select id from t_ids where k = 'ta1'), 'Another idea', 'auto')$$,
  $$values ('Ramen spots in Tokyo'::text, 'auto'::text)$$,
  'an auto title never replaces an auto title, and the row comes back unchanged'
);
select results_eq(
  $$select title, title_source from public.set_session_title((select id from t_ids where k = 'ta1'), 'My food trip', 'user')$$,
  $$values ('My food trip'::text, 'user'::text)$$,
  'a user title replaces an auto title'
);
select results_eq(
  $$select title, title_source from public.set_session_title((select id from t_ids where k = 'ta1'), 'Robot idea', 'auto')$$,
  $$values ('My food trip'::text, 'user'::text)$$,
  'an auto title never replaces a user title, and the row comes back unchanged'
);
select results_eq(
  $$select title, title_source from public.sessions where id = (select id from t_ids where k = 'ta1')$$,
  $$values ('My food trip'::text, 'user'::text)$$,
  'the stored row keeps the user title'
);
select results_eq(
  $$select title, title_source from public.set_session_title((select id from t_ids where k = 'ta1'), 'Second name', 'user')$$,
  $$values ('Second name'::text, 'user'::text)$$,
  'a user title replaces a user title'
);
select results_eq(
  $$select title, title_source from public.set_session_title((select id from t_ids where k = 'ta2'), 'First name', 'user')$$,
  $$values ('First name'::text, 'user'::text)$$,
  'a user title replaces a default title'
);
select results_eq(
  $$select title from public.set_session_title((select id from t_ids where k = 'ta3'), '  Weekend plans  ', 'user')$$,
  $$values ('Weekend plans'::text)$$,
  'the title is trimmed'
);

select is_empty($$select 1 from public.set_session_title((select id from t_ids where k = 'ta2'), '', 'user')$$, 'an empty title returns no row');
select is_empty($$select 1 from public.set_session_title((select id from t_ids where k = 'ta2'), '   ', 'user')$$, 'a blank title returns no row');
select is_empty($$select 1 from public.set_session_title((select id from t_ids where k = 'ta2'), repeat('a', 61), 'user')$$, 'a title of 61 characters returns no row');
select results_eq(
  $$select title from public.sessions where id = (select id from t_ids where k = 'ta2')$$,
  $$values ('First name'::text)$$,
  'invalid titles leave the row unchanged'
);
select results_eq(
  $$select char_length(title) from public.set_session_title((select id from t_ids where k = 'ta2'), repeat('a', 60), 'user')$$,
  $$values (60)$$,
  'a title of exactly 60 characters is stored'
);
select results_eq(
  $$select title from public.set_session_title((select id from t_ids where k = 'ta2'), 'a', 'user')$$,
  $$values ('a'::text)$$,
  'a title of 1 character is stored'
);
select is_empty($$select 1 from public.set_session_title((select id from t_ids where k = 'ta2'), 'Fine title', 'default')$$, 'the default source returns no row');
select is_empty($$select 1 from public.set_session_title((select id from t_ids where k = 'ta2'), 'Fine title', 'other')$$, 'an unknown source returns no row');
select is_empty($$select 1 from public.set_session_title((select id from t_ids where k = 'ta2'), 'Fine title', null)$$, 'a null source returns no row');
select results_eq(
  $$select title, title_source from public.sessions where id = (select id from t_ids where k = 'ta2')$$,
  $$values ('a'::text, 'user'::text)$$,
  'invalid sources leave the row unchanged'
);
select is_empty($$select 1 from public.set_session_title((select id from t_ids where k = 'tb1'), 'Stolen', 'user')$$, 'another user session returns no row');
select is_empty($$select 1 from public.set_session_title(gen_random_uuid(), 'Nobody', 'user')$$, 'a missing session returns no row');

reset role;
select results_eq(
  $$select title, title_source from public.sessions where id = (select id from t_ids where k = 'tb1')$$,
  $$values ('Free chat'::text, 'default'::text)$$,
  'the other user session keeps its title and source'
);
select ok(not has_function_privilege('anon', 'public.set_session_title(uuid,text,text)', 'execute'), 'anon still cannot execute');

select * from finish();
rollback;
