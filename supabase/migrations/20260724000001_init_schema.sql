-- Time4Giving — סכימת בסיס (ARCHITECTURE §4-5)
-- enums → tables → indexes → trigger ליצירת פרופיל משתמש.

-- ─────────────────────────── ENUMS ───────────────────────────
create type region as enum (
  'otef','beer_sheva_negev_north','negev_south','arava_dead_sea',
  'carmel_haifa','galil_west','galil_upper','golan',
  'sharon','gush_dan','jerusalem_hills','judea_samaria','jordan_valley'
);

create type user_role as enum ('donor','recipient','coordinator','courier','org_member','admin');
create type verification_st as enum ('pending','approved','rejected');
create type recipient_type as enum ('military_unit','hospital','elderly','family','ngo','rescue','evacuee','emergency');
create type reputation_level as enum ('verified','trusted','elite','community_leader','national_volunteer');

create type assignment_status as enum (
  'committed','waiting_courier','courier_assigned',
  'picked_up','on_the_way','delivered','confirmed','rated','closed','cancelled'
);
create type offer_status as enum ('open','claimed','fulfilled','expired','cancelled');
create type need_status as enum ('open','committed','fulfilled','expired','cancelled');

create type event_type as enum (
  'need_created','offer_published','offer_claimed','committed',
  'match_suggested','transport_requested','courier_assigned',
  'picked_up','on_the_way','delivered','confirmed','rated','cancelled','expired'
);
create type notification_channel as enum ('push','in_app');

-- ─────────────────────────── USERS ───────────────────────────
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  full_name text,
  photo_url text,
  roles user_role[] not null default '{donor}',
  verification_status verification_st not null default 'pending',
  reputation_level reputation_level not null default 'verified',
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  service_regions region[] not null default '{}',   -- כיסוי לתורם/משנע/רכז (להתראות)
  capabilities text[] not null default '{}',          -- מה יכול להכין (תורם)
  total_donations int not null default 0,
  total_units int not null default 0,
  total_deliveries int not null default 0,
  units_served int not null default 0,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  region region,
  verification_status verification_st not null default 'pending',
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);

create table public.recipient_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recipient_type recipient_type not null,
  org_id uuid references public.organizations(id),
  region region not null,                 -- אזור בלבד. אין geo, אין נקודה.
  display_name text,                       -- גנרי לפומבי ("יחידה, עוטף")
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id),
  item_type text not null,
  quantity int not null,
  unit_label text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);

-- ─────────────────── OFFER / NEED / ASSIGNMENT ───────────────────
create table public.offers (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null references public.users(id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(id),
  food_type text not null,
  quantity int not null,
  unit_label text not null default 'מנות',
  kosher boolean not null default false,
  vegetarian boolean not null default false,
  notes text,
  photo_url text,
  origin_city text,
  origin_lat double precision,             -- מוצא בלבד (בית התורם) — למפה
  origin_lng double precision,
  service_regions region[] not null default '{}',
  ready_at timestamptz,
  donor_is_courier boolean not null default false,
  status offer_status not null default 'open',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);

create table public.needs (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.recipient_profiles(id) on delete cascade,
  region region not null,                  -- אזור בלבד (Dropdown)
  food_type text not null default 'מזון',
  quantity int not null,
  unit_label text not null default 'מנות',
  needed_at timestamptz,
  notes text,                              -- עובר סינון קואורדינטות
  status need_status not null default 'open',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  need_id uuid references public.needs(id),      -- זרימה A
  offer_id uuid references public.offers(id),    -- זרימה B
  donor_id uuid not null references public.users(id),
  recipient_id uuid not null references public.recipient_profiles(id),
  self_transport boolean not null default false,
  coordinator_id uuid references public.users(id),
  courier_id uuid references public.users(id),
  org_id uuid references public.organizations(id),
  general_destination region not null,
  status assignment_status not null default 'committed',
  phone_revealed_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid,
  constraint assignment_source check (need_id is not null or offer_id is not null)
);

-- ─────────────────── REPUTATION / RATINGS / BADGES ───────────────────
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  rater_id uuid not null references public.users(id),
  ratee_id uuid not null references public.users(id),
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (assignment_id, rater_id)
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_type text not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_type)
);

-- ─────────────────── EVENTS / AUDIT / NOTIFS / FEED ───────────────────
create table public.events (
  id bigint generated always as identity primary key,
  assignment_id uuid references public.assignments(id) on delete cascade,
  offer_id uuid references public.offers(id),
  need_id uuid references public.needs(id),
  type event_type not null,
  actor_id uuid references public.users(id),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.users(id),
  action text not null,
  target_type text,
  target_id uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  channel notification_channel not null default 'in_app',
  title text,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  platform text,
  primary key (user_id, token)
);

create table public.feed_events (
  id bigint generated always as identity primary key,
  type text not null,
  actor_id uuid references public.users(id),
  payload jsonb,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id),
  target_type text,
  target_id uuid,
  reason text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

-- ─────────────────────────── INDEXES ───────────────────────────
create index offers_service_regions_idx on public.offers using gin (service_regions);
create index offers_open_idx on public.offers (status) where status = 'open' and deleted_at is null;
create index needs_open_region_idx on public.needs (region) where status = 'open' and deleted_at is null;
create index users_service_regions_idx on public.users using gin (service_regions);
create index events_assignment_idx on public.events (assignment_id, created_at);
create index notifications_user_idx on public.notifications (user_id, read_at);
create index assignments_donor_idx on public.assignments (donor_id);
create index assignments_courier_idx on public.assignments (courier_id);

-- ─────────────── טריגר: יצירת שורת users בהרשמה ───────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
