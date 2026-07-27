-- חוות דעת לפרופיל ציבורי.
-- 1) דירוג יכול להתקיים גם בלי שיבוץ (חוות דעת היסטוריות/דמו). ה-RPC האמיתי עדיין
--    מספק assignment_id, אז דירוגים אמיתיים לא נפגעים.
alter table public.ratings alter column assignment_id drop not null;

-- 2) view ציבורי לחוות דעת — כדי שכל משתמש יוכל לראות ביקורות על פרופיל של אחר
--    (טבלת ratings חסומה ב-RLS רק לצדדים; ה-view עוקף עם security_invoker=off).
create or replace view public.public_reviews
with (security_invoker = off) as
  select r.id, r.ratee_id, r.score, r.comment, r.created_at,
         u.full_name as rater_name, u.photo_url as rater_photo
  from public.ratings r
  join public.users u on u.id = r.rater_id
  where u.deleted_at is null;
grant select on public.public_reviews to authenticated;
