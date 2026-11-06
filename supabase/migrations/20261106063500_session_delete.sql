-- A user deletes their own sessions. The messages go with the session through
-- the on delete cascade of messages.session_id; referential actions bypass row
-- level security, so messages get no delete grant.
grant delete on public.sessions to authenticated;

create policy sessions_delete_own on public.sessions
for delete to authenticated
using (user_id = (select auth.uid()));
