-- supabase/tests/database/study_notes_test.sql
--
-- Tests for study notes: the table, its row level security and the note_id columns of messages and practice_runs.
--
-- Tested:
-- - RLS is on and anon has no privilege on study_notes
-- - authenticated selects and deletes, inserts only the named columns and never updates
-- - authenticated can insert messages.note_id and practice_runs.note_id
-- - a user reads only their own notes and a note defaults user_id to the caller
-- - the kind, title and content checks
-- - a user cannot insert a note as another user or into another user session
-- - a message or a note run cannot point at another user note
-- - a note run needs its note and a run of another focus cannot have one
-- - a user cannot delete the note of another user
-- - deleting a session keeps its notes, deleting a note keeps its message and its run
-- - deleting a user removes their notes
-- - the trigger function that requires the note cannot be executed by authenticated
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261108000000_study_notes.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('u0a', gen_random_uuid()),
  ('u0b', gen_random_uuid()),
  ('sa1', gen_random_uuid()),
  ('sa2', gen_random_uuid()),
  ('sb1', gen_random_uuid()),
  ('na1', gen_random_uuid()),
  ('na2', gen_random_uuid()),
  ('nb1', gen_random_uuid()),
  ('ma2', gen_random_uuid()),
  ('ra1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'u0a'), 'a@test.com'),
  ((select id from t_ids where k = 'u0b'), 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ((select id from t_ids where k = 'sa1'), (select id from t_ids where k = 'u0a'), 'Free chat'),
  ((select id from t_ids where k = 'sa2'), (select id from t_ids where k = 'u0a'), 'Free chat'),
  ((select id from t_ids where k = 'sb1'), (select id from t_ids where k = 'u0b'), 'Free chat');
insert into public.study_notes (id, user_id, session_id, kind, title, topic, content) values
  ((select id from t_ids where k = 'na1'), (select id from t_ids where k = 'u0a'), (select id from t_ids where k = 'sa1'), 'table', 'Future forms', 'Going to, will', '{"columns":["a","b","c"],"rows":[["1","2","3"]],"remember":"r"}'::jsonb),
  ((select id from t_ids where k = 'na2'), (select id from t_ids where k = 'u0a'), (select id from t_ids where k = 'sa2'), 'summary', 'Present perfect', 'Have + past participle', '{"points":["p"],"remember":"r"}'::jsonb),
  ((select id from t_ids where k = 'nb1'), (select id from t_ids where k = 'u0b'), (select id from t_ids where k = 'sb1'), 'summary', 'Articles', 'A, an, the', '{"points":["p"],"remember":"r"}'::jsonb);
insert into public.messages (id, session_id, role, text, note_id) values
  ((select id from t_ids where k = 'ma2'), (select id from t_ids where k = 'sa2'), 'tutor', 'Here is your note.', (select id from t_ids where k = 'na2'));
insert into public.practice_runs (id, user_id, focus, note_id, target, cost_usd) values
  ((select id from t_ids where k = 'ra1'), (select id from t_ids where k = 'u0a'), 'note', (select id from t_ids where k = 'na2'), 5, 0.5);

select results_eq($$select relrowsecurity from pg_class where oid = 'public.study_notes'::regclass$$, array[true], 'RLS is on for study_notes');
select ok(not has_table_privilege('anon', 'public.study_notes', 'select, insert, update, delete'), 'anon has no privilege on study_notes');
select ok(has_table_privilege('authenticated', 'public.study_notes', 'select') and has_table_privilege('authenticated', 'public.study_notes', 'delete') and has_column_privilege('authenticated', 'public.study_notes', 'title', 'INSERT'), 'authenticated selects, inserts and deletes study_notes');
select ok(not has_table_privilege('authenticated', 'public.study_notes', 'update') and not has_column_privilege('authenticated', 'public.study_notes', 'title', 'UPDATE') and not has_column_privilege('authenticated', 'public.study_notes', 'content', 'UPDATE'), 'authenticated cannot update study_notes');
select ok(has_column_privilege('authenticated', 'public.study_notes', 'user_id', 'INSERT') and has_column_privilege('authenticated', 'public.study_notes', 'session_id', 'INSERT') and has_column_privilege('authenticated', 'public.study_notes', 'kind', 'INSERT') and has_column_privilege('authenticated', 'public.study_notes', 'title', 'INSERT') and has_column_privilege('authenticated', 'public.study_notes', 'topic', 'INSERT') and has_column_privilege('authenticated', 'public.study_notes', 'content', 'INSERT') and not has_column_privilege('authenticated', 'public.study_notes', 'id', 'INSERT') and not has_column_privilege('authenticated', 'public.study_notes', 'created_at', 'INSERT'), 'authenticated inserts only user_id, session_id, kind, title, topic and content');
select ok(has_column_privilege('authenticated', 'public.messages', 'note_id', 'INSERT') and has_column_privilege('authenticated', 'public.practice_runs', 'note_id', 'INSERT'), 'authenticated can insert messages.note_id and practice_runs.note_id');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0a'), true);

select results_eq($$select count(*) from public.study_notes$$, array[2::bigint], 'a user reads only their own notes');
select results_eq($$insert into public.study_notes (kind, title, topic, content) values ('summary', 'Modals', 'Can, could', '{"points":["p"],"remember":"r"}'::jsonb) returning user_id$$, $$select id from t_ids where k = 'u0a'$$, 'a note defaults user_id to the caller');
select throws_ok($$insert into public.study_notes (kind, title, topic, content) values ('poem', 'Modals', 'Can, could', '{}'::jsonb)$$, '23514', null, 'an unknown kind fails');
select throws_ok($$insert into public.study_notes (kind, title, topic, content) values ('summary', '', 'Can, could', '{}'::jsonb)$$, '23514', null, 'an empty title fails');
select throws_ok($$insert into public.study_notes (kind, title, topic, content) values ('summary', 'Modals', 'Can, could', '[]'::jsonb)$$, '23514', null, 'a content that is not an object fails');
select throws_ok($$insert into public.study_notes (user_id, kind, title, topic, content) values ((select id from t_ids where k = 'u0b'), 'summary', 'Modals', 'Can, could', '{}'::jsonb)$$, '42501', null, 'a user cannot insert a note as another user');
select throws_ok($$insert into public.study_notes (session_id, kind, title, topic, content) values ((select id from t_ids where k = 'sb1'), 'summary', 'Modals', 'Can, could', '{}'::jsonb)$$, '42501', null, 'a user cannot attach a note to another user session');
select lives_ok($$insert into public.study_notes (session_id, kind, title, topic, content) values (null, 'summary', 'Modals', 'Can, could', '{}'::jsonb)$$, 'a user saves a note with no session');

select lives_ok($$insert into public.messages (session_id, role, text, note_id) values ((select id from t_ids where k = 'sa1'), 'tutor', 'Your table.', (select id from t_ids where k = 'na1'))$$, 'a tutor message with the user own note lives');
select throws_ok($$insert into public.messages (session_id, role, text, note_id) values ((select id from t_ids where k = 'sa1'), 'tutor', 'Your table.', (select id from t_ids where k = 'nb1'))$$, '42501', null, 'a message with another user note fails');

select lives_ok($$insert into public.practice_runs (focus, note_id, target) values ('note', (select id from t_ids where k = 'na1'), 5)$$, 'a note run with the user own note lives');
select throws_ok($$insert into public.practice_runs (focus, target) values ('note', 5)$$, '23514', null, 'a note run without its note fails');
select throws_ok($$insert into public.practice_runs (focus, note_id, target) values ('mistakes', (select id from t_ids where k = 'na1'), 5)$$, '23514', null, 'a mistakes run with a note fails');
select throws_ok($$insert into public.practice_runs (focus, note_id, target) values ('note', (select id from t_ids where k = 'nb1'), 5)$$, '42501', null, 'a note run on another user note fails');

select is_empty($$delete from public.study_notes where id = (select id from t_ids where k = 'nb1') returning 1$$, 'a delete of another user note touches no row');

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0b'), true);
select results_eq($$select count(*) from public.study_notes where id in (select id from t_ids where k in ('na1', 'na2'))$$, array[0::bigint], 'user B reads none of the notes of A');

select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'u0a'), true);
select lives_ok($$delete from public.sessions where id = (select id from t_ids where k = 'sa1')$$, 'deleting a session keeps its notes');
select results_eq($$select session_id is null from public.study_notes where id = (select id from t_ids where k = 'na1')$$, array[true], 'the kept note has no session');
select lives_ok($$delete from public.study_notes where id = (select id from t_ids where k = 'na2')$$, 'a user deletes their own note');
select results_eq($$select note_id is null from public.messages where id = (select id from t_ids where k = 'ma2')$$, array[true], 'deleting a note keeps its message with no note id');
select results_eq($$select note_id is null and cost_usd = 0.5 from public.practice_runs where id = (select id from t_ids where k = 'ra1')$$, array[true], 'deleting a note keeps its run with no note id and its cost');

reset role;
select lives_ok($$delete from auth.users where id = (select id from t_ids where k = 'u0a')$$, 'deleting a user with notes does not fail');
select is_empty($$select 1 from public.study_notes where user_id = (select id from t_ids where k = 'u0a')$$, 'deleting a user removes their notes');
select ok(not has_function_privilege('authenticated', 'public.require_practice_note()', 'execute'), 'the require note trigger function cannot be executed by authenticated');

select * from finish();
rollback;
