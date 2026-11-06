-- supabase/tests/database/thread_messages_test.sql
--
-- Tests for the correction threads: the thread_messages table, its policies, the withdraw function and the reply counts.
--
-- Tested:
-- - thread_messages has its key, index, foreign key to messages and row level security
-- - authenticated can select and insert only the columns the API writes, and cannot update or delete; anon has nothing
-- - a select as a user does not recurse (no 42P17)
-- - a user reads their own thread rows in created_at order and cannot read or write another user's
-- - the role must be user or tutor
-- - thread rows never appear in messages
-- - thread_counts lists the messages that have a thread with their row count, only the caller's
-- - withdraw_corrections flags the named items and changes nothing else; an index out of range changes nothing;
--   another user's message is not touched; authenticated has no update grant on messages
-- - anon cannot execute the two functions; authenticated can
-- - deleting a session deletes its thread rows and keeps the other session's
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106120000_correction_threads.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('h0a', gen_random_uuid()),
  ('h0b', gen_random_uuid()),
  ('ta1', gen_random_uuid()),
  ('ta2', gen_random_uuid()),
  ('tb1', gen_random_uuid()),
  ('ma1', gen_random_uuid()),
  ('ma1b', gen_random_uuid()),
  ('ma2', gen_random_uuid()),
  ('mb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'h0a'), 'a@test.com'),
  ((select id from t_ids where k = 'h0b'), 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ((select id from t_ids where k = 'ta1'), (select id from t_ids where k = 'h0a'), 'Free chat'),
  ((select id from t_ids where k = 'ta2'), (select id from t_ids where k = 'h0a'), 'Free chat'),
  ((select id from t_ids where k = 'tb1'), (select id from t_ids where k = 'h0b'), 'Free chat');
insert into public.messages (id, session_id, role, text, corrections) values
  ((select id from t_ids where k = 'ma1'), (select id from t_ids where k = 'ta1'), 'user', 'I go the next year',
    '{"items":[{"rule":"Articles","original":"the next year","corrected":"next year"},{"rule":"Tense","original":"I go","corrected":"I will go"}],"explanation":"Two fixes."}'),
  ((select id from t_ids where k = 'ma1b'), (select id from t_ids where k = 'ta1'), 'user', 'No thread here',
    '{"items":[{"original":"x","corrected":"y"}],"explanation":null}'),
  ((select id from t_ids where k = 'ma2'), (select id from t_ids where k = 'ta2'), 'user', 'Another session',
    '{"items":[{"original":"p","corrected":"q"}],"explanation":null}'),
  ((select id from t_ids where k = 'mb1'), (select id from t_ids where k = 'tb1'), 'user', 'B sentence',
    '{"items":[{"original":"bo","corrected":"bc"},{"original":"b2","corrected":"c2"}],"explanation":null}');
insert into public.thread_messages (message_id, role, text, created_at) values
  ((select id from t_ids where k = 'ma1'), 'user', 'second question', '2026-11-06T10:00:02+00'),
  ((select id from t_ids where k = 'ma1'), 'user', 'first question', '2026-11-06T10:00:01+00'),
  ((select id from t_ids where k = 'ma2'), 'user', 'other session question', '2026-11-06T10:00:03+00'),
  ((select id from t_ids where k = 'mb1'), 'user', 'b question', '2026-11-06T10:00:04+00');

select has_table('public', 'thread_messages', 'thread_messages exists');
select col_not_null('public', 'thread_messages', 'message_id', 'message_id is not null');
select fk_ok('public', 'thread_messages', 'message_id', 'public', 'messages', 'id', 'message_id references messages');
select has_index('public', 'thread_messages', 'thread_messages_message_created_idx', array['message_id', 'created_at']::name[], 'thread_messages is indexed by message and time');
select results_eq($$select relrowsecurity from pg_class where oid = 'public.thread_messages'::regclass$$, array[true], 'RLS is on for thread_messages');

select ok(has_table_privilege('authenticated', 'public.thread_messages', 'select'), 'authenticated can select thread_messages');
select ok(
  has_column_privilege('authenticated', 'public.thread_messages', 'message_id', 'insert')
  and has_column_privilege('authenticated', 'public.thread_messages', 'role', 'insert')
  and has_column_privilege('authenticated', 'public.thread_messages', 'text', 'insert')
  and has_column_privilege('authenticated', 'public.thread_messages', 'new_words', 'insert'),
  'authenticated can insert message_id, role, text and new_words'
);
select ok(not has_table_privilege('authenticated', 'public.thread_messages', 'update, delete'), 'authenticated cannot update or delete thread rows');
select ok(not has_table_privilege('anon', 'public.thread_messages', 'select, insert, update, delete'), 'anon has no privilege on thread_messages');
select ok(not has_column_privilege('authenticated', 'public.messages', 'corrections', 'update'), 'authenticated has no update privilege on messages corrections');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'h0a'), true);

