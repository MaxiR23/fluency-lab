-- Users created before the profiles table, or whose name arrived under `name`.
create or replace function public.display_name_from_metadata(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(btrim(meta ->> 'full_name'), ''), nullif(btrim(meta ->> 'name'), ''));
$$;

create function public.backfill_profiles()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  select u.id, public.display_name_from_metadata(u.raw_user_meta_data) from auth.users u
  on conflict (id) do nothing;

  update public.profiles p
  set display_name = public.display_name_from_metadata(u.raw_user_meta_data)
  from auth.users u
  where p.id = u.id
    and p.display_name is null
    and public.display_name_from_metadata(u.raw_user_meta_data) is not null;
end;
$$;

select public.backfill_profiles();

-- Called by the API when the caller has no row, so GET /profile never fails for it.
create function public.ensure_profile()
returns setof public.profiles
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  select u.id, public.display_name_from_metadata(u.raw_user_meta_data)
  from auth.users u
  where u.id = (select auth.uid())
  on conflict (id) do nothing;

  return query select * from public.profiles where id = (select auth.uid());
end;
$$;

revoke execute on function public.backfill_profiles(), public.ensure_profile()
from public, anon, authenticated;
grant execute on function public.ensure_profile() to authenticated;
