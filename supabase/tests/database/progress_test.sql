-- supabase/tests/database/progress_test.sql
--
-- Tests for the Progress functions: the month's numbers, ended sessions, mistakes by rule and new words.
--
-- Tested:
-- - a user with no data gets zeros and no rows from each function
-- - progress_month counts sessions, correction items and first-seen words inside the local month only
-- - progress_history lists ended sessions newest first with message and correction counts, one page at a time
-- - progress_mistakes groups by rule ignoring case and spaces, puts rule-less corrections in one null group,
--   orders by count then latest, and keeps the latest example
-- - progress_words lists each word once at its first appearance, newest first, with its message text,
--   words of a thread included with the thread row's text
-- - a withdrawn correction is left out of the month and history totals and of the mistakes
-- - another user's sessions, corrections and words never appear
-- - anon cannot execute the functions; a signed-in user can
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106100000_progress.sql
-- SEE: supabase/migrations/20261106120000_correction_threads.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('e0a', gen_random_uuid()),
  ('e0b', gen_random_uuid()),
  ('e0c', gen_random_uuid()),
  ('sa1', gen_random_uuid()),
  ('sa2', gen_random_uuid()),
  ('sa3', gen_random_uuid()),
  ('sa4', gen_random_uuid()),
  ('sb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'e0a'), 'a@test.com'),
  ((select id from t_ids where k = 'e0b'), 'b@test.com'),
  ((select id from t_ids where k = 'e0c'), 'c@test.com');

-- sa1 at 02:30Z on November 1 is still October 31 in Buenos Aires; sa4 is active and in December.
insert into public.sessions (id, user_id, title, status, created_at) values
  ((select id from t_ids where k = 'sa1'), (select id from t_ids where k = 'e0a'), 'Nov one', 'ended', '2026-11-01T02:30:00+00'),
  ((select id from t_ids where k = 'sa2'), (select id from t_ids where k = 'e0a'), 'Nov five', 'ended', '2026-11-05T15:00:00+00'),
  ((select id from t_ids where k = 'sa3'), (select id from t_ids where k = 'e0a'), 'Oct twenty', 'ended', '2026-10-20T12:00:00+00'),
  ((select id from t_ids where k = 'sa4'), (select id from t_ids where k = 'e0a'), 'December active', 'active', '2026-12-01T12:00:00+00'),
  ((select id from t_ids where k = 'sb1'), (select id from t_ids where k = 'e0b'), 'B chat', 'ended', '2026-11-10T12:00:00+00');

insert into public.messages (session_id, role, text, corrections, new_words, created_at) values
  ((select id from t_ids where k = 'sa3'), 'user', 'I goed home',
    '{"items":[{"rule":"Present perfect","original":"a1","corrected":"b1"},{"rule":"present perfect ","original":"a2","corrected":"b2"}],"explanation":null}',
    '["Itinerary"]', '2026-10-20T12:00:00+00'),
  ((select id from t_ids where k = 'sa2'), 'user', 'second',
    '{"items":[{"rule":"Present Perfect","original":"a3","corrected":"b3"}],"explanation":null}',
    '[" itinerary ", "catchy"]', '2026-11-05T15:01:00+00'),
  ((select id from t_ids where k = 'sa2'), 'user', 'third',
    '{"items":[{"rule":"Spelling","original":"o7","corrected":"c7"},{"rule":"Spelling","original":"o8","corrected":"c8","withdrawn":true}],"explanation":null}',
    null, '2026-11-05T15:02:00+00'),
  ((select id from t_ids where k = 'sa2'), 'user', 'fifth',
    '{"items":[{"rule":"Gerunds","original":"w1","corrected":"z1","withdrawn":true}],"explanation":null}',
    null, '2026-11-05T15:06:00+00'),
  ((select id from t_ids where k = 'sa2'), 'tutor', 'tutor message', null, '"not an array"', '2026-11-05T15:03:00+00'),
  ((select id from t_ids where k = 'sa2'), 'user', 'fourth', '{"items":"x","explanation":null}', '["  "]', '2026-11-05T15:04:00+00'),
  ((select id from t_ids where k = 'sa1'), 'user', 'first of november',
    '{"items":[{"original":"x1","corrected":"y1"},{"rule":"  ","original":"x2","corrected":"y2"}],"explanation":null}',
    null, '2026-11-01T02:31:00+00'),
  ((select id from t_ids where k = 'sa4'), 'user', 'dec msg',
    '{"items":[{"rule":"Articles","original":"o6","corrected":"c6"}],"explanation":null}',
    '["december"]', '2026-12-01T12:00:00+00'),
  ((select id from t_ids where k = 'sb1'), 'user', 'b message',
    '{"items":[{"rule":"Gerunds","original":"bo","corrected":"bc"}],"explanation":null}',
    '["zebra"]', '2026-11-10T12:00:00+00');

-- Thread rows: A's learner question on the second message teaches laid-back and catchy (catchy was
-- first seen on the message itself); B's thread teaches xylophone.
insert into public.thread_messages (message_id, role, text, new_words, created_at) values
  ((select id from public.messages where text = 'second'), 'user', 'Is laid-back right?', '["laid-back", "catchy"]', '2026-11-05T15:05:00+00'),
  ((select id from public.messages where text = 'b message'), 'user', 'What is xylophone?', '["xylophone"]', '2026-11-10T12:01:00+00');

set local role authenticated;

