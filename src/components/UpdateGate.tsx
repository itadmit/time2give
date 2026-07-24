import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, ActivityIndicator, Image } from 'react-native';
import * as Updates from 'expo-updates';
import { colors, font } from '../theme/tokens';

/**
 * שער עדכון OTA בכניסה — מציג חיווי "בודק/מוריד עדכון" עם progress bar.
 *
 * ⚠️ חשוב: אנחנו **לא** קוראים ל-reloadAsync — הוא מקריס את האפליקציה ב-iOS באפליקציה הזו
 * (קרה גם ב-Build 8 וגם ב-9). במקום זאת אנחנו נותנים ל-expo-updates להוריד את העדכון ברקע
 * (checkAutomatically=ON_LOAD, fallbackToCacheTimeout=0), והוא **מוחל אוטומטית בפתיחה הבאה**
 * של האפליקציה. כך: חיווי ברור + אמינות מלאה, בלי קריסות.
 */
const MAX_BLOCK_MS = 9000;

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const enabled = !__DEV__ && Updates.isEnabled;
  const { isChecking, isDownloading, isUpdatePending } = Updates.useUpdates();
  const [timedOut, setTimedOut] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  // הגנת זמן: לא נחסום את האפליקציה לנצח אם הבדיקה/הורדה נתקעת
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), MAX_BLOCK_MS);
    return () => clearTimeout(t);
  }, []);

  // חוסמים רק בזמן בדיקה/הורדה. עדכון שהורד (isUpdatePending) יוחל בפתיחה הבאה — לא מפעילים reload.
  const busy = enabled && !timedOut && (isChecking || isDownloading);

  useEffect(() => {
    const to = isDownloading ? 0.9 : 0.35;
    Animated.timing(progress, { toValue: to, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [isChecking, isDownloading, progress]);

  if (!busy) return <>{children}</>;

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const status = isDownloading ? 'מוריד עדכון…' : 'בודק עדכונים…';

  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.brand}>Time2Give</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
      <View style={styles.statusRow}>
        <ActivityIndicator color={colors.brand100} size="small" />
        <Text style={styles.status}>{status}</Text>
      </View>
      {isUpdatePending ? <Text style={styles.hint}>העדכון יופעל בפתיחה הבאה</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand700,
    paddingHorizontal: 40,
  },
  logo: { width: 96, height: 96, marginBottom: 16 },
  brand: { color: colors.white, fontFamily: font.extrabold, fontSize: 26, marginBottom: 28 },
  barTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: colors.secondary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  status: { color: colors.brand100, fontFamily: font.medium, fontSize: 14 },
  hint: { color: colors.brand100, fontFamily: font.regular, fontSize: 12, marginTop: 10, opacity: 0.85 },
});
