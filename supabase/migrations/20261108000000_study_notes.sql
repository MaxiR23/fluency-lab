-- Study notes: a table or a summary of a grammar point, made by the tutor in a
-- chat or from a missed exercise. A note belongs to the user and keeps the
-- session it came from only while that session exists: deleting a session sets
-- session_id to null and keeps the note. messages and practice_runs point at a
-- note with note_id, also on delete set null.
--
-- The set null actions are referential integrity actions and bypass row level
-- security (PostgreSQL 17, ddl-rowsecurity), so no table needs an update grant
-- or an update policy for them. For the same reason the foreign key on note_id
-- alone would accept the note of another user: the insert policies below check
-- who owns the note a row points to. The policies read other tables and never
-- their own, so none of them can recurse (42P17).
create table public.study_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  kind text not null check (kind in ('table', 'summary')),
  title text not null check (char_length(title) between 1 and 80),
  topic text not null check (char_length(topic) between 1 and 80),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now()
);

create index study_notes_user_created_idx
  on public.study_notes (user_id, created_at desc);
create index study_notes_session_idx
  on public.study_notes (session_id) where session_id is not null;

alter table public.study_notes enable row level security;

-- New public tables are open to anon and authenticated by default: close it,
-- then grant only what the API uses. A note is never edited: no update grant.
revoke all on public.study_notes from anon, authenticated;
grant select, delete on public.study_notes to authenticated;
grant insert (user_id, session_id, kind, title, topic, content)
  on public.study_notes to authenticated;

create policy study_notes_select_own on public.study_notes
for select to authenticated
using (user_id = (select auth.uid()));

create policy study_notes_insert_own on public.study_notes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    study_notes.session_id is null
    or exists (
      select 1 from public.sessions s
      where s.id = study_notes.session_id and s.user_id = (select auth.uid())
    )
  )
);

create policy study_notes_delete_own on public.study_notes
for delete to authenticated
using (user_id = (select auth.uid()));

-- A tutor message names the note it came with.
alter table public.messages
  add column note_id uuid references public.study_notes (id) on delete set null;

create index messages_note_idx on public.messages (note_id) where note_id is not null;

grant insert (note_id) on public.messages to authenticated;

drop policy messages_insert_own on public.messages;
create policy messages_insert_own on public.messages
for insert to authenticated
with check (
  exists (
    select 1 from public.sessions s
    where s.id = messages.session_id and s.user_id = (select auth.uid())
  )
  and (
    messages.note_id is null
    or exists (
      select 1 from public.study_notes n
      where n.id = messages.note_id and n.user_id = (select auth.uid())
    )
  )
);

-- A practice run can be made on a note. The check cannot require the note of a
-- note run: the set null of a deleted note is an update of the run, and a check
-- applies to updated rows too, so a note with a run could never be deleted. The
-- run stays, with its cost in the month's spend, and note_id null. The note is
-- required on insert only, by a trigger.
alter table public.practice_runs drop constraint practice_runs_focus_check;
alter table public.practice_runs add constraint practice_runs_focus_check
  check (focus in ('mistakes', 'words', 'topic', 'note'));

alter table public.practice_runs
  add column note_id uuid references public.study_notes (id) on delete set null,
  add constraint practice_runs_note_check check (note_id is null or focus = 'note');

create index practice_runs_note_idx on public.practice_runs (note_id) where note_id is not null;

grant insert (note_id) on public.practice_runs to authenticated;

create function public.require_practice_note()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.focus = 'note' and new.note_id is null then
    raise exception 'a note run needs its note' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger practice_runs_require_note
before insert on public.practice_runs
for each row execute function public.require_practice_note();

-- As with set_updated_at, the trigger still fires for authenticated, which
-- does not need to execute the function itself.
revoke execute on function public.require_practice_note() from public, anon, authenticated;

drop policy practice_runs_insert_own on public.practice_runs;
create policy practice_runs_insert_own on public.practice_runs
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    practice_runs.note_id is null
    or exists (
      select 1 from public.study_notes n
      where n.id = practice_runs.note_id and n.user_id = (select auth.uid())
    )
  )
);
