/**
 * מחיקת משתמשי הדמו + התוכן שלהם.
 *   node scripts/teardownDemo.mjs
 * (למחיקה גורפת של הכל: node scripts/deleteAllUsers.mjs)
 */
import { admin, DEMO_USERS, findByPhone } from './_demo.mjs';

const ids = [];
for (const d of DEMO_USERS) {
  const u = await findByPhone(d.phone);
  if (u) ids.push(u.id);
}
if (!ids.length) { console.log('אין משתמשי דמו למחיקה.'); process.exit(0); }

const { data: rps } = await admin.from('recipient_profiles').select('id').in('user_id', ids);
const recipientIds = (rps ?? []).map((r) => r.id);

// ניקוי תלויות (FK בלי cascade) לפני מחיקת המשתמשים
await admin.from('ratings').delete().in('rater_id', ids);
await admin.from('ratings').delete().in('ratee_id', ids);
await admin.from('events').delete().in('actor_id', ids);
await admin.from('feed_events').delete().in('actor_id', ids);
await admin.from('audit_log').delete().in('actor_id', ids);
await admin.from('assignments').delete().in('donor_id', ids);
await admin.from('assignments').delete().in('courier_id', ids);
await admin.from('assignments').delete().in('coordinator_id', ids);
if (recipientIds.length) await admin.from('assignments').delete().in('recipient_id', recipientIds);
await admin.from('offers').delete().in('donor_id', ids);
if (recipientIds.length) await admin.from('needs').delete().in('recipient_id', recipientIds);
await admin.from('recipient_profiles').delete().in('user_id', ids);

let ok = 0;
for (const id of ids) {
  const { error } = await admin.auth.admin.deleteUser(id);
  if (!error) ok++; else console.error('❌', id, error.message);
}
console.log(`\n🗑  נמחקו ${ok}/${ids.length} משתמשי דמו.`);
process.exit(0);
