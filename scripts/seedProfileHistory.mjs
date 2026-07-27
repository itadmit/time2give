/**
 * ממלא לפרופילי התורמים היסטוריית תרומות (offers שהושלמו) + חוות דעת (ratings),
 * כדי שהפרופיל הציבורי יראה מלא. אידמפוטנטי — מוחק את הדמו הקודם ומייצר מחדש.
 *   node scripts/seedProfileHistory.mjs
 */
import { admin } from './_demo.mjs';

const FOODS = ['מנות חמות', 'סנדוויצ\'ים', 'מרק חם', 'שניצלים במגש', 'פסטה ברוטב', 'אורז וירקות', 'פירות טריים', 'מאפים ועוגות', 'שתייה קרה', 'חטיפים ואנרגיה', 'סלטים טריים', 'פיתות וממרחים'];
const COMMENTS = [
  'תרומה מדהימה, הגיעה בזמן! 🙏',
  'אוכל טרי וטעים, תודה רבה',
  'שירות מעולה, ממליץ בחום',
  'עזרו לנו מאוד ביום קשה, יישר כוח',
  'מקצועיים ואדיבים לאורך כל הדרך',
  'הכל היה מסודר, נקי וארוז יפה',
  'תודה ענקית מכל הלב ❤️',
  'תמיד אפשר לסמוך עליהם',
  'כמות נדיבה ואיכות גבוהה',
  'חוויה מצוינת, נשמח לקבל שוב',
  'הרימו לנו את המורל, תודה!',
  'אלופים אמיתיים 💪',
];
const r = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[r(arr.length)];
const daysAgoIso = (min, span) => new Date(Date.now() - (min + r(span)) * 86400000).toISOString();

const { data: donors } = await admin.from('users').select('id, full_name, service_regions').like('phone', '9725559000%');
const { data: pool } = await admin.from('users').select('id, full_name').not('full_name', 'is', null);
const donorIds = donors.map((d) => d.id);

// ניקוי דמו קודם
await admin.from('ratings').delete().in('ratee_id', donorIds).is('assignment_id', null);
await admin.from('offers').delete().in('donor_id', donorIds).eq('status', 'fulfilled');
console.log('🧹 היסטוריה/ביקורות קודמות נוקו');

for (const d of donors) {
  const region = (d.service_regions && d.service_regions[0]) || 'gush_dan';
  // היסטוריית תרומות — 5-8 offers שהושלמו
  const nOffers = 5 + r(4);
  const offers = Array.from({ length: nOffers }, () => ({
    donor_id: d.id, food_type: pick(FOODS), quantity: 20 + r(80), unit_label: 'מנות',
    service_regions: [region], status: 'fulfilled', created_at: daysAgoIso(5, 180),
  }));
  await admin.from('offers').insert(offers);

  // חוות דעת — 4-6 ביקורות מדמויות שונות
  const raters = pool.filter((p) => p.id !== d.id);
  const nRev = 4 + r(3);
  const reviews = Array.from({ length: nRev }, () => {
    const rater = pick(raters);
    return { ratee_id: d.id, rater_id: rater.id, assignment_id: null, score: 4 + r(2), comment: pick(COMMENTS), created_at: daysAgoIso(3, 150) };
  });
  await admin.from('ratings').insert(reviews);
  console.log(`➕ ${d.full_name}: ${nOffers} תרומות בהיסטוריה · ${nRev} חוות דעת`);
}

console.log('\n✅ סיום. הפרופילים מלאים בהיסטוריה וחוות דעת.');
process.exit(0);
