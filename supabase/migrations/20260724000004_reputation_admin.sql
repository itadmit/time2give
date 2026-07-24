-- Time4Giving — מוניטין, תגים, רמות, סינון מיקום, אדמין, KPIs, פקיעה.

-- ─────────────── סינון מיקום מטקסט חופשי (guardrail §16) ───────────────
create or replace function public.scrub_location(txt text)
returns text language sql immutable as $$
  select case when txt is null then null else
    regexp_replace(
      regexp_replace(txt, '\d{1,3}\.\d{3,}', '▇', 'g'),  -- קואורדינטות
      '\d{4,}', '▇', 'g'                                   -- רצפי ספרות ארוכים
    )
  end;
$$;

create or replace function public.scrub_notes_trg()
returns trigger language plpgsql as $$
begin
  new.notes := public.scrub_location(new.notes);
  return new;
end;
$$;

create trigger scrub_needs before insert or update on public.needs
  for each row execute function public.scrub_notes_trg();
create trigger scrub_offers before insert or update on public.offers
  for each row execute function public.scrub_notes_trg();

-- ─────────────── מוניטין: עדכון מצטבר + תגים + רמה בעת confirmed ───────────────
create or replace function public.award_badges(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_don int; v_del int; v_completed int; v_lvl reputation_level;
begin
  select total_donations, total_deliveries into v_don, v_del from public.users where id = p_user;
  -- תגי כמות תרומות
  if v_don >= 1    then insert into public.user_badges(user_id,badge_type) values (p_user,'תורם ראשון')  on conflict do nothing; end if;
  if v_don >= 10   then insert into public.user_badges(user_id,badge_type) values (p_user,'10 תרומות')    on conflict do nothing; end if;
  if v_don >= 100  then insert into public.user_badges(user_id,badge_type) values (p_user,'תורם זהב')     on conflict do nothing; end if;
  if v_don >= 500  then insert into public.user_badges(user_id,badge_type) values (p_user,'500 תרומות')   on conflict do nothing; end if;
  if v_don >= 1000 then insert into public.user_badges(user_id,badge_type) values (p_user,'1000 תרומות')  on conflict do nothing; end if;

  v_completed := coalesce(v_don,0) + coalesce(v_del,0);
  v_lvl := case
    when v_completed >= 200 then 'national_volunteer'
    when v_completed >= 50  then 'community_leader'
    when v_completed >= 10  then 'elite'
    when v_completed >= 3   then 'trusted'
    else 'verified' end;
  update public.users set reputation_level = v_lvl where id = p_user;
end;
$$;

create or replace function public.on_assignment_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_qty int; v_unit text; v_food text; v_donor_name text;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    -- כמות מה-Need או מה-Offer
    select quantity, unit_label, food_type into v_qty, v_unit, v_food from public.needs where id = new.need_id;
    if v_qty is null then
      select quantity, unit_label, food_type into v_qty, v_unit, v_food from public.offers where id = new.offer_id;
    end if;
    v_qty := coalesce(v_qty, 0);

    -- תורם
    update public.users
      set total_donations = total_donations + 1,
          total_units = total_units + v_qty,
          units_served = units_served + 1
      where id = new.donor_id;
    perform public.award_badges(new.donor_id);

    -- משנע
    if new.courier_id is not null then
      update public.users set total_deliveries = total_deliveries + 1 where id = new.courier_id;
      perform public.award_badges(new.courier_id);
    end if;

    -- פיד קהילתי (אנונימי ליעד — מזכיר תורם + כמות + אזור בלבד)
    select full_name into v_donor_name from public.users where id = new.donor_id;
    insert into public.feed_events(type, actor_id, payload)
    values ('donation', new.donor_id,
      jsonb_build_object('text', format('%s תרם %s %s לאזור %s 🙏', coalesce(v_donor_name,'תורם'), v_qty, coalesce(v_unit,'מנות'), new.general_destination)));
  end if;
  return new;
end;
$$;

create trigger assignment_confirmed after update on public.assignments
  for each row execute function public.on_assignment_confirmed();

-- ─────────────── אדמין: אישור משתמשים ───────────────
create or replace function public.admin_approve_user(p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  update public.users set verification_status = case when p_approve then 'approved' else 'rejected' end
    where id = p_user;
  insert into public.audit_log(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), case when p_approve then 'approve_user' else 'reject_user' end, 'user', p_user, jsonb_build_object('approve', p_approve));
end;
$$;

create or replace function public.admin_pending_users()
returns setof public.users language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  return query select * from public.users
    where verification_status = 'pending' and deleted_at is null
      and roles && array['recipient','coordinator','courier','org_member']::user_role[]
    order by created_at desc;
end;
$$;

-- ─────────────── אדמין: KPIs ───────────────
create or replace function public.admin_kpis()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_total int; v_cancelled int; v_confirmed int;
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  select count(*) into v_total from public.assignments where deleted_at is null;
  select count(*) into v_cancelled from public.assignments where status = 'cancelled';
  select count(*) into v_confirmed from public.assignments where status in ('confirmed','rated','closed');
  v := jsonb_build_object(
    'users', (select count(*) from public.users where deleted_at is null),
    'donors', (select count(*) from public.users where 'donor' = any(roles)),
    'couriers', (select count(*) from public.users where 'courier' = any(roles)),
    'recipients', (select count(*) from public.recipient_profiles where deleted_at is null),
    'open_needs', (select count(*) from public.needs where status = 'open'),
    'open_offers', (select count(*) from public.offers where status = 'open'),
    'assignments_total', v_total,
    'assignments_confirmed', v_confirmed,
    'assignments_cancelled', v_cancelled,
    'cancelled_pct', case when v_total > 0 then round(100.0 * v_cancelled / v_total, 1) else 0 end,
    'total_units', (select coalesce(sum(total_units),0) from public.users),
    'pending_approvals', (select count(*) from public.users where verification_status = 'pending' and roles && array['recipient','coordinator','courier']::user_role[])
  );
  return v;
end;
$$;

-- ─────────────── פקיעה (מיועד ל-pg_cron) ───────────────
create or replace function public.expire_stale()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.offers set status = 'expired'
    where status = 'open' and expires_at is not null and expires_at < now() and deleted_at is null;
  update public.needs set status = 'expired'
    where status = 'open' and expires_at is not null and expires_at < now() and deleted_at is null;
end;
$$;

grant execute on all functions in schema public to authenticated;
