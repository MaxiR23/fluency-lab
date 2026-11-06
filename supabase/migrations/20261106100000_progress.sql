-- The reads of the Progress screen, aggregated in SQL so PostgREST's max_rows
-- cannot truncate them: the month's numbers in one row, and the ended sessions,
-- the mistakes grouped by rule and the new words, one page at a time. Security
-- invoker so row level security applies as the caller, as profile_stats does.
-- An unknown time zone raises an error; the API checks it. Words are compared
-- trimmed and lower case; a rule is compared the same way and a missing rule is
-- one group (rule null). Page sizes are capped at 51 rows.

-- progress_month: three numbers for the month that starts at month_start, all
-- in the device time zone. session_count is the sessions created this month in
-- any status. correction_count is the correction items on messages created this
-- month. new_word_count is the distinct words first seen this month.
create function public.progress_month(time_zone text, month_start date)
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
    (select coalesce(sum(jsonb_array_length(m.corrections -> 'items')), 0)::bigint
       from public.messages m
      where jsonb_typeof(m.corrections -> 'items') = 'array'
        and (m.created_at at time zone progress_month.time_zone)::date >= progress_month.month_start
        and (m.created_at at time zone progress_month.time_zone)::date
          < (progress_month.month_start + interval '1 month')::date),
    (select count(*) from firsts f
      where (f.first_at at time zone progress_month.time_zone)::date >= progress_month.month_start
        and (f.first_at at time zone progress_month.time_zone)::date
          < (progress_month.month_start + interval '1 month')::date);
$$;

create function public.progress_history(page_offset integer, page_size integer)
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
    (select coalesce(sum(jsonb_array_length(m.corrections -> 'items')), 0)::bigint
       from public.messages m
      where m.session_id = s.id and jsonb_typeof(m.corrections -> 'items') = 'array')
  from public.sessions s
  where s.status = 'ended'
  order by s.created_at desc, s.id desc
  offset greatest(progress_history.page_offset, 0)
  limit least(greatest(progress_history.page_size, 0), 51);
$$;

create function public.progress_mistakes(page_offset integer, page_size integer)
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

create function public.progress_words(page_offset integer, page_size integer)
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

revoke execute on function public.progress_month(text, date) from public, anon;
grant execute on function public.progress_month(text, date) to authenticated;
revoke execute on function public.progress_history(integer, integer) from public, anon;
grant execute on function public.progress_history(integer, integer) to authenticated;
revoke execute on function public.progress_mistakes(integer, integer) from public, anon;
grant execute on function public.progress_mistakes(integer, integer) to authenticated;
revoke execute on function public.progress_words(integer, integer) from public, anon;
grant execute on function public.progress_words(integer, integer) to authenticated;
