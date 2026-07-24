import * as Updates from 'expo-updates';

/**
 * בדיקת עדכון OTA (EAS Update) בעליית האפליקציה.
 * לא רץ ב-dev / ב-Expo Go (Updates.isEnabled=false שם) - כדי לא להפריע לפיתוח.
 * מחזיר true אם הותקן עדכון (ואז reloadAsync נקרא).
 */
export async function checkForOtaUpdate(): Promise<boolean> {
  try {
    if (__DEV__ || !Updates.isEnabled) return false;

    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return false;

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync(); // טוען מחדש עם הגרסה החדשה
    return true;
  } catch {
    // כשל בבדיקת עדכון לא אמור להפיל את האפליקציה
    return false;
  }
}
