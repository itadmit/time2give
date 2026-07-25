import { useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * OTA background fetcher — בודק עדכון בעליית האפליקציה ובחזרה מרקע, ו**מוריד** (stage)
 * כל עדכון זמין. הוא לא קורא ל-reloadAsync (מקריס את האפליקציה כשה-MapView חי) ולא מציג Alert.
 *
 * ההחלה עצמה קורית ב-`app/_layout.tsx`: מסך הפתיחה מחיל עדכון staged ב-reloadAsync
 * בזמן בטוח — לפני שעץ האפליקציה (והמפה) נטען. כך: החלה אמינה בפתיחה אחת, בלי קריסה.
 */
export function useOTAUpdates() {
  const checkAndStage = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        // fetch → מסמן isUpdatePending; ה-layout יחיל בפתיחה הבאה (או מיד אם עדיין ב-boot cover)
        await Updates.fetchUpdateAsync();
      }
    } catch {
      // כשל בבדיקת/הורדת עדכון לא אמור להפריע לאפליקציה
    }
  }, []);

  useEffect(() => {
    checkAndStage();
  }, [checkAndStage]);

  useEffect(() => {
    const onChange = (s: AppStateStatus) => {
      if (s === 'active') checkAndStage();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [checkAndStage]);
}
