-- נהג מתנדב שלקח משלוח יכול לבטל ולשחרר אותו — המשלוח חוזר ל"ממתין לשינוע"
-- ונהג אחר יכול לקחת אותו. אפשרי רק לפני האיסוף (courier_assigned).
create or replace function public.release_delivery(p_assignment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_a record; v_driver record;
begin
  select * into v_a from public.assignments where id = p_assignment_id and deleted_at is null for update;
  if v_a is null then raise exception 'assignment not found'; end if;
  if not (v_a.courier_id = auth.uid() or public.has_role('admin')) then
    raise exception 'not your delivery';
  end if;
  if v_a.status <> 'courier_assigned' then
    raise exception 'can release only before pickup';
  end if;

  update public.assignments
    set status = 'waiting_courier', courier_id = null, coordinator_id = null
  where id = p_assignment_id;

  insert into public.events (assignment_id, type, actor_id, payload)
  values (p_assignment_id, 'transport_requested', auth.uid(), jsonb_build_object('released', true));

  perform public.notify(v_a.donor_id, 'המשלוח שוחרר',
    'הנהג ביטל — המשלוח שוב פתוח וממתין לנהג אחר', jsonb_build_object('assignment_id', p_assignment_id));

  -- התראה לנהגים מתנדבים באזור שהמשלוח שוב פתוח לאיסוף
  for v_driver in
    select id from public.users
    where 'courier' = any(roles) and v_a.general_destination = any(service_regions)
      and deleted_at is null and id <> auth.uid()
  loop
    perform public.notify(v_driver.id, 'משלוח פתוח לאיסוף',
      format('אזור %s — נדרש נהג מתנדב', v_a.general_destination),
      jsonb_build_object('assignment_id', p_assignment_id, 'region', v_a.general_destination));
  end loop;
end;
$$;

grant execute on function public.release_delivery(uuid) to authenticated;
