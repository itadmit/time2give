import { useEffect, useState, useCallback } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

interface OTAState {
  isChecking: boolean;
  isDownloading: boolean;
  isReady: boolean;
  error: string | null;
}

/**
 * OTA update hook.
 *
 * ⚠️ ההיסטוריה: `Updates.reloadAsync()` מקריס את האפליקציה הזאת — יש MapView חי
 * במסך הבית, ו-react-native-maps + הריסת ה-bridge בזמן reload = קריסה נייטיבית.
 * לעומת זאת הוכח (גרסה התחלפה אחרי cold-restart) ש**עדכון שהורד עם `fetchUpdateAsync`
 * מוחל אמין בהפעלה הבאה של האפליקציה, בלי reloadAsync**.
 *
 * לכן: בודקים, מורידים (fetch → staged), ומיידעים את המשתמש שהעדכון ייכנס בפתיחה הבאה.
 * לא קוראים ל-reloadAsync בכלל.
 */
export function useOTAUpdates() {
  const [state, setState] = useState<OTAState>({
    isChecking: false,
    isDownloading: false,
    isReady: false,
    error: null,
  });
  // כדי לא להציג את ה-Alert שוב ושוב עבור אותו עדכון בזמן ריצה
  const [notified, setNotified] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      setState((p) => ({ ...p, isChecking: true, error: null }));
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setState((p) => ({ ...p, isChecking: false, isDownloading: true }));
        await Updates.fetchUpdateAsync(); // מוריד ומכין (staged) — יוחל ב-cold-restart
        setState((p) => ({ ...p, isDownloading: false, isReady: true }));

        setNotified((already) => {
          if (!already) {
            Alert.alert(
              'עדכון מוכן ✓',
              'גרסה חדשה של Time2Give הותקנה. סגור ופתח את האפליקציה כדי להחיל אותה.',
              [{ text: 'הבנתי' }],
              { cancelable: true },
            );
          }
          return true;
        });
      } else {
        setState((p) => ({ ...p, isChecking: false }));
      }
    } catch (e: any) {
      setState((p) => ({ ...p, isChecking: false, isDownloading: false, error: e?.message || 'שגיאה בבדיקת עדכונים' }));
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  useEffect(() => {
    const onChange = (s: AppStateStatus) => {
      if (s === 'active') checkForUpdate();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [checkForUpdate]);

  return { ...state, checkForUpdate };
}