select lives_ok($$select * from public.thread_messages$$, 'a select on thread_messages does not recurse');
select lives_ok($$insert into public.thread_messages (message_id, role, text) values ((select id from t_ids where k = 'ma1'), 'tutor', 'an answer')$$, 'a user inserts into their own message thread');
select results_eq(
  $$select text from public.thread_messages where message_id = (select id from t_ids where k = 'ma1') order by created_at$$,
  $$values ('first question'::text), ('second question'::text), ('an answer'::text)$$,
  'a user reads their thread rows in created_at order'
);
select throws_ok($$insert into public.thread_messages (message_id, role, text) values ((select id from t_ids where k = 'mb1'), 'user', 'x')$$, '42501', null, 'a user cannot write into another user thread');
select is_empty($$select * from public.thread_messages where message_id = (select id from t_ids where k = 'mb1')$$, 'a user cannot read another user thread rows');
select throws_ok($$insert into public.thread_messages (message_id, role, text) values ((select id from t_ids where k = 'ma1'), 'system', 'x')$$, '23514', null, 'a role other than user or tutor is rejected');
select is((select count(*) from public.messages where session_id = (select id from t_ids where k = 'ta1')), 2::bigint, 'thread rows never appear in messages');

select results_eq(
  $$select message_id, reply_count from public.thread_counts((select id from t_ids where k = 'ta1'))$$,
  $$select id, 3::bigint from t_ids where k = 'ma1'$$,
  'thread_counts lists the message with its thread and its count, and not one without a thread'
);
select is_empty($$select * from public.thread_counts((select id from t_ids where k = 'tb1'))$$, 'thread_counts shows nothing of another user session');

-- Withdraw.
create temp table t_before as
  select text, new_words, created_at, corrections -> 'explanation' as explanation, corrections -> 'items' -> 0 as item0
  from public.messages where id = (select id from t_ids where k = 'ma1');
grant select on t_before to authenticated;

select is((select count(*) from public.withdraw_corrections((select id from t_ids where k = 'ma1'), array[1])), 1::bigint, 'withdraw returns the message');
select is((select corrections -> 'items' -> 1 ->> 'withdrawn' from public.messages where id = (select id from t_ids where k = 'ma1')), 'true', 'the named item is flagged withdrawn');
select is((select corrections -> 'items' -> 0 from public.messages where id = (select id from t_ids where k = 'ma1')), (select item0 from t_before), 'the other item is unchanged');
select ok(
  (select m.text = b.text and m.new_words is not distinct from b.new_words and m.created_at = b.created_at and m.corrections -> 'explanation' = b.explanation
   from public.messages m, t_before b where m.id = (select id from t_ids where k = 'ma1')),
  'text, new words, explanation and time are unchanged'
);
select is(
  (select corrections::text from public.withdraw_corrections((select id from t_ids where k = 'ma1'), array[5])),
  (select corrections::text from public.messages where id = (select id from t_ids where k = 'ma1')),
  'an index out of range changes nothing'
);
select is_empty($$select * from public.withdraw_corrections((select id from t_ids where k = 'mb1'), array[0])$$, 'withdrawing another user message returns nothing');

reset role;
select is((select corrections -> 'items' -> 0 ->> 'withdrawn' from public.messages where id = (select id from t_ids where k = 'mb1')), null, 'another user corrections are unchanged');

select is(has_function_privilege('anon', 'public.withdraw_corrections(uuid, integer[])', 'execute'), false, 'anon cannot execute withdraw_corrections');
select is(has_function_privilege('authenticated', 'public.withdraw_corrections(uuid, integer[])', 'execute'), true, 'a signed-in user can execute withdraw_corrections');
select is(has_function_privilege('anon', 'public.thread_counts(uuid)', 'execute'), false, 'anon cannot execute thread_counts');
select is(has_function_privilege('authenticated', 'public.thread_counts(uuid)', 'execute'), true, 'a signed-in user can execute thread_counts');

delete from public.sessions where id = (select id from t_ids where k = 'ta1');
select is((select count(*) from public.thread_messages where message_id = (select id from t_ids where k = 'ma1')), 0::bigint, 'deleting a session deletes its thread rows');
select is((select count(*) from public.thread_messages where message_id = (select id from t_ids where k = 'ma2')), 1::bigint, 'deleting a session keeps the thread rows of another session');

select * from finish();
rollback;
