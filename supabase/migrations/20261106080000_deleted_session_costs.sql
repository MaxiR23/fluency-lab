-- Deleting a session must not lower the month's spend. Before a session with a
-- cost is deleted, its cost and start time are copied into a ledger the user
-- can read but never write. The spend adds this ledger to the sessions.
create table public.deleted_session_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  cost_usd numeric(14, 8) not null check (cost_usd > 0)
);

create index deleted_session_costs_user_created_idx
on public.deleted_session_costs (user_id, created_at);

alter table public.deleted_session_costs enable row level security;

-- Read only for the owner. No insert, update or delete grant: only the trigger
-- below writes, and rows go away only with the user. Supabase grants every
-- privilege to anon and authenticated by default, so those are revoked first.
revoke all on table public.deleted_session_costs from anon, authenticated;
grant select on public.deleted_session_costs to authenticated;

create policy deleted_session_costs_select_own on public.deleted_session_costs
for select to authenticated
using (user_id = (select auth.uid()));

-- Security definer so the trigger writes without a grant for the caller. The
-- user may be going away too (the cascade of auth.users), and then no row is
-- written because the foreign key would fail.
create function public.keep_deleted_session_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.cost_usd > 0 and exists (select 1 from auth.users u where u.id = old.user_id) then
    insert into public.deleted_session_costs (user_id, created_at, cost_usd)
    values (old.user_id, old.created_at, old.cost_usd);
  end if;
  return old;
end;
$$;

revoke execute on function public.keep_deleted_session_cost() from public, anon, authenticated;

create trigger sessions_keep_cost_before_delete
before delete on public.sessions
for each row execute function public.keep_deleted_session_cost();
