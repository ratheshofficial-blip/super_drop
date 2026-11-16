alter table public.supports
  add column if not exists payment_status text not null default 'mock'
    check (payment_status in ('mock', 'pending', 'paid', 'refunded'));

alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_reserved_username_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_reserved_username_check
      check (username <> all (array[
        'admin', 'api', 'dashboard', 'demo', 'login', 'overlay',
        'privacy', 'refunds', 'signup', 'terms'
      ]));
  end if;
end;
$$;

create table if not exists public.creator_private_settings (
  creator_id uuid primary key references public.profiles (id) on delete cascade,
  overlay_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  payout_method text not null default 'upi' check (payout_method in ('upi', 'bank')),
  payout_upi_id text not null default '' check (char_length(payout_upi_id) <= 120),
  bank_account_holder text not null default '' check (char_length(bank_account_holder) <= 120),
  bank_account_number text not null default '' check (char_length(bank_account_number) <= 40),
  bank_ifsc text not null default '' check (bank_ifsc = '' or bank_ifsc ~ '^[A-Za-z]{4}0[A-Za-z0-9]{6}$'),
  updated_at timestamptz not null default now()
);

insert into public.creator_private_settings (creator_id)
select id from public.profiles
on conflict (creator_id) do nothing;

create table if not exists public.support_rate_limits (
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (fingerprint, window_start)
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute procedure public.touch_updated_at();

drop trigger if exists creator_private_settings_touch_updated_at on public.creator_private_settings;
create trigger creator_private_settings_touch_updated_at
  before update on public.creator_private_settings
  for each row execute procedure public.touch_updated_at();

create or replace function public.create_creator_private_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creator_private_settings (creator_id)
  values (new.id)
  on conflict (creator_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_superdrop_profile_created_private_settings on public.profiles;
create trigger on_superdrop_profile_created_private_settings
  after insert on public.profiles
  for each row execute procedure public.create_creator_private_settings();

alter table public.creator_private_settings enable row level security;
alter table public.support_rate_limits enable row level security;

drop policy if exists "Creators can read their private settings" on public.creator_private_settings;
create policy "Creators can read their private settings"
  on public.creator_private_settings for select to authenticated
  using (creator_id = auth.uid());

drop policy if exists "Creators can insert their private settings" on public.creator_private_settings;
create policy "Creators can insert their private settings"
  on public.creator_private_settings for insert to authenticated
  with check (creator_id = auth.uid());

drop policy if exists "Creators can update their private settings" on public.creator_private_settings;
create policy "Creators can update their private settings"
  on public.creator_private_settings for update to authenticated
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

drop policy if exists "Fans can send support" on public.supports;
drop policy if exists "Creators can manage their supports" on public.supports;
drop policy if exists "Creators can update support status and replies" on public.supports;
create policy "Creators can update support status and replies"
  on public.supports for update to authenticated
  using (public.is_superdrop_admin() or exists (
    select 1 from public.profiles p where p.username = creator_username and p.id = auth.uid()
  ))
  with check (public.is_superdrop_admin() or exists (
    select 1 from public.profiles p where p.username = creator_username and p.id = auth.uid()
  ));

revoke insert on public.supports from anon, authenticated;
revoke update on public.supports from anon, authenticated;
grant update (status, reply) on public.supports to authenticated;

revoke insert, delete on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, tagline, bio, avatar_url, banner_url, links) on public.profiles to authenticated;

revoke all on public.creator_private_settings from anon, authenticated;
grant select, insert on public.creator_private_settings to authenticated;
grant update (payout_method, payout_upi_id, bank_account_holder, bank_account_number, bank_ifsc)
  on public.creator_private_settings to authenticated;

revoke all on public.support_rate_limits from anon, authenticated;
grant all on public.support_rate_limits to service_role;

create or replace function public.check_support_rate_limit(p_fingerprint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz := date_trunc('minute', now());
  current_count integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'not authorized';
  end if;

  insert into public.support_rate_limits (fingerprint, window_start, request_count)
  values (p_fingerprint, bucket_start, 1)
  on conflict (fingerprint, window_start)
  do update set request_count = public.support_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from public.support_rate_limits
  where window_start < now() - interval '1 day';

  return current_count <= 3;
end;
$$;

create or replace function public.rotate_creator_overlay_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  insert into public.creator_private_settings (creator_id)
  values (auth.uid())
  on conflict (creator_id) do nothing;

  update public.creator_private_settings
  set overlay_token = pg_catalog.encode(public.gen_random_bytes(24), 'hex')
  where creator_id = auth.uid()
  returning overlay_token into new_token;

  return new_token;
end;
$$;

create or replace function public.creator_earnings_summary()
returns table (all_time bigint, today bigint, this_week bigint, this_month bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(s.amount), 0)::bigint,
    coalesce(sum(s.amount) filter (
      where s.created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    ), 0)::bigint,
    coalesce(sum(s.amount) filter (
      where s.created_at >= date_trunc('week', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    ), 0)::bigint,
    coalesce(sum(s.amount) filter (
      where s.created_at >= date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'
    ), 0)::bigint
  from public.supports s
  join public.profiles p on p.username = s.creator_username
  where p.id = auth.uid()
    and s.payment_status = 'mock'
$$;

create or replace function public.admin_list_creators()
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  status text,
  created_at timestamptz,
  support_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superdrop_admin() then
    raise exception 'admin access required';
  end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, p.status, p.created_at,
    count(s.id)::bigint
  from public.profiles p
  left join public.supports s on s.creator_username = p.username
  group by p.id
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_list_transactions()
returns table (
  id uuid,
  creator_username text,
  creator_name text,
  fan_name text,
  is_anonymous boolean,
  amount integer,
  message text,
  request_type text,
  status text,
  payment_status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superdrop_admin() then
    raise exception 'admin access required';
  end if;

  return query
  select s.id, s.creator_username, p.display_name,
    case when s.is_anonymous then 'Anonymous' else s.fan_name end,
    s.is_anonymous, s.amount, s.message, s.request_type, s.status,
    s.payment_status, s.created_at
  from public.supports s
  join public.profiles p on p.username = s.creator_username
  order by s.created_at desc
  limit 100;
end;
$$;

create or replace function public.admin_set_creator_blocked(p_username text, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_superdrop_admin() then
    raise exception 'admin access required';
  end if;
  update public.profiles
  set status = case when p_blocked then 'blocked' else 'active' end
  where username = p_username;
  if not found then
    raise exception 'creator not found';
  end if;
end;
$$;

create or replace function public.admin_set_platform_fee(p_fee numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_superdrop_admin() then
    raise exception 'admin access required';
  end if;
  if p_fee < 0 or p_fee > 30 then
    raise exception 'platform fee must be between 0 and 30 percent';
  end if;
  insert into public.settings (key, value, updated_at)
  values ('platform_fee_percent', to_jsonb(p_fee), now())
  on conflict (key) do update
  set value = excluded.value, updated_at = excluded.updated_at;
  return p_fee;
end;
$$;

create or replace function public.admin_overview()
returns table (creator_count bigint, transaction_count bigint, total_mock_amount bigint, platform_fee numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superdrop_admin() then
    raise exception 'admin access required';
  end if;
  return query
  select
    (select count(*) from public.profiles)::bigint,
    (select count(*) from public.supports)::bigint,
    (select coalesce(sum(amount), 0) from public.supports where payment_status = 'mock')::bigint,
    coalesce((select (value #>> '{}')::numeric from public.settings where key = 'platform_fee_percent'), 5);
end;
$$;

revoke all on function public.check_support_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_support_rate_limit(text) to service_role;
revoke all on function public.rotate_creator_overlay_token() from public, anon;
grant execute on function public.rotate_creator_overlay_token() to authenticated;
revoke all on function public.creator_earnings_summary() from public, anon;
grant execute on function public.creator_earnings_summary() to authenticated;
revoke all on function public.admin_list_creators() from public, anon;
grant execute on function public.admin_list_creators() to authenticated;
revoke all on function public.admin_list_transactions() from public, anon;
grant execute on function public.admin_list_transactions() to authenticated;
revoke all on function public.admin_set_creator_blocked(text, boolean) from public, anon;
grant execute on function public.admin_set_creator_blocked(text, boolean) to authenticated;
revoke all on function public.admin_set_platform_fee(numeric) from public, anon;
grant execute on function public.admin_set_platform_fee(numeric) to authenticated;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'supports'
  ) then
    alter publication supabase_realtime add table public.supports;
  end if;
end;
$$;
