-- The Profile and Progress word totals, replaced to count the new words learned
-- in a correction thread, as progress_words already lists them. This supersedes
-- the note in 20261106120000_correction_threads.sql that progress_month's
-- new_word_count and profile_stats count the words of messages only. Words come
-- from messages.new_words and thread_messages.new_words (any role, as
-- progress_words reads them), compared trimmed and lower case; blank words and
-- values that are not an array are skipped. A word in both the chat and a thread
-- counts once, at its earliest created_at. Signatures, columns, stable, security
-- invoker and search_path are those of 20261106090000_profile_stats.sql and
-- 20261106120000_correction_threads.sql; only the word source differs. Grants are
-- not restated: create or replace keeps a function's owner and privileges.

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
           select distinct (s.created_at at time zone profile_stats.time_zone)::date as day
           from public.sessions s
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

create or replace function public.progress_month(time_zone text, month_start date)
returns table (session_count bigint, correction_count bigint, new_word_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    select lower(btrim(w.word)) as word, m.created_at
    from public.messages m
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(m.new_words) = 'array' then m.new_words else '[]'::jsonb end
    ) as w(word)
    where btrim(w.word) <> ''
    union all
    select lower(btrim(w.word)), t.created_at
    from public.thread_messages t
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(t.new_words) = 'array' then t.new_words else '[]'::jsonb end
    ) as w(word)
    where btrim(w.word) <> ''
  ),
  firsts as (
    select words.word, min(words.created_at) as first_at
    from words
    group by words.word
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
