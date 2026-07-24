/**
 * הגדרות משותפות לנתוני דמה (seed / scenarios / teardown).
 * ⚠️ פיתוח בלבד — משתמש ב-SUPABASE_SECRET_KEY (service role).
 *
 * הערה על הפרויקט הזה: ה-GoTrue Admin API של listUsers/updateUserById לא אמין
 * (bad_jwt / not-found לסירוגין), אבל createUser + deleteUser(byId) עובדים,
 * ו-PostgREST (service) אמין. לכן מאתרים id דרך public.users, לא דרך listUsers.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error('חסר EXPO_PUBLIC_SUPABASE_URL או SUPABASE_SECRET_KEY ב-.env'); process.exit(1); }

export const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
export const SUPABASE_URL = url;
export const SUPABASE_ANON = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const DEMO_PASSWORD = 'demo1234';

// 3 אזורים עם חפיפה
export const R1 = 'otef';          // עוטף עזה
export const R2 = 'judea_samaria'; // יהודה ושומרון
export const R3 = 'galil_upper';   // גבול הצפון (גליל עליון)

// 10 משתמשים גלויים + סופר-אדמין נסתר (hidden=true)
export const DEMO_USERS = [
  // נהגים/משנעים — כל אחד מכסה 2 אזורים (חפיפה)
  { phone: '+972501000001', email: 'demo-courier1@time2give.dev', full_name: 'נהג 1', roles: ['courier'], service_regions: [R1, R2] },
  { phone: '+972501000002', email: 'demo-courier2@time2give.dev', full_name: 'נהג 2', roles: ['courier'], service_regions: [R2, R3] },
  { phone: '+972501000003', email: 'demo-courier3@time2give.dev', full_name: 'נהג 3', roles: ['courier'], service_regions: [R3, R1] },
  // תורמים — כל אחד מכסה 2 אזורים (חפיפה)
  { phone: '+972502000001', email: 'demo-donor1@time2give.dev', full_name: 'תורם 1', roles: ['donor'], service_regions: [R1, R2] },
  { phone: '+972502000002', email: 'demo-donor2@time2give.dev', full_name: 'תורם 2', roles: ['donor'], service_regions: [R2, R3] },
  { phone: '+972502000003', email: 'demo-donor3@time2give.dev', full_name: 'תורם 3', roles: ['donor'], service_regions: [R3, R1] },
  // רספים/מקבלים — כל אחד באזור אחד
  { phone: '+972503000001', email: 'demo-recipient1@time2give.dev', full_name: 'רספ 1', roles: ['recipient'], recipient_type: 'family', region: R1, display_name: 'משפחה — עוטף' },
  { phone: '+972503000002', email: 'demo-recipient2@time2give.dev', full_name: 'רספ 2', roles: ['recipient'], recipient_type: 'evacuee', region: R2, display_name: 'מפונים — יו"ש' },
  { phone: '+972503000003', email: 'demo-recipient3@time2give.dev', full_name: 'רספ 3', roles: ['recipient'], recipient_type: 'elderly', region: R3, display_name: 'קשישים — צפון' },
  // רכז אחד בלבד — מכסה את כל האזורים
  { phone: '+972504000001', email: 'demo-coordinator1@time2give.dev', full_name: 'רכז 1', roles: ['coordinator'], service_regions: [R1, R2, R3] },
  // סופר-אדמין נסתר (המספר של הבעלים) — לא מוצג ברשימה
  { phone: '+972542284283', email: 'demo-superadmin@time2give.dev', full_name: 'מנהל מערכת', roles: ['admin'], service_regions: [R1, R2, R3], hidden: true },
];

/** מאתר משתמש auth לפי טלפון דרך public.users (אמין), מחזיר {id} או null */
export async function findByPhone(phone) {
  const digits = phone.replace(/\D/g, ''); // public.users.phone נשמר בלי '+'
  const { data, error } = await admin.from('users').select('id').eq('phone', digits).limit(1);
  if (error) throw error;
  return data && data.length ? { id: data[0].id } : null;
}
