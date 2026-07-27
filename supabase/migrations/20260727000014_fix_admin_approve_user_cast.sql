-- תיקון: admin_approve_user נכשל עם "column verification_status is of type
-- verification_st but expression is of type text" — ה-CASE מחזיר text וצריך
-- המרה מפורשת ל-enum verification_st.
create or replace function public.admin_approve_user(p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role('admin') then raise exception 'admin only'; end if;
  update public.users
    set verification_status = (case when p_approve then 'approved' else 'rejected' end)::verification_st
    where id = p_user;
  insert into public.audit_log(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), case when p_approve then 'approve_user' else 'reject_user' end, 'user', p_user, jsonb_build_object('approve', p_approve));
end;
$$;
