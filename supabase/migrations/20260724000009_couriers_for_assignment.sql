-- Time4Giving — מועמדים לשיבוץ שינוע, מדורגים לפי כיסוי אזור / זמינות / מוניטין
-- (הרכז לא יכול לקרוא service_regions של אחרים ישירות בגלל RLS, לכן RPC security definer)

create or replace function public.couriers_for_assignment(p_assignment_id uuid)
returns table(
  id uuid,
  full_name text,
  photo_url text,
  reputation_level reputation_level,
  rating_avg numeric,
  rating_count int,
  total_deliveries int,
  service_regions region[],
  covers_region boolean,
  active_deliveries int
) language plpgsql security definer set search_path = public as $$
declare v_region region;
begin
  if not (public.has_role('coordinator') or public.has_role('admin')) then
    raise exception 'only coordinator';
  end if;
  select general_destination into v_region
    from public.assignments where id = p_assignment_id and deleted_at is null;
  if v_region is null then raise exception 'assignment not found'; end if;

  return query
    select
      u.id, u.full_name, u.photo_url,
      u.reputation_level, u.rating_avg, u.rating_count, u.total_deliveries,
      u.service_regions,
      (v_region = any(u.service_regions)) as covers_region,
      (select count(*) from public.assignments a
         where a.courier_id = u.id
           and a.status in ('courier_assigned','picked_up','on_the_way')
           and a.deleted_at is null)::int as active_deliveries
    from public.users u
    where 'courier' = any(u.roles)
      and u.deleted_at is null
      and u.verification_status = 'approved'
    order by
      (v_region = any(u.service_regions)) desc,   -- מכסה את אזור היעד קודם
      active_deliveries asc,                       -- הפנוי ביותר
      u.rating_avg desc,                           -- הדירוג הגבוה ביותר
      u.total_deliveries desc;                     -- הכי מנוסה
end;
$$;

grant execute on all functions in schema public to authenticated;
