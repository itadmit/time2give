-- Time4Giving — Jobs מתוזמנים (ARCHITECTURE §13) + הסתרת פרטי קשר לאחר סגירה.

create extension if not exists pg_cron;

-- ─────────────── סגירה אוטומטית של שיבוצים ישנים (מסתיר פרטי קשר) ───────────────
create or replace function public.close_old_assignments()
returns void language sql security definer set search_path = public as $$
  update public.assignments set status = 'closed'
    where status in ('rated','confirmed')
      and created_at < now() - interval '7 days'
      and deleted_at is null;
$$;

-- ─────────────── סיכום פיד יומי (מצרפי, אנונימי) ───────────────
create or replace function public.daily_feed_summary()
returns void language plpgsql security definer set search_path = public as $$
declare v_don int; v_units int;
begin
  select count(*),
         coalesce(sum(case when a.need_id is not null then n.quantity else o.quantity end), 0)
    into v_don, v_units
  from public.assignments a
  left join public.needs n on n.id = a.need_id
  left join public.offers o on o.id = a.offer_id
  where a.status in ('confirmed','rated','closed')
    and a.created_at >= date_trunc('day', now());

  if v_don > 0 then
    insert into public.feed_events(type, payload)
    values ('daily_summary', jsonb_build_object('text', format('היום חולקו %s מנות ב-%s תרומות 🙏', v_units, v_don)));
  end if;
end;
$$;

-- ─────────────── reveal_phone: הסתרת פרטי קשר לאחר סגירה ───────────────
create or replace function public.reveal_phone(p_assignment_id uuid)
returns table(role text, name text, phone text)
language plpgsql security definer set search_path = public as $$
declare v_a record; v_is_party boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into v_a from public.assignments where id = p_assignment_id and deleted_at is null;
  if v_a is null then raise exception 'assignment not found'; end if;
  if v_a.status = 'closed' then raise exception 'contacts hidden'; end if;  -- פרטי קשר מוסתרים לאחר סגירה

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

grant execute on all functions in schema public to authenticated;

-- ─────────────── תזמון (pg_cron) ───────────────
select cron.schedule('expire-stale',  '0 * * * *',  $$select public.expire_stale()$$);        -- כל שעה
select cron.schedule('close-old',      '30 2 * * *', $$select public.close_old_assignments()$$); -- יומי 02:30
select cron.schedule('daily-feed',     '0 20 * * *', $$select public.daily_feed_summary()$$);   -- יומי 20:00
