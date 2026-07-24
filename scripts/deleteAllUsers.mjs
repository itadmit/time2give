/**
 * מוחק את *כל* התוכן ואת *כל* המשתמשים (auth + cascade).
 *   node scripts/deleteAllUsers.mjs
 */
import { admin } from './_demo.mjs';

const UUID0 = '00000000-0000-0000-0000-000000000000';
const wipeUuid = (t) => admin.from(t).delete().neq('id', UUID0);
const wipeBig = (t) => admin.from(t).delete().neq('id', 0);

// 1) ניקוי תוכן תפעולי (לפני מחיקת משתמשים — יש FK בלי cascade)
await wipeUuid('ratings');
await wipeBig('events');
await wipeBig('feed_events');
await wipeUuid('notifications');
await wipeUuid('user_badges');
await wipeUuid('assignments');
await wipeUuid('offers');
await wipeUuid('needs');
await wipeUuid('recipient_profiles');
await wipeBig('audit_log');
await wipeUuid('reports');
console.log('🧹 כל התוכן נמחק');

// 2) מחיקת כל המשתמשים
const { data: users, error } = await admin.from('users').select('id, full_name');
if (error) { console.error('list users:', error.message); process.exit(1); }
if (!users?.length) { console.log('אין משתמשים.'); process.exit(0); }

let ok = 0, fail = 0;
for (const u of users) {
  let done = false;
  for (let i = 0; i < 4 && !done; i++) {
    const { error: de } = await admin.auth.admin.deleteUser(u.id);
    if (!de) { done = true; ok++; }
    else if (i === 3) { fail++; console.error(`❌ ${u.full_name ?? u.id}: ${de.message}`); }
    else await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
}
console.log(`\n🗑  נמחקו ${ok} משתמשים${fail ? `, נכשלו ${fail}` : ''}.`);
process.exit(0);
