-- TamilCartoons Supabase schema
-- Run the whole file in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.anime (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  japanese_name text,
  kind text not null default 'Anime',
  language text not null default 'Tamil Dubbed',
  release_year integer,
  status text default 'Ongoing',
  genre text,
  studio text,
  rating text,
  poster_url text,
  storyline text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  anime_id uuid not null references public.anime(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  title text,
  created_at timestamptz not null default now(),
  unique(anime_id, season_number)
);
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  episode_number integer not null check (episode_number > 0),
  title text,
  drive_url text not null,
  thumbnail_url text,
  description text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id, episode_number)
);

create or replace function public.is_tc_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin_users where user_id = auth.uid()); $$;
grant execute on function public.is_tc_admin() to anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.anime enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;

drop policy if exists "admins can read admin list" on public.admin_users;
create policy "admins can read admin list" on public.admin_users for select to authenticated using (public.is_tc_admin());
drop policy if exists "public read published anime" on public.anime;
create policy "public read published anime" on public.anime for select to anon, authenticated using (published = true or public.is_tc_admin());
drop policy if exists "admins manage anime" on public.anime;
create policy "admins manage anime" on public.anime for all to authenticated using (public.is_tc_admin()) with check (public.is_tc_admin());
drop policy if exists "public read seasons of published anime" on public.seasons;
create policy "public read seasons of published anime" on public.seasons for select to anon, authenticated using (exists(select 1 from public.anime a where a.id = anime_id and (a.published = true or public.is_tc_admin())));
drop policy if exists "admins manage seasons" on public.seasons;
create policy "admins manage seasons" on public.seasons for all to authenticated using (public.is_tc_admin()) with check (public.is_tc_admin());
drop policy if exists "public read published episodes" on public.episodes;
create policy "public read published episodes" on public.episodes for select to anon, authenticated using (published = true and exists(select 1 from public.seasons s join public.anime a on a.id=s.anime_id where s.id=season_id and a.published=true) or public.is_tc_admin());
drop policy if exists "admins manage episodes" on public.episodes;
create policy "admins manage episodes" on public.episodes for all to authenticated using (public.is_tc_admin()) with check (public.is_tc_admin());

-- Public bucket for poster/episode thumbnails. Do not upload private video files here.
insert into storage.buckets (id,name,public) values ('media','media',true) on conflict (id) do nothing;
drop policy if exists "public can view tc media" on storage.objects;
create policy "public can view tc media" on storage.objects for select to anon, authenticated using (bucket_id='media');
drop policy if exists "admins upload tc media" on storage.objects;
create policy "admins upload tc media" on storage.objects for insert to authenticated with check (bucket_id='media' and public.is_tc_admin());
drop policy if exists "admins update tc media" on storage.objects;
create policy "admins update tc media" on storage.objects for update to authenticated using (bucket_id='media' and public.is_tc_admin()) with check (bucket_id='media' and public.is_tc_admin());
drop policy if exists "admins delete tc media" on storage.objects;
create policy "admins delete tc media" on storage.objects for delete to authenticated using (bucket_id='media' and public.is_tc_admin());
