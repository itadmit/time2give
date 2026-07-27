/**
 * נתוני דמה מציאותיים: תורמים עם שמות אמיתיים, 10 תרומות באזורים שונים
 * (חלק "התורם מביא", חלק "צריך שינוע"), 2 יחידות מקבלות, ו-3 נסיעות ממתינות
 * לבדיקת הנהג. בנוסף — נותן למנהל (0542284283) את התפקידים כדי לבדוק הכל.
 *   node scripts/seedRealDemo.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { admin, DEMO_PASSWORD, SUPABASE_URL, SUPABASE_ANON, findByPhone } from './_demo.mjs';

const ADMIN_PHONE = '972542284283';

const DONORS = [
  { phone: '+972555900001', email: 'seed-donor01@t4g.dev', name: 'מסעדת הגפן', region: 'otef', city: 'שדרות', lat: 31.525, lng: 34.595, food: 'מנות חמות', qty: 40, unit: 'מנות', self: true, kosher: true },
  { phone: '+972555900002', email: 'seed-donor02@t4g.dev', name: 'מאפיית לחם הארץ', region: 'gush_dan', city: 'תל אביב', lat: 32.0853, lng: 34.7818, food: "סנדוויצ'ים", qty: 60, unit: 'יחידות', self: false },
  { phone: '+972555900003', email: 'seed-donor03@t4g.dev', name: 'קייטרינג שף רון', region: 'carmel_haifa', city: 'חיפה', lat: 32.794, lng: 34.9896, food: 'ארוחות מבושלות', qty: 30, unit: 'מנות', self: true },
  { phone: '+972555900004', email: 'seed-donor04@t4g.dev', name: 'משפחת כהן', region: 'jerusalem_hills', city: 'ירושלים', lat: 31.7683, lng: 35.2137, food: 'חבילות מזון', qty: 25, unit: 'חבילות', self: false },
  { phone: '+972555900005', email: 'seed-donor05@t4g.dev', name: 'סופרמרקט השדה', region: 'beer_sheva_negev_north', city: 'באר שבע', lat: 31.2518, lng: 34.7913, food: 'מים ושתייה', qty: 50, unit: 'ארגזים', self: true },
  { phone: '+972555900006', email: 'seed-donor06@t4g.dev', name: 'בית קפה אלונים', region: 'galil_west', city: 'נהריה', lat: 33.0085, lng: 35.098, food: 'מאפים טריים', qty: 80, unit: 'יחידות', self: false },
  { phone: '+972555900007', email: 'seed-donor07@t4g.dev', name: 'מטבח קהילתי צפון', region: 'galil_upper', city: 'קרית שמונה', lat: 33.2074, lng: 35.5695, food: 'מנות קרב חמות', qty: 35, unit: 'מנות', self: true },
  { phone: '+972555900008', email: 'seed-donor08@t4g.dev', name: 'משפחת לוי', region: 'judea_samaria', city: 'אריאל', lat: 32.1058, lng: 35.1873, food: 'פירות וירקות', qty: 40, unit: 'ארגזים', self: false },
  { phone: '+972555900009', email: 'seed-donor09@t4g.dev', name: 'פיצריה נאפולי', region: 'sharon', city: 'נתניה', lat: 32.3215, lng: 34.8532, food: 'פיצות', qty: 45, unit: 'מגשים', self: true },
  { phone: '+972555900010', email: 'seed-donor10@t4g.dev', name: 'חוות דבש הגולן', region: 'golan', city: 'קצרין', lat: 32.9938, lng: 35.6907, food: 'דבש ומתוקים', qty: 20, unit: 'חבילות', self: false },
];

const RECIPIENTS = [
  { phone: '+972555901001', email: 'seed-rec01@t4g.dev', name: 'רס"פ גדוד 8101', region: 'otef', recipient_type: 'military_unit', display_name: 'גדוד 8101 — עוטף' },
  { phone: '+972555901002', email: 'seed-rec02@t4g.dev', name: 'רס"פ פלוגת חוד', region: 'judea_samaria', recipient_type: 'military_unit', display_name: 'פלוגת חוד — יו"ש' },
];

async function withRetry(fn, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    const res = await fn().catch((e) => ({ error: e }));
    if (!res?.error) return res;
    last = res.error;
    if (!(res.error.code === 'bad_jwt' || res.error.status === 403 || res.error.status >= 500)) return res;
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return { error: last };
}

async function ensureUser(u, roles, extra = {}) {
  const existing = await findByPhone(u.phone);
  if (existing) await withRetry(() => admin.auth.admin.deleteUser(existing.id));
  const { data, error } = await withRetry(() => admin.auth.admin.createUser({
    phone: u.phone, phone_confirm: true, email: u.email, email_confirm: true,
    password: DEMO_PASSWORD, user_metadata: { demo: true, full_name: u.name },
  }));
  if (error) throw new Error(`create ${u.name}: ${error.message}`);
  const id = data.user.id;
  await admin.from('users').update({
    full_name: u.name, roles, verification_status: 'approved', onboarded: true,
    service_regions: extra.service_regions ?? [u.region],
  }).eq('id', id);
  if (roles.includes('recipient')) {
    await admin.from('recipient_profiles').insert({ user_id: id, recipient_type: u.recipient_type, region: u.region, display_name: u.display_name });
  }
  return id;
}

async function login(email) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return c;
}
async function rpc(c, fn, args) {
  const { data, error } = await c.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

// ── תורמים + הצעות ──
for (const d of DONORS) {
  await ensureUser(d, ['donor']);
  const c = await login(d.email);
  await rpc(c, 'publish_offer', {
    p_food_type: d.food, p_quantity: d.qty, p_unit_label: d.unit,
    p_service_regions: [d.region], p_origin_city: d.city, p_origin_lat: d.lat, p_origin_lng: d.lng,
    p_kosher: !!d.kosher, p_vegetarian: false, p_notes: null, p_photo_url: null, p_ready_at: null,
    p_donor_is_courier: d.self,
  });
  console.log(`➕ תרומה: ${d.name} · ${d.food} · ${d.city} · ${d.self ? 'התורם מביא' : 'צריך שינוע'}`);
}

// ── מקבלים (יחידות צבאיות) ──
for (const r of RECIPIENTS) await ensureUser(r, ['recipient']);
console.log('➕ 2 יחידות מקבלות');

// ── 3 נסיעות ממתינות (מקבל יוצר בקשה, תורם מתחייב בלי שינוע → waiting_courier) ──
const rec1 = await login(RECIPIENTS[0].email);
const rec2 = await login(RECIPIENTS[1].email);
const donorA = await login(DONORS[0].email); // עוטף
const donorB = await login(DONORS[7].email); // יו"ש

const DELIVERIES = [
  { rec: rec1, donor: donorA, region: 'otef', food: 'מנות חמות', qty: 30, unit: 'מנות' },
  { rec: rec2, donor: donorB, region: 'judea_samaria', food: 'שתייה קרה', qty: 20, unit: 'ארגזים' },
  { rec: rec1, donor: donorA, region: 'otef', food: 'מאפים טריים', qty: 40, unit: 'יחידות' },
];
for (const dl of DELIVERIES) {
  const needId = await rpc(dl.rec, 'create_need', { p_region: dl.region, p_food_type: dl.food, p_quantity: dl.qty, p_unit_label: dl.unit, p_needed_at: null, p_notes: null });
  await rpc(dl.donor, 'commit_to_need', { p_need_id: needId, p_self_transport: false });
  console.log(`🚚 נסיעה ממתינה: ${dl.food} · ${dl.region}`);
}

// ── מנהל: תפקידים לבדיקה (תורם/מבקש/נהג) + פרופיל מקבל ──
const { data: adminRow } = await admin.from('users').select('id').eq('phone', ADMIN_PHONE).single();
await admin.from('users').update({
  roles: ['admin', 'donor', 'recipient', 'courier'],
  service_regions: ['otef', 'judea_samaria', 'gush_dan', 'galil_upper', 'jerusalem_hills'],
  onboarded: true, verification_status: 'approved',
}).eq('id', adminRow.id);
await admin.from('recipient_profiles').delete().eq('user_id', adminRow.id);
await admin.from('recipient_profiles').insert({ user_id: adminRow.id, recipient_type: 'military_unit', region: 'otef', display_name: 'בדיקה — מנהל' });
console.log('👑 המנהל קיבל תפקידים: תורם + מבקש + נהג (לבדיקת כל הזרימות)');

console.log('\n✅ סיום. 10 תרומות, 2 מקבלים, 3 נסיעות ממתינות. התחבר עם 0542284283.');
process.exit(0);
