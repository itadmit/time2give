-- Time4Giving — הפעלת Realtime על התראות ופיד (RLS ממשיך לחול)
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.feed_events;
