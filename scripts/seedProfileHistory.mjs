/**
 * ממלא לפרופילי התורמים היסטוריית תרומות (offers שהושלמו) + חוות דעת (ratings)
 * *מחיילים/מפקדות/מפקדים/קצינים* בלבד — לא מהמנהל ולא מתורמים אחרים.
 * אידמפוטנטי. הרצה:  node scripts/seedProfileHistory.mjs
 */
import { admin, DEMO_PASSWORD, findByPhone } from './_demo.mjs';

// מדרגי חוות הדעת — לשם חיסיון חיילים: שם פרטי + אות ראשונה של שם משפחה + תפקיד (בלי שם מלא ודרגה מלאה)
const REVIEWERS = [
  { phone: '+972555920001', email: 'rev01@t4g.dev', name: 'נועה מ׳ · מפקדת שלישות' },
  { phone: '+972555920002', email: 'rev02@t4g.dev', name: 'יוסי א׳ · רס"פ גדוד' },
  { phone: '+972555920003', email: 'rev03@t4g.dev', name: 'דניאל כ׳ · לוחם' },
  { phone: '+972555920004', email: 'rev04@t4g.dev', name: 'רון ש׳ · קצין אפסנאות' },
  { phone: '+972555920005', email: 'rev05@t4g.dev', name: 'תומר ד׳ · מפקד כיתה' },
  { phone: '+972555920006', email: 'rev06@t4g.dev', name: 'אבי מ׳ · חובש פלוגה' },
  { phone: '+972555920007', email: 'rev07@t4g.dev', name: 'ליאור ב׳ · מ"פ' },
  { phone: '+972555920008', email: 'rev08@t4g.dev', name: 'שירה ל׳ · קצינת ת"ש' },
  { phone: '+972555920009', email: 'rev09@t4g.dev', name: 'עומר ג׳ · סמל מחלקה' },
  { phone: '+972555920010', email: 'rev10@t4g.dev', name: 'מאור פ׳ · רס"ר פלוגה' },
  { phone: '+972555920011', email: 'rev11@t4g.dev', name: 'הדר נ׳ · מפקדת מחלקה' },
  { phone: '+972555920012', email: 'rev12@t4g.dev', name: 'איתי ה׳ · לוחם צוות' },
];

const FOODS = ['מנות חמות', "סנדוויצ'ים", 'מרק חם', 'שניצלים במגש', 'פסטה ברוטב', 'אורז וירקות', 'פירות טריים', 'מאפים ועוגות', 'שתייה קרה', 'חטיפים ואנרגיה', 'סלטים טריים', 'פיתות וממרחים'];
const COMMENTS = [
  'תרומה מדהימה, הגיעה בזמן! 🙏', 'אוכל טרי וטעים, תודה רבה', 'שירות מעולה, ממליץ בחום',
  'עזרו לנו מאוד ביום קשה, יישר כוח', 'מקצועיים ואדיבים לאורך כל הדרך', 'הכל היה מסודר, נקי וארוז יפה',
  'תודה ענקית מכל הלב ❤️', 'תמיד אפשר לסמוך עליהם', 'כמות נדיבה ואיכות גבוהה',
  'חוויה מצוינת, נשמח לקבל שוב', 'הרימו לנו את המורל, תודה!', 'אלופים אמיתיים 💪',
];
const r = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[r(arr.length)];
const daysAgoIso = (min, span) => new Date(Date.now() - (min + r(span)) * 86400000).toISOString();

async function withRetry(fn, tries = 5) {
  let last;
  for (let i = 0; i < tries; i++) {
    const res = await fn().catch((e) => ({ error: e }));
    if (!res?.error) return res;
    last = res.error;
    if (!(res.error.code === 'bad_jwt' || res.error.status === 403 || res.error.status >= 500)) return res;
    await new Promise((x) => setTimeout(x, 700 * (i + 1)));
  }
  return { error: last };
}

const { data: donors } = await admin.from('users').select('id, full_name, service_regions').like('phone', '9725559000%');
const donorIds = donors.map((d) => d.id);

// ניקוי חוות דעת דמו קודמות + היסטוריה
await admin.from('ratings').delete().in('ratee_id', donorIds).is('assignment_id', null);
await admin.from('offers').delete().in('donor_id', donorIds).eq('status', 'fulfilled');
console.log('🧹 היסטוריה/ביקורות קודמות נוקו');

// יצירת/רענון המדרגים הצבאיים
const raterIds = [];
for (const rv of REVIEWERS) {
  const existing = await findByPhone(rv.phone);
  if (existing) await withRetry(() => admin.auth.admin.deleteUser(existing.id));
  const { data, error } = await withRetry(() => admin.auth.admin.createUser({
    phone: rv.phone, phone_confirm: true, email: rv.email, email_confirm: true,
    password: DEMO_PASSWORD, user_metadata: { demo: true, full_name: rv.name },
  }));
  if (error) { console.error('❌', rv.name, error.message); continue; }
  await admin.from('users').update({ full_name: rv.name, roles: ['recipient'], verification_status: 'approved', onboarded: true }).eq('id', data.user.id);
  raterIds.push(data.user.id);
}
console.log(`👥 ${raterIds.length} מדרגים צבאיים מוכנים`);

for (const d of donors) {
  const region = (d.service_regions && d.service_regions[0]) || 'gush_dan';
  const nOffers = 5 + r(4);
  const offers = Array.from({ length: nOffers }, () => ({
    donor_id: d.id, food_type: pick(FOODS), quantity: 20 + r(80), unit_label: 'מנות',
    service_regions: [region], status: 'fulfilled', created_at: daysAgoIso(5, 180),
  }));
  await admin.from('offers').insert(offers);

  const nRev = 4 + r(3);
  const reviews = Array.from({ length: nRev }, () => ({
    ratee_id: d.id, rater_id: pick(raterIds), assignment_id: null,
    score: 4 + r(2), comment: pick(COMMENTS), created_at: daysAgoIso(3, 150),
  }));
  await admin.from('ratings').insert(reviews);
  console.log(`➕ ${d.full_name}: ${nOffers} תרומות · ${nRev} חוות דעת`);
}

console.log('\n✅ סיום. חוות הדעת מחיילים/מפקדים/קצינים בלבד.');
process.exit(0);
