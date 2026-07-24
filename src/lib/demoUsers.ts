/**
 * משתמשי בדיקה (dev בלבד) — תואם ל-scripts/_demo.mjs.
 * הקלדת אחד מהמספרים במסך הכניסה, או לחיצה על כפתור, מחברת מיד בלי SMS
 * (ספק הטלפון מכובה, לכן בפועל אימייל סינתטי + סיסמה).
 * מחיקה:  node scripts/deleteAllUsers.mjs
 */
export const DEMO_PASSWORD = 'demo1234';

export const DEMO_LOGINS: { label: string; phone: string; email: string; icon: string }[] = [
  { label: 'נהג 1 · עוטף + יו״ש', phone: '+972501000001', email: 'demo-courier1@time2give.dev', icon: 'car' },
  { label: 'נהג 2 · יו״ש + צפון', phone: '+972501000002', email: 'demo-courier2@time2give.dev', icon: 'car' },
  { label: 'נהג 3 · צפון + עוטף', phone: '+972501000003', email: 'demo-courier3@time2give.dev', icon: 'car' },
  { label: 'תורם 1 · עוטף + יו״ש', phone: '+972502000001', email: 'demo-donor1@time2give.dev', icon: 'gift' },
  { label: 'תורם 2 · יו״ש + צפון', phone: '+972502000002', email: 'demo-donor2@time2give.dev', icon: 'gift' },
  { label: 'תורם 3 · צפון + עוטף', phone: '+972502000003', email: 'demo-donor3@time2give.dev', icon: 'gift' },
  { label: 'רספ 1 · עוטף', phone: '+972503000001', email: 'demo-recipient1@time2give.dev', icon: 'people' },
  { label: 'רספ 2 · יו״ש', phone: '+972503000002', email: 'demo-recipient2@time2give.dev', icon: 'people' },
  { label: 'רספ 3 · צפון', phone: '+972503000003', email: 'demo-recipient3@time2give.dev', icon: 'people' },
  { label: 'רכז 1 · כל האזורים', phone: '+972504000001', email: 'demo-coordinator1@time2give.dev', icon: 'git-network' },
];

// סופר-אדמין נסתר (המספר של הבעלים) — לא מוצג, אבל אפשר להתחבר בהקלדת המספר
const HIDDEN_LOGINS: { phone: string; email: string }[] = [
  { phone: '+972542284283', email: 'demo-superadmin@time2give.dev' },
];

/** מחזיר משתמש דמו (גלוי או נסתר) אם ה-E.164 מוכר, אחרת undefined */
export function findDemoByPhone(e164: string) {
  return DEMO_LOGINS.find((d) => d.phone === e164) ?? HIDDEN_LOGINS.find((d) => d.phone === e164);
}
