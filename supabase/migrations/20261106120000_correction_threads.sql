-- Correction threads: a learner can ask the tutor about one corrected message in
-- its own thread. The thread rows live in thread_messages, never in messages, so
-- they cannot show up in the main chat, the Summary or the message counts.
--
-- thread_messages hangs off messages with on delete cascade: deleting a session
-- (or the account) removes its threads through the existing cascade chain, which
-- bypasses row level security. Its two policies read messages joined to
-- sessions and never thread_messages itself, because a policy that reads its own
-- table recurses (42P17). The database does not check which message a thread
-- hangs on, as with reply_to_id: the app opens a thread only on a saved learner
-- message with corrections.
create table public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  role text not null check (role in ('user', 'tutor')),
  text text not null,
  new_words jsonb,
  created_at timestamptz not null default now()
);

create index thread_messages_message_created_idx
  on public.thread_messages (message_id, created_at);

alter table public.thread_messages enable row level security;

-- New public tables are open to anon and authenticated by default: close it,
-- then grant only what the API uses. Thread rows are never updated or deleted by
-- a user.
revoke all on public.thread_messages from anon, authenticated;
grant select on public.thread_messages to authenticated;
grant insert (message_id, role, text, new_words) on public.thread_messages to authenticated;

create policy thread_messages_select_own on public.thread_messages
for select to authenticated
using (exists (
  select 1 from public.messages m
  join public.sessions s on s.id = m.session_id
  where m.id = thread_messages.message_id and s.user_id = (select auth.uid())
));

create policy thread_messages_insert_own on public.thread_messages
for insert to authenticated
with check (exists (
  select 1 from public.messages m
  join public.sessions s on s.id = m.session_id
  where m.id = thread_messages.message_id and s.user_id = (select auth.uid())
));

-- withdraw_corrections: flags the named corrections of a message as withdrawn
-- (item_indexes are 0-based; an index outside the list is ignored). It is
-- security definer because authenticated has no update grant on messages: it
-- runs as the owner, so no messages policy applies and none can recurse. It
-- checks the owner itself with auth.uid() and changes only the withdrawn flag.
-- A message that is not the caller's returns no row.
-- A signed-in user can withdraw their own corrections directly: the AI call runs
-- on the device with the user's own key, so the server cannot verify the tutor's
-- answer, and the effect is limited to the caller's own Mistakes and totals.
create function public.withdraw_corrections(message_id uuid, item_indexes integer[])
returns setof public.messages
language sql
security definer
set search_path = ''
as $$
  update public.messages m
  set corrections = jsonb_set(m.corrections, '{items}', (
    select coalesce(jsonb_agg(
      case when i.n - 1 = any (withdraw_corrections.item_indexes) and jsonb_typeof(i.item) = 'object'
        then i.item || '{"withdrawn": true}'::jsonb else i.item end
      order by i.n), '[]'::jsonb)
    from jsonb_array_elements(m.corrections -> 'items') with ordinality as i(item, n)
  ))
  where m.id = withdraw_corrections.message_id
    and jsonb_typeof(m.corrections -> 'items') = 'array'
    and exists (
      select 1 from public.sessions s
      where s.id = m.session_id and s.user_id = (select auth.uid())
    )
  returning m.*;
$$;

-- thread_counts: how many thread rows each message of a session has, only for
-- messages that have a thread. Aggregated in SQL so PostgREST's max_rows cannot
-- truncate it; security invoker so row level security applies as the caller.
create function public.thread_counts(session_id uuid)
returns table (message_id uuid, reply_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.message_id, count(*)
  from public.thread_messages t
  join public.messages m on m.id = t.message_id
  where m.session_id = thread_counts.session_id
  group by t.message_id;
$$;

revoke execute on function public.withdraw_corrections(uuid, integer[]) from public, anon;
grant execute on function public.withdraw_corrections(uuid, integer[]) to authenticated;
revoke execute on function public.thread_counts(uuid) from public, anon;
grant execute on function public.thread_counts(uuid) to authenticated;

-- The Progress functions, replaced to leave out the corrections a tutor
-- withdrew and to add the new words learned in a thread. Signatures, columns
-- and grants are those of 20261106100000_progress.sql; only the lines that skip
-- withdrawn items (counts become item by item) and the thread words branch of
-- progress_words differ. progress_month.new_word_count and profile_stats still
-- count the words of messages only.

create or replace function public.progress_month(time_zone text, month_start date)
returns table (session_count bigint, correction_count bigint, new_word_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with firsts as (
    select lower(btrim(w.word)) as word, min(m.created_at) as first_at
    from public.messages m
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(m.new_words) = 'array' then m.new_words else '[]'::jsonb end
    ) as w(word)
    where btrim(w.word) <> ''
    group by 1
  )
  select
    (select count(*) from public.sessions s
      where (s.created_at at time zone progress_month.time_zone)::date >= progress_month.month_start
        and (s.created_at at time zone progress_month.time_zone)::date
          < (progress_month.month_start + interval '1 month')::date),
    (select count(*)
       from public.messages m
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(m.corrections -> 'items') = 'array' then m.corrections -> 'items' else '[]'::jsonb end
      ) as i(item)
      where (i.item -> 'withdrawn') is distinct from 'true'::jsonb
        and (m.created_at at time zone progress_month.time_zone)::date >= progress_month.month_start
        and (m.created_at at time zone progress_month.time_zone)::date
          < (progress_month.month_start + interval '1 month')::date),
    (select count(*) from firsts f
      where (f.first_at at time zone progress_month.time_zone)::date >= progress_month.month_start
        and (f.first_at at time zone progress_month.time_zone)::date
          < (progress_month.month_start + interval '1 month')::date);
