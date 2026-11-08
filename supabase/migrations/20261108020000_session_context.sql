-- The chat's own summary of its older turns. context_summary is the summary;
-- context_through_id is the last message it covers. The composite foreign key
-- keeps that message in the same session (messages_id_session_key, from the
-- replies migration). set null names context_through_id only: id is the key.
-- A deleted message leaves the summary with no point; the app then ignores it.
alter table public.sessions
  add column context_summary text
    check (char_length(context_summary) between 1 and 2000),
  add column context_through_id uuid,
  add constraint sessions_context_through_fkey
    foreign key (context_through_id, id)
    references public.messages (id, session_id)
    on delete set null (context_through_id);

-- The owner writes both through sessions_update_own; no other grant changes.
grant update (context_summary, context_through_id) on public.sessions to authenticated;
