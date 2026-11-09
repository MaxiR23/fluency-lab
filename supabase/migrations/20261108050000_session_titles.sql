-- Automatic titles and renaming. title_source says who wrote the title:
-- default (the topic or starter title the API gave it), auto (the tutor) or
-- user (the owner). Existing rows stay default.
alter table public.sessions
  add column title_source text not null default 'default'
    check (title_source in ('default', 'auto', 'user'));

-- The owner writes both through sessions_update_own; no other grant changes.
-- As with status and cost_usd, the grant also lets a signed-in user change them
-- directly with their own token: it is their own session, and the policy keeps
-- other users' rows out of reach. The app writes them only through set_session_title.
grant update (title, title_source) on public.sessions to authenticated;

-- Sets the caller's session title. source is auto or user; the title is trimmed
-- and must be 1 to 60 characters, otherwise no row is returned. An auto title is
-- written only while title_source is default; a user title always wins. A skipped
-- auto title returns the row unchanged, so the caller sees the title that is kept.
-- Security invoker, so row level security applies as the caller: another user's
-- session returns no row. The fallback select runs only when the update changed
-- nothing, so the snapshot it reads is the current row.
create function public.set_session_title(session_id uuid, new_title text, source text)
returns setof public.sessions
language sql
security invoker
set search_path = ''
as $$
  with valid as (
    select btrim(set_session_title.new_title, E' \t\r\n') as title
    where set_session_title.source in ('auto', 'user')
      and char_length(btrim(set_session_title.new_title, E' \t\r\n')) between 1 and 60
  ),
  updated as (
    update public.sessions s
    set title = (select v.title from valid v), title_source = set_session_title.source
    where s.id = set_session_title.session_id
      and exists (select 1 from valid)
      and (set_session_title.source = 'user' or s.title_source = 'default')
    returning s.*
  )
  select * from updated
  union all
  select s.* from public.sessions s
  where s.id = set_session_title.session_id
    and exists (select 1 from valid)
    and not exists (select 1 from updated);
$$;

revoke execute on function public.set_session_title(uuid, text, text) from public, anon;
grant execute on function public.set_session_title(uuid, text, text) to authenticated;