-- A user with no data.
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0c'), true);
select results_eq(
  $$select session_count, correction_count, new_word_count from public.progress_month('UTC', '2026-11-01')$$,
  $$values (0::bigint, 0::bigint, 0::bigint)$$,
  'a user with no data gets zeros for the month'
);
select is_empty($$select * from public.progress_history(0, 21)$$, 'a user with no data gets no history');
select is_empty($$select * from public.progress_mistakes(0, 21)$$, 'a user with no data gets no mistakes');
select is_empty($$select * from public.progress_words(0, 21)$$, 'a user with no data gets no words');

-- User A.
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0a'), true);
select results_eq(
  $$select session_count, correction_count, new_word_count from public.progress_month('UTC', '2026-11-01')$$,
  $$values (2::bigint, 4::bigint, 1::bigint)$$,
  'November in UTC counts its sessions, its correction items and the words first seen in it, and not December'
);
select results_eq(
  $$select session_count, correction_count, new_word_count from public.progress_month('America/Argentina/Buenos_Aires', '2026-11-01')$$,
  $$values (1::bigint, 2::bigint, 1::bigint)$$,
  'a session at 02:30Z on November 1 is not in November in Buenos Aires'
);
select results_eq(
  $$select session_count, correction_count, new_word_count from public.progress_month('America/Argentina/Buenos_Aires', '2026-10-01')$$,
  $$values (2::bigint, 4::bigint, 1::bigint)$$,
  'a session at 02:30Z on November 1 is in October in Buenos Aires'
);

select results_eq(
  $$select title, message_count, correction_count from public.progress_history(0, 2)$$,
  $$values ('Nov five'::text, 5::bigint, 2::bigint), ('Nov one'::text, 1::bigint, 2::bigint)$$,
  'history is ended sessions newest first with message and correction counts'
);
select results_eq(
  $$select title from public.progress_history(2, 2)$$,
  $$values ('Oct twenty'::text)$$,
  'history gives the next page from the offset'
);
select is(
  (select count(*) from public.progress_history(0, 50)),
  3::bigint,
  'history leaves out the active session'
);

select results_eq(
  $$select rule, times, original, corrected from public.progress_mistakes(0, 50)$$,
  $$values
    ('Present Perfect'::text, 3::bigint, 'a3'::text, 'b3'::text),
    (null::text, 2::bigint, 'x2'::text, 'y2'::text),
    ('Articles'::text, 1::bigint, 'o6'::text, 'c6'::text),
    ('Spelling'::text, 1::bigint, 'o7'::text, 'c7'::text)$$,
  'mistakes group by rule ignoring case and spaces, keep the null group and the latest example, ordered by count then latest'
);

select is(
  (select count(*) from public.progress_mistakes(0, 50) where rule = 'Gerunds'),
  0::bigint,
  'a withdrawn correction makes no mistake group'
);
select is(
  (select original from public.progress_mistakes(0, 50) where rule = 'Spelling'),
  'o7',
  'a withdrawn correction is not the latest example of its rule'
);

select results_eq(
  $$select word, sentence from public.progress_words(0, 50)$$,
  $$values ('december'::text, 'dec msg'::text), ('laid-back'::text, 'Is laid-back right?'::text), ('catchy'::text, 'second'::text), ('Itinerary'::text, 'I goed home'::text)$$,
  'each word appears once at its first appearance, newest first, with its message text or its thread text'
);
select results_eq(
  $$select word from public.progress_words(0, 1)$$,
  $$values ('december'::text)$$,
  'words give the newest one on the first page of one'
);

-- A never sees B's rows.
select is(
  (
    (select count(*) from public.progress_history(0, 50) where title = 'B chat')
    + (select count(*) from public.progress_mistakes(0, 50) where rule = 'Gerunds')
    + (select count(*) from public.progress_words(0, 50) where word in ('zebra', 'xylophone'))
  ),
  0::bigint,
  'another user sessions, corrections and words never appear'
);

-- User B.
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'e0b'), true);
select results_eq(
  $$select session_count, correction_count, new_word_count from public.progress_month('UTC', '2026-11-01')$$,
  $$values (1::bigint, 1::bigint, 1::bigint)$$,
  'as B the month counts only B rows'
);
select results_eq(
  $$select title from public.progress_history(0, 50)$$,
  $$values ('B chat'::text)$$,
  'as B the history has only B sessions'
);
select results_eq(
  $$select rule, times from public.progress_mistakes(0, 50)$$,
  $$values ('Gerunds'::text, 1::bigint)$$,
  'as B the mistakes have only B rules'
);
select results_eq(
  $$select word from public.progress_words(0, 50) order by word$$,
  $$values ('xylophone'::text), ('zebra'::text)$$,
  'as B the words have only B words'
);

reset role;
select is(has_function_privilege('anon', 'public.progress_month(text, date)', 'execute'), false, 'anon cannot execute progress_month');
select is(has_function_privilege('authenticated', 'public.progress_month(text, date)', 'execute'), true, 'a signed-in user can execute progress_month');
select is(has_function_privilege('anon', 'public.progress_history(integer, integer)', 'execute'), false, 'anon cannot execute progress_history');
select is(has_function_privilege('authenticated', 'public.progress_history(integer, integer)', 'execute'), true, 'a signed-in user can execute progress_history');
select is(has_function_privilege('anon', 'public.progress_mistakes(integer, integer)', 'execute'), false, 'anon cannot execute progress_mistakes');
select is(has_function_privilege('authenticated', 'public.progress_mistakes(integer, integer)', 'execute'), true, 'a signed-in user can execute progress_mistakes');
select is(has_function_privilege('anon', 'public.progress_words(integer, integer)', 'execute'), false, 'anon cannot execute progress_words');
select is(has_function_privilege('authenticated', 'public.progress_words(integer, integer)', 'execute'), true, 'a signed-in user can execute progress_words');

select * from finish();
rollback;
