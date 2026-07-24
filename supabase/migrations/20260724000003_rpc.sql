-- Time4Giving — RPC + Views (ARCHITECTURE §11)
-- כל הכתיבה הרגישה עוברת פה, עם security definer + בדיקות.

-- ─────────────── notify helper ───────────────
create or replace function public.notify(p_user uuid, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, channel, title, body, data)
  values (p_user, 'in_app', p_title, p_body, p_data);
$$;

-- ─────────────── onboarding ───────────────
create or replace function public.set_my_profile(
  p_full_name text,
  p_photo_url text,
  p_roles user_role[],
  p_service_regions region[] default '{}',
  p_capabilities text[] default '{}'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.users
    set full_name = p_full_name,
        photo_url = p_photo_url,
        roles = coalesce(p_roles, roles),
        service_regions = coalesce(p_service_regions, service_regions),
        capabilities = coalesce(p_capabilities, capabilities),
        onboarded = true
  where id = auth.uid();
end;
$$;

create or replace function public.upsert_recipient_profile(
  p_recipient_type recipient_type,
  p_region region,
  p_display_name text default null,
  p_org_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into v_id from public.recipient_profiles
    where user_id = auth.uid() and deleted_at is null limit 1;
  if v_id is null then
    insert into public.recipient_profiles (user_id, recipient_type, region, display_name, org_id)
    values (auth.uid(), p_recipient_type, p_region, p_display_name, p_org_id)
    returning id into v_id;
  else
    update public.recipient_profiles
      set recipient_type = p_recipient_type, region = p_region,
          display_name = p_display_name, org_id = p_org_id
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- ─────────────── זרימה A: Need ───────────────
create or replace function public.create_need(
  p_region region, p_food_type text, p_quantity int,
  p_unit_label text default 'מנות', p_needed_at timestamptz default null, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_recipient uuid; v_need uuid; v_donor record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into v_recipient from public.recipient_profiles
    where user_id = auth.uid() and deleted_at is null limit 1;
  if v_recipient is null then raise exception 'no recipient profile'; end if;

  insert into public.needs (recipient_id, region, food_type, quantity, unit_label, needed_at, notes)
  values (v_recipient, p_region, p_food_type, p_quantity, p_unit_label, p_needed_at, p_notes)
  returning id into v_need;

  insert into public.events (need_id, type, actor_id, payload)
  values (v_need, 'need_created', auth.uid(), jsonb_build_object('region', p_region, 'quantity', p_quantity));

  -- fan-out Push לתורמים שמכסים את האזור
  for v_donor in
    select id from public.users
    where 'donor' = any(roles) and p_region = any(service_regions)
      and deleted_at is null and id <> auth.uid()
  loop
    perform public.notify(
      v_donor.id, 'בקשה חדשה באזורך',
      format('דרושים %s %s — %s', p_quantity, p_unit_label, p_food_type),
      jsonb_build_object('type','need','need_id',v_need,'region',p_region)
    );
  end loop;

  return v_need;
end;
$$;

create or replace function public.commit_to_need(
  p_need_id uuid, p_self_transport boolean, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_need record; v_assign uuid; v_recipient_user uuid; v_coord record; v_status assignment_status;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_need from public.needs where id = p_need_id and deleted_at is null;
  if v_need is null then raise exception 'need not found'; end if;
  if v_need.status <> 'open' then raise exception 'need not open'; end if;

  v_status := case when p_self_transport then 'committed' else 'waiting_courier' end;

  insert into public.assignments (need_id, donor_id, recipient_id, self_transport, general_destination, status)
  values (p_need_id, auth.uid(), v_need.recipient_id, p_self_transport, v_need.region, v_status)
  returning id into v_assign;

  update public.needs set status = 'committed' where id = p_need_id;

  insert into public.events (assignment_id, need_id, type, actor_id)
  values (v_assign, p_need_id, 'committed', auth.uid());

  select user_id into v_recipient_user from public.recipient_profiles where id = v_need.recipient_id;
  perform public.notify(v_recipient_user, 'תורם התחייב לבקשתך',
    'מצאנו תורם שמתחייב להכין את התרומה', jsonb_build_object('assignment_id', v_assign));

  if not p_self_transport then
    insert into public.events (assignment_id, type, actor_id) values (v_assign, 'transport_requested', auth.uid());
    for v_coord in
      select id from public.users
      where 'coordinator' = any(roles) and v_need.region = any(service_regions) and deleted_at is null
    loop
      perform public.notify(v_coord.id, 'תרומה זקוקה לשינוע',
        format('אזור %s — נדרש שיבוץ משנע', v_need.region),
        jsonb_build_object('assignment_id', v_assign, 'region', v_need.region));
    end loop;
  end if;

  return v_assign;
end;
$$;

-- ─────────────── זרימה B: Offer ───────────────
create or replace function public.publish_offer(
  p_food_type text, p_quantity int, p_unit_label text,
  p_service_regions region[], p_origin_city text default null,
  p_origin_lat double precision default null, p_origin_lng double precision default null,
  p_kosher boolean default false, p_vegetarian boolean default false,
  p_notes text default null, p_photo_url text default null,
  p_ready_at timestamptz default null, p_donor_is_courier boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_offer uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.offers (donor_id, food_type, quantity, unit_label, service_regions,
    origin_city, origin_lat, origin_lng, kosher, vegetarian, notes, photo_url, ready_at, donor_is_courier)
  values (auth.uid(), p_food_type, p_quantity, p_unit_label, p_service_regions,
    p_origin_city, p_origin_lat, p_origin_lng, p_kosher, p_vegetarian, p_notes, p_photo_url, p_ready_at, p_donor_is_courier)
  returning id into v_offer;

  insert into public.events (offer_id, type, actor_id, payload)
  values (v_offer, 'offer_published', auth.uid(), jsonb_build_object('quantity', p_quantity));
  return v_offer;
end;
$$;

create or replace function public.claim_offer(
  p_offer_id uuid, p_need_transport boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_offer record; v_recipient record; v_assign uuid; v_status assignment_status; v_coord record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_offer from public.offers where id = p_offer_id and deleted_at is null;
  if v_offer is null then raise exception 'offer not found'; end if;
  if v_offer.status <> 'open' then raise exception 'offer not open'; end if;

  select * into v_recipient from public.recipient_profiles
    where user_id = auth.uid() and deleted_at is null limit 1;
  if v_recipient is null then raise exception 'no recipient profile'; end if;

  v_status := case when p_need_transport then 'waiting_courier' else 'committed' end;

  insert into public.assignments (offer_id, donor_id, recipient_id, self_transport, general_destination, status)
  values (p_offer_id, v_offer.donor_id, v_recipient.id, false, v_recipient.region, v_status)
  returning id into v_assign;

  update public.offers set status = 'claimed' where id = p_offer_id;

  insert into public.events (assignment_id, offer_id, type, actor_id)
  values (v_assign, p_offer_id, 'offer_claimed', auth.uid());

  perform public.notify(v_offer.donor_id, 'התרומה שלך נבחרה',
    'מקבל בחר את התרומה שפרסמת', jsonb_build_object('assignment_id', v_assign));

  if p_need_transport then
    insert into public.events (assignment_id, type, actor_id) values (v_assign, 'transport_requested', auth.uid());
    for v_coord in
      select id from public.users
      where 'coordinator' = any(roles) and v_recipient.region = any(service_regions) and deleted_at is null
    loop
      perform public.notify(v_coord.id, 'תרומה זקוקה לשינוע',
        format('אזור %s — נדרש שיבוץ משנע', v_recipient.region),
        jsonb_build_object('assignment_id', v_assign));
    end loop;
  end if;

  return v_assign;
end;
$$;

-- ─────────────── רכז: שיבוץ משנע ───────────────
create or replace function public.assign_courier(p_assignment_id uuid, p_courier_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_a record;
begin
  if not (public.has_role('coordinator') or public.has_role('admin')) then
    raise exception 'only coordinator';
  end if;
  select * into v_a from public.assignments where id = p_assignment_id and deleted_at is null;
  if v_a is null then raise exception 'assignment not found'; end if;
  if v_a.status <> 'waiting_courier' then raise exception 'not waiting for courier'; end if;

  update public.assignments
    set courier_id = p_courier_id, coordinator_id = auth.uid(), status = 'courier_assigned'
  where id = p_assignment_id;

  insert into public.events (assignment_id, type, actor_id, payload)
  values (p_assignment_id, 'courier_assigned', auth.uid(), jsonb_build_object('courier_id', p_courier_id));

  perform public.notify(p_courier_id, 'שובצת למשלוח', 'קיבלת שיבוץ להובלת תרומה',
    jsonb_build_object('assignment_id', p_assignment_id));
  perform public.notify(v_a.donor_id, 'שובץ משנע', 'רכז שיבץ משנע לתרומה שלך',
    jsonb_build_object('assignment_id', p_assignment_id));
end;
$$;

-- ─────────────── מעבר מצב גנרי ───────────────
create or replace function public.advance_assignment(p_assignment_id uuid, p_new_status assignment_status)
returns void language plpgsql security definer set search_path = public as $$
declare v_a record; v_ok boolean := false; v_recipient_user uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_a from public.assignments where id = p_assignment_id and deleted_at is null;
  if v_a is null then raise exception 'assignment not found'; end if;

  -- מעברים חוקיים
  v_ok := case
    when v_a.status = 'committed' and p_new_status = 'picked_up' and v_a.self_transport then true
    when v_a.status = 'committed' and p_new_status in ('delivered','cancelled') then true
    when v_a.status = 'courier_assigned' and p_new_status = 'picked_up' then true
    when v_a.status = 'waiting_courier' and p_new_status in ('picked_up','cancelled') then true
    when v_a.status = 'picked_up' and p_new_status = 'on_the_way' then true
    when v_a.status = 'on_the_way' and p_new_status = 'delivered' then true
    when v_a.status = 'delivered' and p_new_status = 'confirmed' then true
    when v_a.status = 'confirmed' and p_new_status in ('rated','closed') then true
    when v_a.status = 'rated' and p_new_status = 'closed' then true
    else false
  end;
  if not v_ok then raise exception 'illegal transition % -> %', v_a.status, p_new_status; end if;

  update public.assignments set status = p_new_status where id = p_assignment_id;
  insert into public.events (assignment_id, type, actor_id, payload)
  values (p_assignment_id,
    (case p_new_status
      when 'picked_up' then 'picked_up'
      when 'on_the_way' then 'on_the_way'
      when 'delivered' then 'delivered'
      when 'confirmed' then 'confirmed'
      when 'rated' then 'rated'
      when 'cancelled' then 'cancelled'
      else 'committed' end)::event_type,
    auth.uid(), jsonb_build_object('status', p_new_status));

  select user_id into v_recipient_user from public.recipient_profiles where id = v_a.recipient_id;
  if p_new_status = 'delivered' and v_recipient_user is not null then
    perform public.notify(v_recipient_user, 'התרומה נמסרה', 'אנא אשר קבלה', jsonb_build_object('assignment_id', p_assignment_id));
  elsif p_new_status = 'confirmed' then
    perform public.notify(v_a.donor_id, 'אושרה קבלה', 'המקבל אישר את קבלת התרומה 🙏', jsonb_build_object('assignment_id', p_assignment_id));
  end if;
end;
$$;

-- ─────────────── חשיפת טלפון (אחרי התאמה + audit) ───────────────
create or replace function public.reveal_phone(p_assignment_id uuid)
returns table(role text, name text, phone text)
language plpgsql security definer set search_path = public as $$
declare v_a record; v_is_party boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_a from public.assignments where id = p_assignment_id and deleted_at is null;
  if v_a is null then raise exception 'assignment not found'; end if;

  v_is_party := (v_a.donor_id = auth.uid() or v_a.courier_id = auth.uid() or v_a.coordinator_id = auth.uid()
    or v_a.recipient_id in (select public.my_recipient_ids()) or public.has_role('admin'));
  if not v_is_party then raise exception 'not a party'; end if;

  update public.assignments set phone_revealed_at = coalesce(phone_revealed_at, now()) where id = p_assignment_id;
  insert into public.audit_log (actor_id, action, target_type, target_id)
  values (auth.uid(), 'reveal_phone', 'assignment', p_assignment_id);

  return query
    select 'donor'::text, u.full_name, u.phone from public.users u
      where u.id = v_a.donor_id and u.id <> auth.uid()
    union all
    select 'courier'::text, u.full_name, u.phone from public.users u
      where v_a.courier_id is not null and u.id = v_a.courier_id and u.id <> auth.uid()
    union all
    select 'recipient'::text, u.full_name, u.phone from public.users u
      join public.recipient_profiles rp on rp.user_id = u.id
      where rp.id = v_a.recipient_id and u.id <> auth.uid();
end;
$$;

-- ─────────────── דירוג ───────────────
create or replace function public.submit_rating(p_assignment_id uuid, p_ratee_id uuid, p_score int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_a record; v_avg numeric; v_cnt int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_a from public.assignments where id = p_assignment_id and deleted_at is null;
  if v_a is null then raise exception 'assignment not found'; end if;
  if v_a.status not in ('confirmed','rated','closed') then raise exception 'not ready for rating'; end if;

  insert into public.ratings (assignment_id, rater_id, ratee_id, score, comment)
  values (p_assignment_id, auth.uid(), p_ratee_id, p_score, p_comment)
  on conflict (assignment_id, rater_id) do update set score = excluded.score, comment = excluded.comment;

  select round(avg(score),2), count(*) into v_avg, v_cnt from public.ratings where ratee_id = p_ratee_id;
  update public.users set rating_avg = v_avg, rating_count = v_cnt where id = p_ratee_id;

  if v_a.status = 'confirmed' then
    update public.assignments set status = 'rated' where id = p_assignment_id;
  end if;
end;
$$;

-- ─────────────── VIEWS לקריאה נוחה ───────────────
create view public.open_offers_v
with (security_invoker = off) as
  select o.id, o.food_type, o.quantity, o.unit_label, o.kosher, o.vegetarian,
         o.notes, o.photo_url, o.origin_city, o.origin_lat, o.origin_lng,
         o.service_regions, o.ready_at, o.created_at,
         u.full_name as donor_name, u.photo_url as donor_photo,
         u.reputation_level as donor_level, u.rating_avg as donor_rating
  from public.offers o
  join public.users u on u.id = o.donor_id
  where o.status = 'open' and o.deleted_at is null;
grant select on public.open_offers_v to authenticated;

create view public.open_needs_v
with (security_invoker = off) as
  select n.id, n.region, n.food_type, n.quantity, n.unit_label, n.needed_at, n.notes, n.created_at,
         rp.recipient_type, rp.display_name
  from public.needs n
  join public.recipient_profiles rp on rp.id = n.recipient_id
  where n.status = 'open' and n.deleted_at is null;
grant select on public.open_needs_v to authenticated;

-- ─────────────── grants ───────────────
grant execute on all functions in schema public to authenticated;
