-- Time4Giving — תוויות אזור בעברית בטקסטים שנוצרים ב-SQL (פיד + התראות)

-- ─────────────── מיפוי enum→עברית (תואם ל-src/lib/regions.ts) ───────────────
create or replace function public.region_label_he(r region)
returns text language sql immutable as $$
  select case r
    when 'otef' then 'עוטף'
    when 'beer_sheva_negev_north' then 'באר שבע ונגב צפוני'
    when 'negev_south' then 'נגב דרומי'
    when 'arava_dead_sea' then 'הערבה וים המלח'
    when 'carmel_haifa' then 'כרמל וחיפה'
    when 'galil_west' then 'גליל מערבי'
    when 'galil_upper' then 'גליל עליון'
    when 'golan' then 'רמת הגולן'
    when 'sharon' then 'השרון'
    when 'gush_dan' then 'גוש דן'
    when 'jerusalem_hills' then 'ירושלים והרי יהודה'
    when 'judea_samaria' then 'יהודה ושומרון'
    when 'jordan_valley' then 'בקעת הירדן'
    else r::text end;
$$;

-- ─────────────── פיד קהילתי: אזור בעברית ───────────────
create or replace function public.on_assignment_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_qty int; v_unit text; v_food text; v_donor_name text;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    select quantity, unit_label, food_type into v_qty, v_unit, v_food from public.needs where id = new.need_id;
    if v_qty is null then
      select quantity, unit_label, food_type into v_qty, v_unit, v_food from public.offers where id = new.offer_id;
    end if;
    v_qty := coalesce(v_qty, 0);

    update public.users
      set total_donations = total_donations + 1,
          total_units = total_units + v_qty,
          units_served = units_served + 1
      where id = new.donor_id;
    perform public.award_badges(new.donor_id);

    if new.courier_id is not null then
      update public.users set total_deliveries = total_deliveries + 1 where id = new.courier_id;
      perform public.award_badges(new.courier_id);
    end if;

    select full_name into v_donor_name from public.users where id = new.donor_id;
    insert into public.feed_events(type, actor_id, payload)
    values ('donation', new.donor_id,
      jsonb_build_object('text', format('%s תרם %s %s לאזור %s 🙏',
        coalesce(v_donor_name,'תורם'), v_qty, coalesce(v_unit,'מנות'),
        public.region_label_he(new.general_destination))));
  end if;
  return new;
end;
$$;

-- ─────────────── התראות רכז: אזור בעברית ───────────────
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
        format('אזור %s — נדרש שיבוץ משנע', public.region_label_he(v_need.region)),
        jsonb_build_object('assignment_id', v_assign, 'region', v_need.region));
    end loop;
  end if;

  return v_assign;
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
        format('אזור %s — נדרש שיבוץ משנע', public.region_label_he(v_recipient.region)),
        jsonb_build_object('assignment_id', v_assign));
    end loop;
  end if;

  return v_assign;
end;
$$;

grant execute on all functions in schema public to authenticated;
