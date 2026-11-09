-- The topic ids of a session and of a practice run live only in packages/shared (topics.ts
-- and grammar-topics.ts). The API validates them against those catalogs on every write, so
-- adding a topic needs no migration. practice_runs_check, which requires topic_id exactly
-- when the focus is topic, stays.
alter table public.sessions drop constraint sessions_topic_id_check;
alter table public.practice_runs drop constraint practice_runs_topic_id_check;
