-- אחסון תמונות תרומות (Supabase Storage). באקט ציבורי לקריאה, העלאה למחוברים בלבד.
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- קריאה ציבורית
drop policy if exists "photos public read" on storage.objects;
create policy "photos public read" on storage.objects
  for select using (bucket_id = 'photos');

-- העלאה למשתמשים מחוברים
drop policy if exists "photos auth upload" on storage.objects;
create policy "photos auth upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

-- עדכון/מחיקה של קבצים שהמשתמש העלה
drop policy if exists "photos owner update" on storage.objects;
create policy "photos owner update" on storage.objects
  for update to authenticated using (bucket_id = 'photos' and owner = auth.uid());
drop policy if exists "photos owner delete" on storage.objects;
create policy "photos owner delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos' and owner = auth.uid());
