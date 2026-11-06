-- Profiles, sessions and messages, with row level security and narrow grants.
-- The closed value lists mirror packages/shared (apps/api/test/migrations.test.ts
-- fails when they drift).

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.display_name_from_metadata(meta jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(meta ->> 'full_name'), '');
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  level text check (level in ('beginner', 'intermediate', 'advanced')),
  goals text[] not null default '{}'
    check (goals <@ array['work', 'travel', 'exams', 'conversation']),
  topics text[] not null default '{}'
    check (topics <@ array[
      'technology', 'sports', 'music', 'movies_and_series', 'food', 'travel',
      'gaming', 'job_interviews', 'books', 'health_and_fitness', 'science', 'daily_life'
    ]),
  monthly_limit_usd numeric(8, 2) check (monthly_limit_usd > 0),
  provider text check (provider in ('claude', 'openai')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id text check (topic_id in (
    'technology', 'sports', 'music', 'movies_and_series', 'food', 'travel',
    'gaming', 'job_interviews', 'books', 'health_and_fitness', 'science', 'daily_life'
  )),
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'ended')),
  summary text,
  cost_usd numeric(10, 4) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_status_updated_idx
on public.sessions (user_id, status, updated_at desc);

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  role text not null check (role in ('user', 'tutor')),
  text text not null,
  corrections jsonb,
  new_words jsonb,
  created_at timestamptz not null default now()
);

create index messages_session_created_idx
on public.messages (session_id, created_at);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy sessions_select_own on public.sessions
for select to authenticated
using (user_id = (select auth.uid()));

create policy sessions_insert_own on public.sessions
for insert to authenticated
with check (user_id = (select auth.uid()));

create policy messages_select_own on public.messages
for select to authenticated
using (exists (
  select 1 from public.sessions s
  where s.id = session_id and s.user_id = (select auth.uid())
));

-- New public tables are open to anon and authenticated by default: close them,
-- then grant only what the API routes use. messages has no insert grant or
-- policy on purpose: the chat issue adds both.
revoke all on public.profiles, public.sessions, public.messages from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, level, goals, topics, monthly_limit_usd, provider, onboarding_completed_at)
on public.profiles to authenticated;
grant select on public.sessions to authenticated;
grant insert (user_id, topic_id, title) on public.sessions to authenticated;
grant select on public.messages to authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.display_name_from_metadata(new.raw_user_meta_data));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Apple sends the name after the user row exists: fill it when still empty.
create function public.handle_user_metadata_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set display_name = public.display_name_from_metadata(new.raw_user_meta_data)
  where id = new.id
    and display_name is null
    and public.display_name_from_metadata(new.raw_user_meta_data) is not null;
  return new;
end;
$$;

create trigger on_auth_user_metadata_updated
after update of raw_user_meta_data on auth.users
for each row execute function public.handle_user_metadata_change();

insert into public.profiles (id, display_name)
select id, public.display_name_from_metadata(raw_user_meta_data) from auth.users
on conflict (id) do nothing;

revoke execute on function
  public.set_updated_at(),
  public.display_name_from_metadata(jsonb),
  public.handle_new_user(),
  public.handle_user_metadata_change()
from public, anon, authenticated;
