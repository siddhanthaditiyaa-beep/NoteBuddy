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
