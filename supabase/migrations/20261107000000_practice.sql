-- Daily practice: a run is one practice of 5, 10 or 15 exercises on a focus (the
-- learner's mistakes, their new words or a grammar topic), and each exercise is a
-- practice_items row. The items hang off the run with on delete cascade: deleting
-- the user removes them through the existing cascade chain, which bypasses row
-- level security. A user has no delete grant on either table, so a run's cost
-- always stays in the month's spend. The policies on items read runs and never
-- items, so they cannot recurse (42P17).
create table public.practice_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  focus text not null check (focus in ('mistakes', 'words', 'topic')),
  topic_id text check (topic_id in (
    'going_to_vs_will',
    'present_simple_future',
    'past_simple_vs_present_perfect',
    'present_perfect',
    'conditionals',
    'prepositions_of_time',
    'articles',
    'phrasal_verbs'
  )),
  check ((focus = 'topic') = (topic_id is not null)),
  target integer not null check (target in (5, 10, 15)),
  cost_usd numeric(14, 8) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index practice_runs_user_created_idx
  on public.practice_runs (user_id, created_at);

create table public.practice_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.practice_runs (id) on delete cascade,
  position integer not null check (position between 0 and 14),
  kind text not null check (kind in ('choose', 'fix', 'gap', 'translate')),
  rule text not null,
  prompt text not null,
  options jsonb,
  check ((kind = 'choose') = (options is not null)),
  check (
    options is null or (
      jsonb_typeof(options) = 'array'
      and jsonb_array_length(options) = 3
      and jsonb_typeof(options -> 0) = 'string'
      and jsonb_typeof(options -> 1) = 'string'
      and jsonb_typeof(options -> 2) = 'string'
    )
  ),
  accepted jsonb not null check (
    jsonb_typeof(accepted) = 'array'
    and jsonb_array_length(accepted) > 0
    and not jsonb_path_exists(accepted, 'strict $[*] ? (@.type() != "string")')
  ),
  explanation text not null,
  source text,
  user_answer text,
  correct boolean,
  answered_at timestamptz,
  unique (run_id, position)
);

alter table public.practice_runs enable row level security;
alter table public.practice_items enable row level security;

-- New public tables are open to anon and authenticated by default: close it,
-- then grant only what the API uses.
revoke all on public.practice_runs from anon, authenticated;
revoke all on public.practice_items from anon, authenticated;
grant select on public.practice_runs to authenticated;
grant select on public.practice_items to authenticated;
grant insert (user_id, focus, topic_id, target) on public.practice_runs to authenticated;
grant insert (run_id, position, kind, rule, prompt, options, accepted, explanation, source)
  on public.practice_items to authenticated;

-- A user raises the target, finishes their own run and the cost grows through
-- add_practice_cost. Granting update on cost_usd also lets a signed-in user
-- change it directly with their own token. It is the user's own run and spend,
-- as with sessions, and the policy keeps other users' rows out of reach.
grant update (target, finished_at, cost_usd) on public.practice_runs to authenticated;
grant update (user_answer, correct, answered_at) on public.practice_items to authenticated;

create policy practice_runs_select_own on public.practice_runs
for select to authenticated
using (user_id = (select auth.uid()));

create policy practice_runs_insert_own on public.practice_runs
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy practice_runs_update_own on public.practice_runs
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy practice_items_select_own on public.practice_items
for select to authenticated
using (exists (
  select 1 from public.practice_runs r
  where r.id = practice_items.run_id and r.user_id = (select auth.uid())
));

create policy practice_items_insert_own on public.practice_items
for insert to authenticated
with check (exists (
  select 1 from public.practice_runs r
  where r.id = practice_items.run_id and r.user_id = (select auth.uid())
));

create policy practice_items_update_own on public.practice_items
for update to authenticated
using (exists (
  select 1 from public.practice_runs r
  where r.id = practice_items.run_id and r.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.practice_runs r
  where r.id = practice_items.run_id and r.user_id = (select auth.uid())
));

-- Adds to the cost atomically. Security invoker, so row level security applies
-- as the caller: another user's run returns no row.
create function public.add_practice_cost(run_id uuid, amount_usd numeric)
returns setof public.practice_runs
language sql
security invoker
set search_path = ''
as $$
  update public.practice_runs r
  set cost_usd = r.cost_usd + add_practice_cost.amount_usd
  where r.id = add_practice_cost.run_id and add_practice_cost.amount_usd >= 0
  returning r.*;
$$;

revoke execute on function public.add_practice_cost(uuid, numeric) from public, anon;
grant execute on function public.add_practice_cost(uuid, numeric) to authenticated;
