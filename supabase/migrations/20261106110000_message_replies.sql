-- A learner message can reply to a message of the same session. The composite
-- foreign key keeps the quoted row in that session: a message of another
-- session, of another user or one that does not exist fails with 23503. The
-- check is a key and not a policy because a policy on messages that reads
-- messages recurses. messages_insert_own still requires the caller's session.
-- The database checks only the same session, not the role of either message:
-- the app enforces that a reply quotes a tutor message.
alter table public.messages
  add constraint messages_id_session_key unique (id, session_id);

-- set null names reply_to_id only: session_id is not null and must stay.
alter table public.messages
  add column reply_to_id uuid,
  add constraint messages_reply_to_fkey
    foreign key (reply_to_id, session_id)
    references public.messages (id, session_id)
    on delete set null (reply_to_id);

create index messages_reply_to_idx on public.messages (reply_to_id)
where reply_to_id is not null;

grant insert (reply_to_id) on public.messages to authenticated;
