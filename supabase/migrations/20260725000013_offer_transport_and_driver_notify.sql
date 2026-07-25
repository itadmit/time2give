-- Time4Giving — תרומה עם/בלי שינוע + התראה לנהגים מתנדבים באזור.

-- 1) חשיפת donor_is_courier ב-view (כדי לסמן במפה תרומות "ללא שינוע")
--    העמודה נוספת בסוף — נדרש ל-CREATE OR REPLACE VIEW.
create or replace view public.open_offers_v
with (security_invoker = off) as
  select o.id, o.food_type, o.quantity, o.unit_label, o.kosher, o.vegetarian,
         o.notes, o.photo_url, o.origin_city, o.origin_lat, o.origin_lng,
         o.service_regions, o.ready_at, o.created_at,
         u.full_name as donor_name, u.photo_url as donor_photo,
         u.reputation_level as donor_level, u.rating_avg as donor_rating,
         o.donor_is_courier
  from public.offers o
  join public.users u on u.id = o.donor_id
  where o.status = 'open' and o.deleted_at is null;
grant select on public.open_offers_v to authenticated;

-- 2) תרומה חדשה שצריכה שינוע (donor_is_courier=false) → התראה לכל נהג מתנדב
--    שאזור התרומה נמצא באזורים שהוא סימן (או לכולם אם לא סומן אזור).
--    (מחליף את ההתראה הישנה לרכזים — הרכז אוחד לנהג מתנדב.)
create or replace function public.notify_coordinators_new_offer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- התורם משנע בעצמו — אין צורך בנהג
  if new.donor_is_courier then
    return new;
  end if;
  insert into public.notifications (user_id, channel, title, body, data)
  select u.id, 'in_app', 'תרומה חדשה באזורך 🚗',
         coalesce(new.food_type, 'תרומה') || ' · ' || new.quantity::text || ' ' ||
           coalesce(new.unit_label, '') || ' — צריכה שינוע',
         jsonb_build_object('offer_id', new.id)
  from public.users u
  where 'courier' = any(u.roles)
    and u.deleted_at is null
    and (coalesce(array_length(new.service_regions, 1), 0) = 0 or u.service_regions && new.service_regions);
  return new;
end;
$$;
