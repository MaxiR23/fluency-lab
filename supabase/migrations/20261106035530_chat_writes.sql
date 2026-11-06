-- The writes the chat needs: messages can be inserted, a session can be ended
-- and its cost can grow, always for the caller's own rows.

-- One input token costs 1e-7 USD and one cache read token 1e-8 USD, so the cost
-- needs 8 decimals. numeric(10, 4) rounded a typical turn (0.000145) to 0.0001.
alter table public.sessions alter column cost_usd type numeric(14, 8);

-- A user inserts messages into their own sessions only. The row level security
-- policy checks the session's owner.
grant insert (session_id, role, text, corrections, new_words) on public.messages to authenticated;

create policy messages_insert_own on public.messages
for insert to authenticated
with check (exists (
  select 1 from public.sessions s
  where s.id = session_id and s.user_id = (select auth.uid())
));

-- A user ends their own sessions and the cost grows through add_session_cost.
-- Granting update on status and cost_usd also lets a signed-in user change them
-- directly with their own token. They are the user's own session and spend, and
-- the policy keeps other users' rows out of reach.
grant update (status, cost_usd) on public.sessions to authenticated;

create policy sessions_update_own on public.sessions
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Adds to the cost atomically. Security invoker, so row level security applies
-- as the caller: another user's session returns no row.
create function public.add_session_cost(session_id uuid, amount_usd numeric)
returns setof public.sessions
language sql
security invoker
set search_path = ''
as $$
  update public.sessions s
  set cost_usd = s.cost_usd + add_session_cost.amount_usd
  where s.id = add_session_cost.session_id and add_session_cost.amount_usd >= 0
  returning s.*;
$$;

revoke execute on function public.add_session_cost(uuid, numeric) from public, anon;
grant execute on function public.add_session_cost(uuid, numeric) to authenticated;