$$;

create or replace function public.progress_history(page_offset integer, page_size integer)
returns table (
  id uuid, topic_id text, title text, status text, summary text, cost_usd numeric,
  created_at timestamptz, updated_at timestamptz, message_count bigint, correction_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id, s.topic_id, s.title, s.status, s.summary, s.cost_usd, s.created_at, s.updated_at,
    (select count(*) from public.messages m where m.session_id = s.id),
    (select count(*)
       from public.messages m
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(m.corrections -> 'items') = 'array' then m.corrections -> 'items' else '[]'::jsonb end
      ) as i(item)
      where m.session_id = s.id and (i.item -> 'withdrawn') is distinct from 'true'::jsonb)
  from public.sessions s
  where s.status = 'ended'
  order by s.created_at desc, s.id desc
  offset greatest(progress_history.page_offset, 0)
  limit least(greatest(progress_history.page_size, 0), 51);
$$;

create or replace function public.progress_mistakes(page_offset integer, page_size integer)
returns table (rule text, times bigint, original text, corrected text, latest_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with items as (
    select
      nullif(btrim(i.item ->> 'rule'), '') as rule,
      i.item ->> 'original' as original,
      i.item ->> 'corrected' as corrected,
      m.created_at,
      i.n
    from public.messages m
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(m.corrections -> 'items') = 'array' then m.corrections -> 'items' else '[]'::jsonb end
    ) with ordinality as i(item, n)
    where jsonb_typeof(i.item) = 'object'
      and i.item ->> 'original' is not null
      and i.item ->> 'corrected' is not null
      and (i.item -> 'withdrawn') is distinct from 'true'::jsonb
  ),
  ranked as (
    select
      items.*,
      lower(items.rule) as key,
      count(*) over (partition by lower(items.rule)) as times,
      row_number() over (partition by lower(items.rule) order by items.created_at desc, items.n desc) as position
    from items
  )
  select r.rule, r.times, r.original, r.corrected, r.created_at
  from ranked r
  where r.position = 1
  order by r.times desc, r.created_at desc, r.key asc nulls last
  offset greatest(progress_mistakes.page_offset, 0)
  limit least(greatest(progress_mistakes.page_size, 0), 51);
$$;

create or replace function public.progress_words(page_offset integer, page_size integer)
returns table (word text, sentence text, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select btrim(w.word) as word, lower(btrim(w.word)) as key, m.text as sentence, m.created_at, w.n
    from public.messages m
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(m.new_words) = 'array' then m.new_words else '[]'::jsonb end
    ) with ordinality as w(word, n)
    where btrim(w.word) <> ''
    union all
    select btrim(w.word), lower(btrim(w.word)), t.text, t.created_at, w.n
    from public.thread_messages t
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(t.new_words) = 'array' then t.new_words else '[]'::jsonb end
    ) with ordinality as w(word, n)
    where btrim(w.word) <> ''
  ),
  firsts as (
    select distinct on (words.key) words.*
    from words
    order by words.key, words.created_at asc, words.n asc
  )
  select f.word, f.sentence, f.created_at
  from firsts f
  order by f.created_at desc, f.key asc
  offset greatest(progress_words.page_offset, 0)
  limit least(greatest(progress_words.page_size, 0), 51);
$$;
