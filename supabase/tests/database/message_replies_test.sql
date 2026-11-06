-- supabase/tests/database/message_replies_test.sql
--
-- Tests for replies between messages: the reply_to_id column, its grant and its composite foreign key.
--
-- Tested:
-- - messages has reply_to_id and a unique key on (id, session_id)
-- - (reply_to_id, session_id) references messages (id, session_id)
-- - authenticated can insert reply_to_id and cannot update it
-- - a reply to a message of the same session is stored
-- - a message with no reply still inserts
-- - a reply cannot reference a message of another user, of another session or one that does not exist
-- - deleting the quoted message clears the reply and keeps its session
-- - deleting a session removes its messages, replies included
--
-- What is covered:
-- - Normal case, empty case, edges
--
-- Run with: pnpm supabase test db
--
-- SEE: supabase/migrations/20261106110000_message_replies.sql

begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

create temp table t_ids (k text primary key, id uuid not null);
insert into t_ids values
  ('r0a', gen_random_uuid()),
  ('r0b', gen_random_uuid()),
  ('ra1', gen_random_uuid()),
  ('ra2', gen_random_uuid()),
  ('rb1', gen_random_uuid()),
  ('rta1', gen_random_uuid()),
  ('rta2', gen_random_uuid()),
  ('rtb1', gen_random_uuid());
grant select on t_ids to authenticated;

insert into auth.users (id, email) values
  ((select id from t_ids where k = 'r0a'), 'a@test.com'),
  ((select id from t_ids where k = 'r0b'), 'b@test.com');
insert into public.sessions (id, user_id, title) values
  ((select id from t_ids where k = 'ra1'), (select id from t_ids where k = 'r0a'), 'Free chat'),
  ((select id from t_ids where k = 'ra2'), (select id from t_ids where k = 'r0a'), 'Free chat'),
  ((select id from t_ids where k = 'rb1'), (select id from t_ids where k = 'r0b'), 'Free chat');
insert into public.messages (id, session_id, role, text) values
  ((select id from t_ids where k = 'rta1'), (select id from t_ids where k = 'ra1'), 'tutor', 'Hello'),
  ((select id from t_ids where k = 'rta2'), (select id from t_ids where k = 'ra2'), 'tutor', 'Hello'),
  ((select id from t_ids where k = 'rtb1'), (select id from t_ids where k = 'rb1'), 'tutor', 'Hello');

select has_column('public', 'messages', 'reply_to_id', 'messages has reply_to_id');
select col_is_unique('public', 'messages', array['id', 'session_id']::name[], 'messages has a unique key on id and session_id');
select fk_ok('public', 'messages', array['reply_to_id', 'session_id']::name[], 'public', 'messages', array['id', 'session_id']::name[], 'reply_to_id and session_id reference a message of the same session');

set local role authenticated;
select set_config('request.jwt.claim.sub', (select id::text from t_ids where k = 'r0a'), true);

select ok(has_column_privilege('authenticated', 'public.messages', 'reply_to_id', 'INSERT'), 'authenticated can insert reply_to_id');
select ok(not has_column_privilege('authenticated', 'public.messages', 'reply_to_id', 'UPDATE'), 'authenticated cannot update reply_to_id');
select results_eq($$insert into public.messages (session_id, role, text, reply_to_id) values ((select id from t_ids where k = 'ra1'), 'user', 'Hi', (select id from t_ids where k = 'rta1')) returning reply_to_id$$, $$select id from t_ids where k = 'rta1'$$, 'a reply to a message of the same session is stored');
select lives_ok($$insert into public.messages (session_id, role, text) values ((select id from t_ids where k = 'ra1'), 'user', 'Hi again')$$, 'a message with no reply still inserts');
select throws_ok($$insert into public.messages (session_id, role, text, reply_to_id) values ((select id from t_ids where k = 'ra1'), 'user', 'x', (select id from t_ids where k = 'rtb1'))$$, '23503', null, 'a user cannot reference a message from another user session');
select throws_ok($$insert into public.messages (session_id, role, text, reply_to_id) values ((select id from t_ids where k = 'ra1'), 'user', 'x', (select id from t_ids where k = 'rta2'))$$, '23503', null, 'a reply cannot reference a message of another session of the same user');
select throws_ok($$insert into public.messages (session_id, role, text, reply_to_id) values ((select id from t_ids where k = 'ra1'), 'user', 'x', gen_random_uuid())$$, '23503', null, 'a reply to a message that does not exist is rejected');

reset role;
delete from public.messages where id = (select id from t_ids where k = 'rta1');
select ok(
  exists (
    select 1 from public.messages
    where session_id = (select id from t_ids where k = 'ra1') and text = 'Hi' and reply_to_id is null
  ),
  'deleting the quoted message clears the reply and keeps its session'
);
delete from public.sessions where id = (select id from t_ids where k = 'ra1');
select is((select count(*) from public.messages where session_id = (select id from t_ids where k = 'ra1')), 0::bigint, 'deleting a session removes its messages, replies included');

select * from finish();
rollback;
