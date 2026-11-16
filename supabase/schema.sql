create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null default 'Creator' check (char_length(display_name) between 1 and 48),
  tagline text not null default '' check (char_length(tagline) <= 80),
  bio text not null default '' check (char_length(bio) <= 240),
  avatar_url text not null default '',
  banner_url text not null default '',
  links jsonb not null default '{"instagram":"","youtube":"","website":""}'::jsonb,
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.supports (
  id uuid primary key default gen_random_uuid(),
  creator_username text not null references public.profiles (username) on update cascade on delete cascade,
  fan_name text not null default 'Anonymous' check (char_length(fan_name) between 1 and 40),
  is_anonymous boolean not null default false,
  message text not null default '' check (char_length(message) <= 240),
  amount integer not null check (amount between 1 and 100000),
  request_type text not null default 'Support' check (request_type in ('Support', 'Shoutout', 'Question', 'Song request')),
  status text not null default 'new' check (status in ('new', 'done')),
  reply text check (reply is null or char_length(reply) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists supports_creator_created_idx on public.supports (creator_username, created_at desc);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  method text not null check (method in ('upi', 'bank')),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed')),
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value)
values ('platform_fee_percent', '5'::jsonb)
on conflict (key) do nothing;

create or replace function public.is_superdrop_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create or replace function public.create_superdrop_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  new_username text;
begin
  base_username := lower(regexp_replace(split_part(coalesce(new.email, 'creator'), '@', 1), '[^a-z0-9_]', '', 'g'));
  base_username := trim(both '_' from base_username);
  if char_length(base_username) < 3 then
    base_username := 'creator';
  end if;
  new_username := left(base_username, 11) || '_' || left(replace(new.id::text, '-', ''), 8);

  insert into public.profiles (id, username, display_name)
  values (new.id, new_username, coalesce(nullif(split_part(new.email, '@', 1), ''), 'Creator'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_superdrop_profile on auth.users;
create trigger on_auth_user_created_superdrop_profile
  after insert on auth.users
  for each row execute procedure public.create_superdrop_profile();

alter table public.profiles enable row level security;
alter table public.supports enable row level security;
alter table public.payouts enable row level security;
alter table public.settings enable row level security;

drop policy if exists "Active profiles are public" on public.profiles;
create policy "Active profiles are public"
  on public.profiles for select
  using (status = 'active' or id = auth.uid() or public.is_superdrop_admin());

drop policy if exists "Creators can update their profile" on public.profiles;
create policy "Creators can update their profile"
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_superdrop_admin())
  with check (id = auth.uid() or public.is_superdrop_admin());

drop policy if exists "Creators can insert their profile" on public.profiles;
create policy "Creators can insert their profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "Recent supports are public" on public.supports;
create policy "Recent supports are public"
  on public.supports for select
  using (status = 'done' or public.is_superdrop_admin()
    or exists (select 1 from public.profiles p where p.username = creator_username and p.id = auth.uid()));

drop policy if exists "Fans can send support" on public.supports;
create policy "Fans can send support"
  on public.supports for insert to anon, authenticated
  with check (
    status = 'new'
    and exists (select 1 from public.profiles p where p.username = creator_username and p.status = 'active')
  );

drop policy if exists "Creators can manage their supports" on public.supports;
create policy "Creators can manage their supports"
  on public.supports for update to authenticated
  using (public.is_superdrop_admin() or exists (
    select 1 from public.profiles p where p.username = creator_username and p.id = auth.uid()
  ))
  with check (public.is_superdrop_admin() or exists (
    select 1 from public.profiles p where p.username = creator_username and p.id = auth.uid()
  ));

drop policy if exists "Creators can manage their payouts" on public.payouts;
create policy "Creators can manage their payouts"
  on public.payouts for all to authenticated
  using (creator_id = auth.uid() or public.is_superdrop_admin())
  with check (creator_id = auth.uid() or public.is_superdrop_admin());

drop policy if exists "Platform settings are readable" on public.settings;
create policy "Platform settings are readable"
  on public.settings for select
  using (true);

drop policy if exists "Admins can manage platform settings" on public.settings;
create policy "Admins can manage platform settings"
  on public.settings for all to authenticated
  using (public.is_superdrop_admin())
  with check (public.is_superdrop_admin());
