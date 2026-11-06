-- The numbers of the Profile screen in one row, so PostgREST's max_rows cannot
-- truncate them: the count of the caller's sessions, the distinct days they had
-- a session in the given time zone (newest first, for the day streak) and the
-- count of distinct new words across their messages (compared trimmed and
-- lower case). Security invoker so row level security applies as the caller, as
-- add_session_cost does. An unknown time zone raises an error; the API checks it.
create function public.profile_stats(time_zone text)
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
    (select count(distinct lower(btrim(w.word)))
       from public.messages m
       cross join lateral jsonb_array_elements_text(
         case when jsonb_typeof(m.new_words) = 'array' then m.new_words else '[]'::jsonb end
       ) as w(word)
       where btrim(w.word) <> '');
$$;

revoke execute on function public.profile_stats(text) from public, anon;
grant execute on function public.profile_stats(text) to authenticated;
