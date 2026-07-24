import { router } from 'expo-router';

/** חזרה בטוחה - אם אין היסטוריה, נופל למסך ברירת מחדל (מונע אזהרת GO_BACK). */
export function safeBack(fallback: string = '/(tabs)/feed') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
