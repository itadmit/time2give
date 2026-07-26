import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * iOS משתמש ב-Apple Maps (בלי מפתח). אנדרואיד משתמש ב-Google Maps וחייב
 * מפתח API (android.config.googleMaps.apiKey) — אחרת ה-MapView הנייטיב קורס
 * מיד עם הטעינה. לכן על אנדרואיד נטען מפה רק אם יש מפתח מוגדר; אחרת fallback.
 */
const androidMapsKey =
  (Constants.expoConfig as any)?.android?.config?.googleMaps?.apiKey ?? null;

export const MAPS_AVAILABLE = Platform.OS !== 'android' || !!androidMapsKey;
