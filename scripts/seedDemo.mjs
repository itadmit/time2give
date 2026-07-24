/**
 * יצירת כל משתמשי הדמה + פרופילים. אידמפוטנטי: אם משתמש קיים — נמחק ונוצר מחדש
 * (ה-update API לא אמין בפרויקט הזה, לכן delete+create).
 *   node scripts/seedDemo.mjs
 * מחיקה כוללת:  node scripts/deleteAllUsers.mjs  (או teardownDemo.mjs לדמו בלבד)
 */
import { admin, DEMO_USERS, DEMO_PASSWORD, findByPhone } from './_demo.mjs';

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

for (const d of DEMO_USERS) {
  // אם קיים — מחיקה למצב נקי
  const existing = await findByPhone(d.phone);
  if (existing) await withRetry(() => admin.auth.admin.deleteUser(existing.id));

  const { data, error } = await withRetry(() => admin.auth.admin.createUser({
    phone: d.phone, phone_confirm: true,
    email: d.email, email_confirm: true,
    password: DEMO_PASSWORD,
    user_metadata: { demo: true, full_name: d.full_name },
  }));
  if (error) { console.error('❌ create', d.full_name, error.message); continue; }
  const id = data.user.id;

  // פרופיל
  const isRecipient = d.roles.includes('recipient');
  const { error: uerr } = await admin.from('users').update({
    full_name: d.full_name,
    roles: d.roles,
    verification_status: 'approved',
    onboarded: true,
    service_regions: d.service_regions ?? [],
  }).eq('id', id);
  if (uerr) console.error('  ⚠️ profile', d.full_name, uerr.message);

  // פרופיל מקבל
  if (isRecipient) {
    await admin.from('recipient_profiles').insert({
      user_id: id, recipient_type: d.recipient_type, region: d.region, display_name: d.display_name,
    });
  }
  console.log(`➕ ${d.full_name}  ${d.roles.join('+')}  ${d.hidden ? '(נסתר)' : ''}`);
}

console.log(`\n✅ סיום. כניסה: טלפון/כפתור דמו + סיסמה "${DEMO_PASSWORD}".`);
process.exit(0);
