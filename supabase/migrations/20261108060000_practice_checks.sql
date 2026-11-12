-- Practice checks: every check an exercise goes through (the code check, the
-- blind solver, the reviewer and the grader) becomes a row, so each model can
-- be measured. The rows only grow: a user has no update and no delete grant.
-- The policies read practice_runs and never practice_checks, so they cannot
-- recurse (42P17). Deleting the user removes the rows through the cascade,
-- which bypasses row level security.
create table public.practice_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  run_id uuid not null references public.practice_runs (id) on delete cascade,
  stage text not null check (stage in ('code', 'solver', 'reviewer', 'grader')),
  generator_model text not null,
  checker_model text,
  check ((stage = 'code') = (checker_model is null)),
  passed boolean not null,
  reason text check (reason is null or char_length(reason) between 1 and 300),
  check (passed or reason is not null),
  solver_answer text check (solver_answer is null or char_length(solver_answer) between 1 and 300),
  exercise jsonb not null check (jsonb_typeof(exercise) = 'object'),
  created_at timestamptz not null default now()
);

create index practice_checks_run_idx on public.practice_checks (run_id);

alter table public.practice_checks enable row level security;

revoke all on public.practice_checks from anon, authenticated;
grant select on public.practice_checks to authenticated;
grant insert (run_id, stage, generator_model, checker_model, passed, reason, solver_answer, exercise)
  on public.practice_checks to authenticated;

create policy practice_checks_select on public.practice_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy practice_checks_insert on public.practice_checks
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.practice_runs r
      where r.id = practice_checks.run_id and r.user_id = (select auth.uid())
    )
  );
