-- Run this in your Supabase project's SQL Editor (Dashboard > SQL Editor > New Query)
-- to set up the tables NoteBuddy needs.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0,
  streak integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  raw_text text not null,
  study_kit jsonb not null,
  subject text default 'General',
  created_at timestamptz not null default now()
);

-- Safe to re-run: adds the column if this table already existed without it.
alter table notes add column if not exists subject text default 'General';

-- Personalized Analogy Domain — set once in Account settings, then threaded
-- through every AI explanation (summary regen, tutor chat, Teach-Back
-- feedback, "explain differently") so explanations use analogies from a
-- domain the student actually understands (e.g. "explain everything
-- through cricket"). Null/empty means no preference set — explanations stay
-- generic.
alter table profiles add column if not exists analogy_domain text;

-- Per-card spaced-repetition progress (SM-2). Flashcards themselves live
-- inside notes.study_kit; this table only tracks how well each one is known.
create table if not exists flashcard_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null references notes(id) on delete cascade,
  card_index integer not null,
  ease_factor real not null default 2.5,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  next_review_date timestamptz,
  last_reviewed timestamptz,
  unique (user_id, note_id, card_index)
);

-- Row Level Security: each user can only see their own data.
alter table profiles enable row level security;
alter table notes enable row level security;
alter table flashcard_progress enable row level security;

create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can view their own notes"
  on notes for select using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on notes for insert with check (auth.uid() = user_id);

create policy "Users can view their own flashcard progress"
  on flashcard_progress for select using (auth.uid() = user_id);

create policy "Users can insert their own flashcard progress"
  on flashcard_progress for insert with check (auth.uid() = user_id);

create policy "Users can update their own flashcard progress"
  on flashcard_progress for update using (auth.uid() = user_id);

-- NOTE: the backend uses the SERVICE ROLE key, which bypasses RLS by design
-- (that's what lets the API write on the user's behalf). RLS above protects
-- the data if the frontend ever queries Supabase directly with the anon key.

-- Feature-usage analytics — a lightweight event log so it's possible to
-- answer "which features actually get used" instead of guessing. Every row
-- is one action (e.g. "generate_note", "debate_mode", "chat"); no answer
-- content or identifying detail beyond user_id is stored. See
-- supabase_client.log_feature_usage / get_feature_usage_summary and
-- lib/api.js's logFeatureUse on the frontend.
create table if not exists feature_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  created_at timestamptz not null default now()
);
create index if not exists feature_usage_log_feature_idx on feature_usage_log (feature);
create index if not exists feature_usage_log_created_at_idx on feature_usage_log (created_at);

alter table feature_usage_log enable row level security;

create policy "Users can insert their own usage events"
  on feature_usage_log for insert with check (auth.uid() = user_id);

-- Run this ad hoc in the SQL Editor for a quick "most/least used features"
-- report — this is the aggregate the technical gap report proposed, kept
-- as a query rather than a dashboard route since only the team needs it:
--
--   select feature, count(*) as uses, count(distinct user_id) as unique_users
--   from feature_usage_log
--   group by feature
--   order by uses desc;
