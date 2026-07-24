import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { registerForPushNotifications } from '../lib/notifications';

export type AppNotification = {
  id: string;
  title: string | null;
  body: string | null;
  data: any;
  read_at: string | null;
  created_at: string;
};

type State = {
  items: AppNotification[];
  unread: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
};

const Ctx = createContext<State | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const uid = session?.user?.id;

  const refresh = useCallback(async () => {
    if (!uid) return setItems([]);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setItems((data as AppNotification[]) ?? []);
  }, [uid]);

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }, [uid]);

  useEffect(() => {
    refresh();
    if (!uid) return;
    registerForPushNotifications(uid);
    const channel = supabase
      .channel(`notif:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
        setItems((prev) => [payload.new as AppNotification, ...prev]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, refresh]);

  const unread = items.filter((n) => !n.read_at).length;

  return <Ctx.Provider value={{ items, unread, refresh, markAllRead }}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
