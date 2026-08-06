# צ׳קליסט העלאה לחנויות — Time2Give

מה שאני (הבוט) כבר עשיתי מסומן ✅. מה שרק אתה יכול לעשות מסומן 🙋.

## מה שכבר בוצע ✅
- ✅ בילד iOS לפרודקשן + הגשה אוטומטית ל-App Store Connect (מספר בילד עולה אוטומטית).
- ✅ בילד אנדרואיד לפרודקשן (AAB) — מוכן להורדה מדף הבילד ב-EAS.
- ✅ אייקון אפליקציה (1024×1024 / 512×512) — נצרב בבילד.
- ✅ טקסטים לחנות (עברית) — `store/listing.md`.
- ✅ מדיניות פרטיות — `store/privacy-policy.md`.

## 🙋 מה שנשאר לך — iOS (App Store)
1. **צילומי מסך** — צלם מהאפליקציה (TestFlight) 3-5 מסכים: הפיד/בית, עמוד תרומה, "הפעילות שלי". גדלים: iPhone 6.7" = 1290×2796.
2. **App Store Connect** → האפליקציה שלנו (App ID 6794342677) → מלא:
   - שם, Subtitle, Description, Keywords (הכל ב-`store/listing.md`).
   - העלה צילומי מסך.
   - **Privacy Policy URL** (ראה שלב "פרטיות" למטה).
   - Support URL (אפשר אתר/דף פשוט).
   - קטגוריה: Food & Drink · דירוג גיל 4+.
3. **App Privacy** (שאלון הנתונים): סמן שנאסף — Phone Number (אימות), Location (פונקציונליות, לא tracking), User Content (תמונות). לא לפרסום, לא tracking.
4. בחר את הבילד האחרון → **Submit for Review**.
5. ביקורת של אפל (1-3 ימים) → אישור → פרסום.

## 🙋 מה שנשאר לך — Android (Google Play)
1. **הורד את ה-AAB** מדף הבילד ב-EAS (או תן לי Service Account ואגיש אוטומטית — ראה למטה).
2. **Play Console** → צור/פתח את האפליקציה (package `com.time4giving.app`) → מלא:
   - כותרת, תיאור קצר, תיאור מלא (`store/listing.md`).
   - **Feature graphic 1024×500** (באנר — צריך לעצב) + צילומי מסך (לפחות 2).
   - **Content rating** (שאלון → Everyone).
   - **Data safety** (טופס נתונים — בהתאם ל-App Privacy למעלה).
   - Target audience, Privacy Policy URL.
3. העלה את ה-AAB לריליס (מומלץ קודם Internal testing → אחר כך Production).
4. ביקורת של גוגל (שעות-ימים) → פרסום.

## 🙋 פרטיות — חובה לשתי החנויות
- ארח את `store/privacy-policy.md` בכתובת פומבית (URL). הכי מהיר: GitHub Pages, או הדבק ל-Notion פומבי, או כל אתר. הכנס בו כתובת אימייל לתמיכה (יש placeholder בקובץ).
- הזן את ה-URL ב-App Store Connect וב-Play Console.

## (אופציונלי) הגשה אוטומטית לאנדרואיד
כדי שאוכל להגיש ל-Play אוטומטית (כמו iOS), צור **Service Account** ב-Google Cloud עם הרשאה ל-Play Console, הורד JSON, שים אותו ב-`credentials/` ותגיד לי — אחבר ב-`eas.json` ואגיש בשבילך.

## קישורים
- Builds: https://expo.dev/accounts/quickshopil/projects/time4giving/builds
- iOS submission: https://expo.dev/accounts/quickshopil/projects/time4giving/submissions
