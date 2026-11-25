-- Pires Ferreira Olímpico: schema inicial
-- Execute no SQL Editor do seu projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.olympiads (
  id uuid primary key default gen_random_uuid(),
  acronym text not null unique,
  name text not null,
  description text not null default '',
  audience text not null default '',
  stages text not null default '',
  registration_info text not null default '',
  notices text not null default '',
  regulation_url text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  municipality text not null default 'Pires Ferreira',
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  olympiad_id uuid not null references public.olympiads(id) on delete cascade,
  title text not null,
  start_date date not null,
  end_date date,
  stage text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_event_dates check (end_date is null or end_date >= start_date)
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  olympiad_id uuid not null references public.olympiads(id) on delete cascade,
  participant_name text not null,
  school_id uuid references public.schools(id) on delete set null,
  school_name text not null default '',
  municipality text not null default 'Pires Ferreira',
  edition text not null default '',
  award text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists events_start_date_idx on public.events(start_date);
create index if not exists results_olympiad_idx on public.results(olympiad_id);
create index if not exists results_municipality_idx on public.results(municipality);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.admin_profiles enable row level security;
alter table public.olympiads enable row level security;
alter table public.schools enable row level security;
alter table public.events enable row level security;
alter table public.results enable row level security;

-- Conteúdo público publicado pode ser consultado sem login.
drop policy if exists "public read published olympiads" on public.olympiads;
create policy "public read published olympiads" on public.olympiads
for select using (published = true or public.is_admin());

drop policy if exists "admins manage olympiads" on public.olympiads;
create policy "admins manage olympiads" on public.olympiads
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read schools" on public.schools;
create policy "public read schools" on public.schools
for select using (true);
drop policy if exists "admins manage schools" on public.schools;
create policy "admins manage schools" on public.schools
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read events" on public.events;
create policy "public read events" on public.events
for select using (exists (select 1 from public.olympiads o where o.id = olympiad_id and o.published = true) or public.is_admin());
drop policy if exists "admins manage events" on public.events;
create policy "admins manage events" on public.events
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read results" on public.results;
create policy "public read results" on public.results
for select using (lower(trim(municipality)) = 'pires ferreira' or public.is_admin());
drop policy if exists "admins manage results" on public.results;
create policy "admins manage results" on public.results
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins read profiles" on public.admin_profiles;
create policy "admins read profiles" on public.admin_profiles
for select using (public.is_admin());

-- Inserção inicial somente das 13 competições pedidas.
insert into public.olympiads (acronym, name) values
('OBMEP','Olimpíada Brasileira de Matemática das Escolas Públicas'),
('OP','Olimpíada de Português'),
('OBA','Olimpíada Brasileira de Astronomia e Astronáutica'),
('OBLI','OBLI'),
('OMIFICE','OMIFICE'),
('ONC','Olimpíada Nacional de Ciências'),
('Canguru','Canguru de Matemática'),
('Mandacaru','Olimpíada Mandacaru de Matemática'),
('Cactus','Olimpíada Cactus'),
('Maratona Tech','Maratona Tech'),
('ONEE','ONEE'),
('OLITEF','Olimpíada do Tesouro Direto de Educação Financeira'),
('OCHE','OCHE')
on conflict (acronym) do nothing;


-- Permissões explícitas da Data API (a concessão automática foi desativada).
grant usage on schema public to anon, authenticated;
grant select on public.olympiads, public.schools, public.events, public.results to anon;
grant select, insert, update, delete on public.olympiads, public.schools, public.events, public.results to authenticated;
grant select on public.admin_profiles to authenticated;
