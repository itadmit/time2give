-- Time4Giving — איחוד "רכז" ו"נהג" למשתמש אחד: "נהג מתנדב".
-- במקום שרכז ישבץ נהג ידנית, הנהג המתנדב תופס את המשלוח בעצמו מהלוח.

-- ─────────────── 1) נראות: נהג מתנדב רואה משלוחים פתוחים (waiting_courier) ───────────────
drop policy if exists assignments_parties_select on public.assignments;
create policy assignments_parties_select on public.assignments for select
  using (
    deleted_at is null and (
      donor_id = auth.uid()
      or courier_id = auth.uid()
      or coordinator_id = auth.uid()
      or recipient_id in (select public.my_recipient_ids())
      or (status = 'waiting_courier' and (public.has_role('courier') or public.has_role('coordinator')))
      or public.has_role('admin')
    )
  );

-- ─────────────── 2) נהג מתנדב משבץ את עצמו למשלוח פתוח ───────────────
-- מחליף את השיבוץ הידני של הרכז (assign_courier נשאר לאדמין/מקרי קצה).
create or replace function public.claim_delivery(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_a record; v_recipient_user uuid;
begin
  if not (public.has_role('courier') or public.has_role('coordinator') or public.has_role('admin')) then
    raise exception 'only volunteer driver';
  end if;
  -- נעילת השורה כדי שלא שני נהגים יתפסו את אותו משלוח בו-זמנית
  select * into v_a from public.assignments where id = p_assignment_id and deleted_at is null for update;
  if v_a is null then raise exception 'assignment not found'; end if;
  if v_a.status <> 'waiting_courier' then raise exception 'not waiting for courier'; end if;

  update public.assignments
    set courier_id = auth.uid(), coordinator_id = auth.uid(), status = 'courier_assigned'
  where id = p_assignment_id;

  insert into public.events (assignment_id, type, actor_id, payload)
  values (p_assignment_id, 'courier_assigned', auth.uid(),
          jsonb_build_object('courier_id', auth.uid(), 'self_claimed', true));

  perform public.notify(v_a.donor_id, 'נהג מתנדב בדרך', 'נהג מתנדב לקח את המשלוח שלך',
    jsonb_build_object('assignment_id', p_assignment_id));

  select user_id into v_recipient_user from public.recipient_profiles where id = v_a.recipient_id;
  if v_recipient_user is not null then
    perform public.notify(v_recipient_user, 'נהג מתנדב בדרך', 'נהג מתנדב לקח את המשלוח אליך',
      jsonb_build_object('assignment_id', p_assignment_id));
  end if;
end;
$$;

grant execute on function public.claim_delivery(uuid) to authenticated;

-- ─────────────── 3) התראת "נדרש שינוע" → לנהגים מתנדבים באזור (במקום רכזים) ───────────────
-- הגדרה מחדש של commit_to_need + claim_offer: אותה לוגיקה, רק לולאת ההתראה עברה
-- מ-'coordinator' ל-'courier', והטקסט עודכן ל"נהג מתנדב".

create or replace function public.commit_to_need(
  p_need_id uuid, p_self_transport boolean, p_notes text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_need record; v_assign uuid; v_recipient_user uuid; v_driver record; v_status assignment_status;
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
    for v_driver in
      select id from public.users
      where 'courier' = any(roles) and v_need.region = any(service_regions) and deleted_at is null
    loop
      perform public.notify(v_driver.id, 'משלוח פתוח לאיסוף',
        format('אזור %s — נדרש נהג מתנדב', v_need.region),
        jsonb_build_object('assignment_id', v_assign, 'region', v_need.region));
    end loop;
  end if;

  return v_assign;
end;
$$;

create or replace function public.claim_offer(
  p_offer_id uuid, p_need_transport boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_offer record; v_recipient record; v_assign uuid; v_status assignment_status; v_driver record;
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
    for v_driver in
      select id from public.users
      where 'courier' = any(roles) and v_recipient.region = any(service_regions) and deleted_at is null
    loop
      perform public.notify(v_driver.id, 'משלוח פתוח לאיסוף',
        format('אזור %s — נדרש נהג מתנדב', v_recipient.region),
        jsonb_build_object('assignment_id', v_assign, 'region', v_recipient.region));
    end loop;
  end if;

  return v_assign;
end;
$$;
