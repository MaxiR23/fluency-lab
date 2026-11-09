-- The conversation topic ids of a profile live only in packages/shared (topics.ts). The API
-- validates them against that catalog on every write (PUT /profile), so adding a topic needs
-- no migration. The other checks of profiles and the not null default '{}' of topics stay.
alter table public.profiles drop constraint profiles_topics_check;
