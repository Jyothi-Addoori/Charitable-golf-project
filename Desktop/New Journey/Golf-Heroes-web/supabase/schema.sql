-- DIGITAL HEROES / Supabase schema
create extension if not exists pgcrypto;

create type public.user_role as enum ('subscriber','admin');
create type public.subscription_status as enum ('active','inactive','past_due','cancelled');
create type public.draw_status as enum ('draft','simulated','published');
create type public.verification_status as enum ('pending','approved','rejected');
create type public.payout_status as enum ('pending','paid','not_eligible');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role public.user_role not null default 'subscriber',
  created_at timestamptz not null default now()
);

create table if not exists public.charities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  location text,
  website_url text,
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  plan text not null default 'monthly' check(plan in ('monthly','yearly')),
  status public.subscription_status not null default 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  renewal_date date,
  charity_id uuid references public.charities(id) on delete set null,
  charity_percent numeric(5,2) not null default 10 check(charity_percent >= 10 and charity_percent <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  played_on date not null,
  stableford integer not null check(stableford between 1 and 45),
  created_at timestamptz not null default now(),
  unique(user_id, played_on)
);

create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  draw_date date not null,
  draw_type text not null default 'random' check(draw_type in ('random','algorithmic')),
  status public.draw_status not null default 'draft',
  participant_count integer not null default 0,
  prize_pool numeric(12,2) not null default 0,
  jackpot_amount numeric(12,2) not null default 0,
  four_match_pool numeric(12,2) not null default 0,
  three_match_pool numeric(12,2) not null default 0,
  winning_numbers integer[] default '{}',
  simulation_result jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score_snapshot integer[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(draw_id,user_id)
);

create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_type text not null check(match_type in ('5-number','4-number','3-number')),
  prize_amount numeric(12,2) not null default 0,
  proof_url text,
  verification_status public.verification_status not null default 'pending',
  payout_status public.payout_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Auto-create a profile after signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,email)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict(id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Keep only the five most recent scores per user.
create or replace function public.keep_latest_five_scores()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  delete from public.scores
  where user_id=new.user_id
    and id not in (
      select id from public.scores
      where user_id=new.user_id
      order by played_on desc, created_at desc
      limit 5
    );
  return new;
end; $$;

drop trigger if exists trim_scores on public.scores;
create trigger trim_scores after insert or update on public.scores
for each row execute procedure public.keep_latest_five_scores();

-- RLS
alter table public.profiles enable row level security;
alter table public.charities enable row level security;
alter table public.subscriptions enable row level security;
alter table public.scores enable row level security;
alter table public.draws enable row level security;
alter table public.draw_entries enable row level security;
alter table public.winners enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

drop policy if exists "profile own read" on public.profiles;
create policy "profile own read" on public.profiles for select using(id=auth.uid() or public.is_admin());
drop policy if exists "profile own update" on public.profiles;
create policy "profile own update" on public.profiles for update using(id=auth.uid() or public.is_admin());

drop policy if exists "charities public read" on public.charities;
create policy "charities public read" on public.charities for select using(active=true or public.is_admin());
drop policy if exists "charities admin write" on public.charities;
create policy "charities admin write" on public.charities for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "subscription own" on public.subscriptions;
create policy "subscription own" on public.subscriptions for select using(user_id=auth.uid() or public.is_admin());
drop policy if exists "subscription own insert" on public.subscriptions;
create policy "subscription own insert" on public.subscriptions for insert with check(user_id=auth.uid() or public.is_admin());
drop policy if exists "subscription own update" on public.subscriptions;
create policy "subscription own update" on public.subscriptions for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());

drop policy if exists "scores own" on public.scores;
create policy "scores own" on public.scores for select using(user_id=auth.uid() or public.is_admin());
drop policy if exists "scores insert" on public.scores;
create policy "scores insert" on public.scores for insert with check(user_id=auth.uid());
drop policy if exists "scores update" on public.scores;
create policy "scores update" on public.scores for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
drop policy if exists "scores delete" on public.scores;
create policy "scores delete" on public.scores for delete using(user_id=auth.uid() or public.is_admin());

drop policy if exists "draws published read" on public.draws;
create policy "draws published read" on public.draws for select using(status='published' or public.is_admin());
drop policy if exists "draws admin write" on public.draws;
create policy "draws admin write" on public.draws for all using(public.is_admin()) with check(public.is_admin());

drop policy if exists "entries own" on public.draw_entries;
create policy "entries own" on public.draw_entries for select using(user_id=auth.uid() or public.is_admin());
drop policy if exists "entries insert" on public.draw_entries;
create policy "entries insert" on public.draw_entries for insert with check(user_id=auth.uid() or public.is_admin());

drop policy if exists "winners own/admin" on public.winners;
create policy "winners own/admin" on public.winners for select using(user_id=auth.uid() or public.is_admin());
drop policy if exists "winners own proof" on public.winners;
create policy "winners own proof" on public.winners for update using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
drop policy if exists "winners admin" on public.winners;
create policy "winners admin" on public.winners for all using(public.is_admin()) with check(public.is_admin());

-- Seed charities.
insert into public.charities(name,description,location,featured) values
('Green Futures Foundation','Community projects that create greener, healthier spaces.','India',true),
('Fairway to Futures','Youth development and access to sport.','India',false),
('Hope & Health Trust','Health and wellbeing support for local families.','India',false)
on conflict do nothing;

-- Optional first draw seed.
insert into public.draws(title,draw_date,draw_type,status,participant_count,prize_pool,jackpot_amount,four_match_pool,three_match_pool)
values('September Monthly Draw','2026-09-30','random','draft',0,0,0,0,0)
on conflict do nothing;
