import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, ActivityIndicator, Image } from 'react-native';
import * as Updates from 'expo-updates';
import { colors, font } from '../theme/tokens';

/**
 * שער עדכון OTA בכניסה — מבוסס על ה-hook הרשמי `Updates.useUpdates()`.
 * השכבה הנייטיבית (checkAutomatically=ON_LOAD) בודקת ומורידה עדכון ברקע;
 * כאן רק מציגים חיווי ("בודק עדכונים…"/"מוריד עדכון…") עם progress bar,
 * ומפעילים reloadAsync **רק** כשעדכון כבר הורד ומוכן (isUpdatePending) — אחרי טעינה מלאה,
 * מה שנמנע מהקריסה של reloadAsync שנקרא ידנית בתחילת ה-boot.
 */
// לא חוסמים את האפליקציה יותר מזה גם אם הבדיקה/הורדה נתקעת
const MAX_BLOCK_MS = 9000;

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const enabled = !__DEV__ && Updates.isEnabled;
  const { isChecking, isDownloading, isUpdatePending } = Updates.useUpdates();
  const [timedOut, setTimedOut] = useState(false);
  const reloadedRef = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;

  // כשעדכון הורד ומוכן — טוענים מחדש כדי להחיל אותו (פעם אחת, עם הגנה מקריסה)
  useEffect(() => {
    if (enabled && isUpdatePending && !reloadedRef.current) {
      reloadedRef.current = true;
      Updates.reloadAsync().catch(() => setTimedOut(true));
    }
  }, [enabled, isUpdatePending]);

  // הגנת זמן: לא נחסום את האפליקציה לנצח אם משהו נתקע
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), MAX_BLOCK_MS);
    return () => clearTimeout(t);
  }, []);

  const busy = enabled && !timedOut && (isChecking || isDownloading || isUpdatePending);

  // התקדמות הפס לפי השלב
  useEffect(() => {
    const to = isUpdatePending ? 1 : isDownloading ? 0.85 : 0.35;
    Animated.timing(progress, { toValue: to, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [isChecking, isDownloading, isUpdatePending, progress]);

  if (!busy) return <>{children}</>;

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const status = isUpdatePending ? 'מחיל עדכון…' : isDownloading ? 'מוריד עדכון…' : 'בודק עדכונים…';

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
});
