-- ─────────────── Integration config (admin-editable key/value) ───────────────
-- משמש לאחסון פרטי אינטגרציות שהאדמין מזין (למשל token + instance_id של iBot WhatsApp).
-- edge functions קוראים דרך service role (עוקף RLS); רק אדמין קורא/כותב דרך ה-API.

create table if not exists public.integration_config (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.integration_config enable row level security;

-- אין policy ל-anon/authenticated רגיל → אין גישה ישירה. הגישה רק דרך ה-RPCs (security definer)
-- ו-service role של edge functions.

-- ─────────────── RPCs לאדמין ───────────────
create or replace function public.admin_get_integration_config()
returns setof public.integration_config
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  return query select * from public.integration_config order by key;
end;
$$;

create or replace function public.admin_set_integration_config(p_key text, p_value text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  insert into public.integration_config(key, value, updated_at)
  values (p_key, nullif(p_value, ''), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.audit_log(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'set_integration_config', 'config', null, jsonb_build_object('key', p_key));
end;
$$;

grant execute on function public.admin_get_integration_config() to authenticated;
grant execute on function public.admin_set_integration_config(text, text) to authenticated;

-- שורות ריקות התחלתיות (כדי שהאדמין יראה את השדות למילוי)
insert into public.integration_config(key, value) values
  ('whatsapp_token', null),
  ('whatsapp_instance_id', null)
on conflict (key) do nothing;
