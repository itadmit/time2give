import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserRole, ReputationLevel } from '../lib/domain';
import type { Region } from '../lib/regions';

export type UserProfile = {
  id: string;
  phone: string | null;
  full_name: string | null;
  photo_url: string | null;
  roles: UserRole[];
  verification_status: 'pending' | 'approved' | 'rejected';
  reputation_level: ReputationLevel;
  rating_avg: number;
  rating_count: number;
  service_regions: Region[];
  capabilities: string[];
  total_donations: number;
  total_units: number;
  total_deliveries: number;
  units_served: number;
  onboarded: boolean;
};

type AuthState = {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  initError: string | null;
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  signInDev: () => Promise<{ error: string | null }>;
  signInDemo: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    try {
      const { data } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
      setProfile((data as UserProfile) ?? null);
    } catch (e) {
      // אל תשאיר את המשתמש תקוע אם שאילתת הפרופיל נכשלה - נטפל בזה כ"אין פרופיל"
      console.warn('[auth] loadProfile failed', e);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    let mounted = true;
    // טיימר קשיח: משחרר את הטעינה אחרי 5 שניות בכל מקרה - גם אם getSession נתקע לגמרי
    const hardTimeout = setTimeout(() => {
      if (mounted) {
        setInitError('אתחול ההתחברות נתקע (getSession לא הגיב תוך 5 שניות)');
        setLoading(false);
      }
    }, 5000);

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user?.id) {
          // מגבילים את טעינת הפרופיל בזמן - אם השאילתה נתקעת, לא נחסום את מסך הבוט
          await Promise.race([
            loadProfile(data.session.user.id),
            new Promise((res) => setTimeout(res, 4000)),
          ]);
        }
      })
      .catch((e) => {
        console.warn('[auth] getSession failed', e);
        if (mounted) setInitError(`getSession נכשל: ${e?.message ?? String(e)}`);
      })
      .finally(() => {
        clearTimeout(hardTimeout);
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user?.id) await loadProfile(s.user.id);
      else setProfile(null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithPhone = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error?.message ?? null };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, token: string) => {
      const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
      if (!error && data.session?.user?.id) await loadProfile(data.session.user.id);
      return { error: error?.message ?? null };
    },
    [loadProfile],
  );

  // כניסה אנונימית לפיתוח בלבד (דורש הפעלת Anonymous sign-ins בדשבורד)
  const signInDev = useCallback(async () => {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data.session?.user?.id) await loadProfile(data.session.user.id);
    return { error: error?.message ?? null };
  }, [loadProfile]);

  // כניסת דמו (פיתוח): אימייל + סיסמה, בלי SMS. עובד עם המשתמשים מ-scripts/seedDemo.mjs
  const signInDemo = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session?.user?.id) await loadProfile(data.session.user.id);
    return { error: error?.message ?? null };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, initError, signInWithPhone, verifyOtp, signInDev, signInDemo, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
