# Time4Giving

אפליקציית מובייל (Expo / React Native) המחברת בין תורמי מזון למקבלים מורשים (יחידות, בתי חולים, ועוד), מבוססת אזורים, עם שמירה מוחלטת על אי-חשיפת מיקומים רגישים.

- **אפיון מוצר:** [אפיון-מלא.md](אפיון-מלא.md)
- **אפיון מערכת:** [ARCHITECTURE.md](ARCHITECTURE.md)

## Stack
Expo (expo-router, TypeScript) · Supabase (Postgres/PostGIS/Auth/Storage/RLS/RPC) · Heebo (RTL).

## הרצה
```bash
npm install
npm start          # ואז Expo Go או dev build (i / a)
npm run typecheck  # בדיקת טיפוסים
```

הגדרות Supabase נמצאות ב-`.env` (מוגן ב-.gitignore). ערכים בטוחים ללקוח בקידומת `EXPO_PUBLIC_`.

## מסד הנתונים
המיגרציות ב-`supabase/migrations/` (סכימה + RLS + RPC) כבר הוחלו על הפרויקט המרוחק.
להחלה מחדש (רשת ללא IPv6 → משתמשים ב-pooler IPv4):
```bash
set -a; . ./.env; set +a
npx supabase db push --db-url "$SUPABASE_POOLER_URL"
```

## מבנה
```
app/                    # מסכים (expo-router)
  (auth)/               # phone → otp → onboarding
  (tabs)/               # feed · needs (Flow A) · map (Flow B) · activity · profile
  need/new · offer/new  # טפסי יצירה
  assignment/[id]       # ציר זמן + חשיפת טלפון + מעברי סטטוס
src/
  theme/                # design tokens (§14.5 — כחול כהה, שפת פיקוד העורף)
  lib/                  # supabase, regions, domain (status→UI), api (RPC)
  components/           # UI kit + RegionPicker
  context/              # AuthContext
supabase/migrations/    # schema + rls + rpc
```

## שתי הזרימות
- **A (Need-first):** רס"פ מפרסם בקשה → Push לתורמים באזור → תורם מתחייב → רכז משבץ שינוע.
- **B (Offer-first):** תורם מפרסם תרומה מוכנה → מוצגת למקבלים → איסוף עצמאי / בקשת שינוע.

בשתיהן פרטי הקשר נחשפים רק אחרי התאמה, ונקודת המסירה מתואמת טלפונית.

## יכולות נוספות שנבנו
- **התראות:** in-app בזמן אמת (Supabase Realtime) + פעמון עם badge · רישום Expo Push token · Edge Function `send-notification` לשליחת Push.
- **מוניטין אמיתי:** טריגר DB שמעדכן תרומות/מנות/משלוחים, מעניק תגים (תורם ראשון/זהב/…) ומעלה Level אוטומטית בעת אישור קבלה, ומזין את הפיד.
- **סינון מיקום בשרת:** טריגר `scrub_location` מנקה קואורדינטות/רצפי ספרות מהערות (guardrail §16).
- **פאנל אדמין:** תור אישורי משתמשים + KPIs (מסך `app/admin`, גלוי לבעלי role=admin).
- **מפה:** `react-native-maps` אמיתי עם `MapBoundary` שנופל חיננית ל-placeholder ב-Expo Go.
- **Jobs מתוזמנים (pg_cron):** `expire-stale` (כל שעה) · `close-old` (יומי — סוגר שיבוצים ישנים ומסתיר פרטי קשר) · `daily-feed` (סיכום יומי לפיד). פרטי קשר מוסתרים אוטומטית לאחר סגירת שיבוץ (`reveal_phone` דוחה סטטוס closed).

## ⚠️ נדרש להפעלה מלאה
1. **ספק SMS ל-OTP** — Supabase Dashboard → Authentication → Providers → Phone (Twilio/MessageBird). לבדיקות: הוסף "test phone numbers" עם קוד קבוע ללא ספק אמיתי.
2. **מפה** — `react-native-maps` דורש **dev build** (`npx expo run:ios`/`run:android`), לא עובד ב-Expo Go. בלי dev build מוצג placeholder.
3. **Edge Function ל-Push** — פריסה: `npx supabase functions deploy send-notification` (דורש `supabase login`). לאחר מכן הגדר Database Webhook: Dashboard → Database → Webhooks → טבלת `notifications` → INSERT → HTTP POST לפונקציה. התראות in-app עובדות גם בלי זה.

## OTA (עדכונים אלחוטיים — EAS Update)
עדכוני JS/נכסים ללא מעבר בחנויות. הקוד כבר מחווט:
- `app.json` → `updates` + `runtimeVersion` (policy: appVersion)
- `eas.json` → ערוצים development / preview / production
- `src/lib/ota.ts` → בדיקה אוטומטית בעליית האפליקציה (רק ב-build אמיתי, לא Expo Go/dev)

**הפעלה (חד-פעמי):**
```bash
npx eas login
npx eas init            # יוצר projectId וממלא את updates.url אוטומטית
```
**פרסום עדכון OTA:**
```bash
eas update --branch production -m "תיאור העדכון"
```
המשתמשים יקבלו את העדכון בפתיחה הבאה של האפליקציה (או בבנייה הבאה של dev/preview לפי הערוץ).

> `runtimeVersion` נעול ל-`appVersion` — עדכוני OTA תואמים רק לאותה גרסת אפליקציה. שינוי קוד נייטיב (הוספת חבילה נייטיב) מחייב build חדש, לא OTA.

## Bootstrap אדמין
כדי להפוך משתמש (שכבר נרשם) לאדמין:
```bash
set -a; . ./.env; set +a
npx supabase db push --db-url "$SUPABASE_POOLER_URL"   # (רק אם צריך)
# ואז ב-SQL editor / psql מול הפרויקט:
#   update public.users set roles = array_append(roles,'admin'), verification_status='approved'
#   where phone = '+9725XXXXXXXX';
```
