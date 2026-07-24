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
 * OTA update hook — מבוסס על התבנית שעובדת ב-QuickCRM של המשתמש.
 * בודק עדכון בעליית האפליקציה ובחזרה מרקע, מוריד אותו, ומציג Alert.
 * reloadAsync נקרא **רק** בלחיצת המשתמש על "הפעל מחדש" — אחרי טעינה מלאה,
 * מה שנמנע מהקריסה של reloadAsync אוטומטי בזמן boot.
 */
export function useOTAUpdates() {
  const [state, setState] = useState<OTAState>({
    isChecking: false,
    isDownloading: false,
    isReady: false,
    error: null,
  });

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || !Updates.isEnabled) return;

    try {
      setState((prev) => ({ ...prev, isChecking: true, error: null }));

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setState((prev) => ({ ...prev, isChecking: false, isDownloading: true }));

        await Updates.fetchUpdateAsync();

        setState((prev) => ({ ...prev, isDownloading: false, isReady: true }));

        Alert.alert(
          'עדכון זמין',
          'גרסה חדשה של Time2Give מוכנה. להפעיל מחדש עכשיו?',
          [
            { text: 'מאוחר יותר', style: 'cancel' },
            {
              text: 'הפעל מחדש',
              onPress: async () => {
                await Updates.reloadAsync();
              },
            },
          ],
          { cancelable: false },
        );
      } else {
        setState((prev) => ({ ...prev, isChecking: false }));
      }
    } catch (e: any) {
      setState((prev) => ({
        ...prev,
        isChecking: false,
        isDownloading: false,
        error: e?.message || 'שגיאה בבדיקת עדכונים',
      }));
    }
  }, []);

  useEffect(() => {
    checkForUpdate();
  }, [checkForUpdate]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') checkForUpdate();
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkForUpdate]);

  return { ...state, checkForUpdate };
}
