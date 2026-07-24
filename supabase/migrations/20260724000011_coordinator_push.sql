-- ─────────────── פוש: חיבור אוטומטי + התראה לרכזים ───────────────
-- (1) כל notifications חדש → קריאה ל-edge function send-notification (Expo push),
--     ישירות מה-DB דרך pg_net — מחליף את הצורך ב-Database Webhook ידני בדשבורד.
-- (2) תרומה חדשה → התראה לכל רכז מאושר שמכסה את אזור התרומה.

create extension if not exists pg_net;

-- (1) notifications → Expo push
create or replace function public.push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://lmutysdplrwelefdostz.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

drop trigger if exists push_after_notification on public.notifications;
create trigger push_after_notification
  after insert on public.notifications
  for each row execute function public.push_on_notification();

-- (2) תרומה חדשה → התראה לרכזים מאושרים המכסים את האזור (או לכולם אם אין אזורים)
create or replace function public.notify_coordinators_new_offer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, channel, title, body, data)
  select u.id, 'in_app', 'תרומה חדשה זמינה',
         coalesce(new.food_type, 'תרומה') || ' · ' || new.quantity::text || ' ' || coalesce(new.unit_label, ''),
         jsonb_build_object('offer_id', new.id)
  from public.users u
  where 'coordinator' = any(u.roles)
    and u.verification_status = 'approved'
    and u.deleted_at is null
    and (coalesce(array_length(new.service_regions, 1), 0) = 0 or u.service_regions && new.service_regions);
  return new;
end;
$$;

drop trigger if exists notify_coordinators_after_offer on public.offers;
create trigger notify_coordinators_after_offer
  after insert on public.offers
  for each row execute function public.notify_coordinators_new_offer();
