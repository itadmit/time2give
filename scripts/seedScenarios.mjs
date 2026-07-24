/**
 * זריעת תוכן לבדיקת הפלואו — מריץ RPC-ים אמיתיים כמשתמשים, על פני 3 אזורים חופפים.
 *   node scripts/seedScenarios.mjs   (מנקה תוכן קודם ומייצר מחדש)
 * דורש: node scripts/seedDemo.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { admin, DEMO_USERS, DEMO_PASSWORD, SUPABASE_URL, SUPABASE_ANON, R1, R2, R3 } from './_demo.mjs';

// מפת טלפון(ללא +)→id לכל המשתמשים
const phones = DEMO_USERS.map((u) => u.phone.replace(/\D/g, ''));
const { data: urows } = await admin.from('users').select('id, phone, full_name').in('phone', phones);
const idByName = Object.fromEntries((urows ?? []).map((r) => [r.full_name, r.id]));

async function login(email) {
  const c = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return { c, id: data.user.id };
}
async function rpc(user, fn, args) {
  const { data, error } = await user.c.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
}

// התחברות השחקנים הדרושים
const donor1 = await login('demo-donor1@time2give.dev');
const donor2 = await login('demo-donor2@time2give.dev');
const donor3 = await login('demo-donor3@time2give.dev');
const rec1 = await login('demo-recipient1@time2give.dev');
const rec2 = await login('demo-recipient2@time2give.dev');
const rec3 = await login('demo-recipient3@time2give.dev');
const coord = await login('demo-coordinator1@time2give.dev');
const courier2Id = idByName['נהג 2'];
const courier3Id = idByName['נהג 3'];
console.log('🔑 מחוברים');

// ניקוי תוכן קודם + איפוס מונים
const ids = (urows ?? []).map((r) => r.id);
const { data: rps } = await admin.from('recipient_profiles').select('id').in('user_id', ids);
const recipientIds = (rps ?? []).map((r) => r.id);
await admin.from('ratings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await admin.from('events').delete().neq('id', 0);
await admin.from('feed_events').delete().neq('id', 0);
await admin.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await admin.from('user_badges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await admin.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await admin.from('offers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await admin.from('needs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await admin.from('users').update({ total_donations: 0, total_units: 0, total_deliveries: 0, units_served: 0, rating_avg: 0, rating_count: 0, reputation_level: 'verified' }).in('id', ids);
console.log('🧹 תוכן קודם נוקה');

// ── הצעות פתוחות (גלישה/מפה) ──
await rpc(donor1, 'publish_offer', { p_food_type: 'מנות חמות', p_quantity: 40, p_unit_label: 'מנות', p_service_regions: [R1, R2], p_origin_city: 'שדרות', p_origin_lat: 31.525, p_origin_lng: 34.595, p_kosher: true, p_notes: 'מוכן לאיסוף' });
await rpc(donor2, 'publish_offer', { p_food_type: 'חבילות מזון', p_quantity: 30, p_unit_label: 'חבילות', p_service_regions: [R2, R3], p_origin_city: 'אריאל', p_origin_lat: 32.105, p_origin_lng: 35.187 });
await rpc(donor3, 'publish_offer', { p_food_type: 'ארוחות מבושלות', p_quantity: 25, p_unit_label: 'מנות', p_service_regions: [R3, R1], p_origin_city: 'קרית שמונה', p_origin_lat: 33.207, p_origin_lng: 35.569 });
console.log('✅ 3 הצעות פתוחות');

// ── בקשות פתוחות (גלישת תורמים) ──
await rpc(rec1, 'create_need', { p_region: R1, p_food_type: 'שתייה', p_quantity: 20, p_unit_label: 'ארגזים' });
await rpc(rec2, 'create_need', { p_region: R2, p_food_type: 'חטיפים', p_quantity: 15, p_unit_label: 'קרטונים' });
await rpc(rec3, 'create_need', { p_region: R3, p_food_type: 'לחם טרי', p_quantity: 50, p_unit_label: 'כיכרות' });
console.log('✅ 3 בקשות פתוחות');

// ── ממתין לשינוע R1 (2 מועמדי נהגים: נהג1, נהג3) ──
const n1 = await rpc(rec1, 'create_need', { p_region: R1, p_food_type: 'מנות חמות', p_quantity: 35, p_unit_label: 'מנות' });
await rpc(donor1, 'commit_to_need', { p_need_id: n1, p_self_transport: false });
console.log('✅ ממתין לשינוע — עוטף');

// ── ממתין לשינוע R2 (2 מועמדים: נהג1, נהג2) ──
const n2 = await rpc(rec2, 'create_need', { p_region: R2, p_food_type: 'ירקות', p_quantity: 45, p_unit_label: 'ארגזים' });
await rpc(donor2, 'commit_to_need', { p_need_id: n2, p_self_transport: false });
console.log('✅ ממתין לשינוע — יו"ש');

// ── בדרך R1 (נהג 3 באמצע משלוח) ──
const n3 = await rpc(rec1, 'create_need', { p_region: R1, p_food_type: 'ערכות היגיינה', p_quantity: 18, p_unit_label: 'ערכות' });
const a3 = await rpc(donor1, 'commit_to_need', { p_need_id: n3, p_self_transport: false });
await rpc(coord, 'assign_courier', { p_assignment_id: a3, p_courier_id: courier3Id });
await rpc(coord, 'advance_assignment', { p_assignment_id: a3, p_new_status: 'picked_up' });
await rpc(coord, 'advance_assignment', { p_assignment_id: a3, p_new_status: 'on_the_way' });
console.log('✅ בדרך — נהג 3');

// ── מחזור מלא R3 (נהג 2): נמסר→אושר→דורג ──
const n4 = await rpc(rec3, 'create_need', { p_region: R3, p_food_type: 'ארוחות חמות', p_quantity: 60, p_unit_label: 'מנות' });
const a4 = await rpc(donor3, 'commit_to_need', { p_need_id: n4, p_self_transport: false });
await rpc(coord, 'assign_courier', { p_assignment_id: a4, p_courier_id: courier2Id });
await rpc(coord, 'advance_assignment', { p_assignment_id: a4, p_new_status: 'picked_up' });
await rpc(coord, 'advance_assignment', { p_assignment_id: a4, p_new_status: 'on_the_way' });
await rpc(coord, 'advance_assignment', { p_assignment_id: a4, p_new_status: 'delivered' });
await rpc(rec3, 'advance_assignment', { p_assignment_id: a4, p_new_status: 'confirmed' });
await rpc(rec3, 'submit_rating', { p_assignment_id: a4, p_ratee_id: donor3.id, p_score: 5, p_comment: 'תודה רבה!' });
console.log('✅ מחזור מלא — צפון');

console.log(`
🎉 מוכן. פלואו לבדיקה:
  • רכז 1        — 2 בקשות "ממתין לשינוע" (עוטף + יו"ש). מסך שיבוץ מציג נהגים מדורגים לפי כיסוי אזור.
  • תורמים 1-3   — הצעות פתוחות + שיבוצים פעילים.
  • רספ 1-3      — בקשות פתוחות + בתהליך; רספ 3 עם משלוח שאושר ודורג.
  • נהג 3        — משלוח "בדרך" (עוטף). נהג 2 — משלוח שהושלם (צפון).
  • פיד קהילתי   — "תורם 3 תרם 60 מנות לאזור גליל עליון".
`);
process.exit(0);
