-- Time4Giving — RLS + הרשאות (ARCHITECTURE §12)

-- ─────────────── helpers ───────────────
create or replace function public.has_role(r user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and r = any(roles) and deleted_at is null
  );
$$;

create or replace function public.my_recipient_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.recipient_profiles where user_id = auth.uid() and deleted_at is null;
$$;

-- ─────────────── enable RLS ───────────────
alter table public.users enable row level security;
alter table public.organizations enable row level security;
alter table public.recipient_profiles enable row level security;
alter table public.inventory_items enable row level security;
alter table public.offers enable row level security;
alter table public.needs enable row level security;
alter table public.assignments enable row level security;
alter table public.ratings enable row level security;
alter table public.user_badges enable row level security;
alter table public.events enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.feed_events enable row level security;
alter table public.reports enable row level security;

-- ─────────────── users ───────────────
create policy users_select_self on public.users for select
  using (id = auth.uid() or public.has_role('admin'));
create policy users_update_self on public.users for update
  using (id = auth.uid()) with check (id = auth.uid());

-- View ציבורי — שדות לא-רגישים בלבד (בלי phone)
create view public.profiles_public
with (security_invoker = off) as
  select id, full_name, photo_url, roles, reputation_level,
         rating_avg, rating_count, total_donations, total_units,
         total_deliveries, units_served, created_at
  from public.users
  where deleted_at is null;
grant select on public.profiles_public to authenticated;

-- ─────────────── organizations ───────────────
create policy orgs_select on public.organizations for select
  using (deleted_at is null);
create policy orgs_admin_write on public.organizations for all
  using (public.has_role('admin')) with check (public.has_role('admin'));

-- ─────────────── recipient_profiles ───────────────
create policy recipients_select on public.recipient_profiles for select
  using (deleted_at is null);
create policy recipients_owner_write on public.recipient_profiles for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────── inventory ───────────────
create policy inventory_select on public.inventory_items for select
  using (deleted_at is null);

-- ─────────────── offers ───────────────
create policy offers_select on public.offers for select
  using (deleted_at is null);
create policy offers_owner_write on public.offers for all
  using (donor_id = auth.uid()) with check (donor_id = auth.uid());

-- ─────────────── needs ───────────────
create policy needs_select on public.needs for select
  using (deleted_at is null);
create policy needs_owner_write on public.needs for all
  using (recipient_id in (select public.my_recipient_ids()))
  with check (recipient_id in (select public.my_recipient_ids()));

-- ─────────────── assignments (רק הצדדים) ───────────────
create policy assignments_parties_select on public.assignments for select
  using (
    deleted_at is null and (
      donor_id = auth.uid()
      or courier_id = auth.uid()
      or coordinator_id = auth.uid()
      or recipient_id in (select public.my_recipient_ids())
      or (status = 'waiting_courier' and public.has_role('coordinator'))
      or public.has_role('admin')
    )
  );

-- ─────────────── ratings ───────────────
create policy ratings_select on public.ratings for select
  using (rater_id = auth.uid() or ratee_id = auth.uid() or public.has_role('admin'));

-- ─────────────── badges (ציבורי לקריאה) ───────────────
create policy badges_select on public.user_badges for select using (true);

-- ─────────────── events (צדדי השיבוץ) ───────────────
create policy events_select on public.events for select
  using (
    actor_id = auth.uid()
    or public.has_role('admin')
    or assignment_id in (
      select id from public.assignments
      where donor_id = auth.uid() or courier_id = auth.uid()
         or coordinator_id = auth.uid()
         or recipient_id in (select public.my_recipient_ids())
    )
  );

-- ─────────────── notifications (עצמי) ───────────────
create policy notifications_own on public.notifications for select
  using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────── push_tokens (עצמי) ───────────────
create policy push_own on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────── feed (ציבורי, אנונימי) ───────────────
create policy feed_select on public.feed_events for select using (true);

-- ─────────────── audit (אדמין) ───────────────
create policy audit_admin on public.audit_log for select using (public.has_role('admin'));

-- ─────────────── reports ───────────────
create policy reports_insert on public.reports for insert
  with check (reporter_id = auth.uid());
create policy reports_admin_select on public.reports for select
  using (public.has_role('admin'));
