-- Time4Giving — כלי אדמין: איפוס כללי + מחיקה פר-פריט (לבדיקות)

-- ─────────────── איפוס כל התוכן התפעולי (שומר משתמשים) ───────────────
create or replace function public.admin_reset_all()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  delete from public.ratings;
  delete from public.events;
  delete from public.feed_events;
  delete from public.notifications;
  delete from public.user_badges;
  delete from public.assignments;   -- מפיל events/ratings תלויים ב-cascade
  delete from public.offers;
  delete from public.needs;
  update public.users set
    total_donations = 0, total_units = 0, total_deliveries = 0,
    units_served = 0, rating_avg = 0, rating_count = 0, reputation_level = 'verified';
  insert into public.audit_log(actor_id, action, target_type) values (auth.uid(), 'reset_all', 'system');
end;
$$;

-- ─────────────── מחיקת הצעה בודדת ───────────────
create or replace function public.admin_delete_offer(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  delete from public.assignments where offer_id = p_id;   -- אין cascade מ-offer
  delete from public.offers where id = p_id;
  insert into public.audit_log(actor_id, action, target_type, target_id) values (auth.uid(), 'delete_offer', 'offer', p_id);
end;
$$;

-- ─────────────── מחיקת בקשה בודדת ───────────────
create or replace function public.admin_delete_need(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  delete from public.assignments where need_id = p_id;    -- אין cascade מ-need
  delete from public.needs where id = p_id;
  insert into public.audit_log(actor_id, action, target_type, target_id) values (auth.uid(), 'delete_need', 'need', p_id);
end;
$$;

-- ─────────────── מחיקת שיבוץ בודד ───────────────
create or replace function public.admin_delete_assignment(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  delete from public.assignments where id = p_id;         -- events/ratings ב-cascade
  insert into public.audit_log(actor_id, action, target_type, target_id) values (auth.uid(), 'delete_assignment', 'assignment', p_id);
end;
$$;

-- ─────────────── רשימת תוכן לאדמין (כל הסטטוסים) ───────────────
create or replace function public.admin_list_content()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  v := jsonb_build_object(
    'offers', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'food_type', o.food_type, 'quantity', o.quantity, 'unit_label', o.unit_label,
        'status', o.status, 'donor_name', u.full_name, 'created_at', o.created_at) order by o.created_at desc), '[]'::jsonb)
      from public.offers o left join public.users u on u.id = o.donor_id where o.deleted_at is null),
    'needs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', n.id, 'food_type', n.food_type, 'quantity', n.quantity, 'unit_label', n.unit_label,
        'status', n.status, 'region', n.region, 'recipient', rp.display_name, 'created_at', n.created_at) order by n.created_at desc), '[]'::jsonb)
      from public.needs n left join public.recipient_profiles rp on rp.id = n.recipient_id where n.deleted_at is null),
    'assignments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'status', a.status, 'destination', a.general_destination,
        'donor_name', ud.full_name, 'courier_name', uc.full_name, 'created_at', a.created_at) order by a.created_at desc), '[]'::jsonb)
      from public.assignments a
      left join public.users ud on ud.id = a.donor_id
      left join public.users uc on uc.id = a.courier_id
      where a.deleted_at is null)
  );
  return v;
end;
$$;

grant execute on all functions in schema public to authenticated;
