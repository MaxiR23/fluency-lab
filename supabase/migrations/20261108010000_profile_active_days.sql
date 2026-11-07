-- The Profile day streak counts the active days: a day with a chat or a finished
-- practice run, the same rule as the Home week (/sessions/week since #94).
-- profile_stats is replaced so session_days holds the distinct local dates, in
-- time_zone, of every sessions.created_at and every non-null
-- practice_runs.finished_at of the caller, newest first; the column keeps its
-- name. An unfinished run never counts; the not null filter is needed because
-- array_agg keeps nulls. session_count and new_words are unchanged from
-- 20261106130000_thread_word_totals.sql. Security invoker, so row level security
-- on sessions and practice_runs applies as the caller. Signature, columns,
-- stable, security invoker and search_path are those of
-- 20261106130000_thread_word_totals.sql. Grants are not restated: create or
-- replace keeps a function's owner and privileges.

create or replace function public.profile_stats(time_zone text)
returns table (session_count bigint, session_days date[], new_words bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.sessions),
    coalesce(
      (select array_agg(d.day order by d.day desc)
         from (
           select (s.created_at at time zone profile_stats.time_zone)::date as day
           from public.sessions s
           union
           select (r.finished_at at time zone profile_stats.time_zone)::date
           from public.practice_runs r
           where r.finished_at is not null
         ) d),
      '{}'
    ),
    (select count(distinct words.word)
       from (
         select lower(btrim(w.word)) as word
         from public.messages m
         cross join lateral jsonb_array_elements_text(
           case when jsonb_typeof(m.new_words) = 'array' then m.new_words else '[]'::jsonb end
         ) as w(word)
         where btrim(w.word) <> ''
         union all
         select lower(btrim(w.word))
         from public.thread_messages t
         cross join lateral jsonb_array_elements_text(
           case when jsonb_typeof(t.new_words) = 'array' then t.new_words else '[]'::jsonb end
         ) as w(word)
         where btrim(w.word) <> ''
       ) words);
$$;
