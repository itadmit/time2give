import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, Easing, StyleSheet, ActivityIndicator, Image } from 'react-native';
import * as Updates from 'expo-updates';
import { colors, font } from '../theme/tokens';

/**
 * שער עדכון OTA בכניסה לאפליקציה.
 * מציג "בודק עדכונים" → "מוריד עדכון" עם progress bar, מוריד ומחיל את העדכון
 * **לפני** שהאפליקציה נטענת (reloadAsync). כך העדכון מגיע מיד, בלי תלות ב-cold-start.
 * ב-dev / Expo Go / ללא עדכון — עובר מיד לילדים.
 */
type Phase = 'checking' | 'downloading' | 'done';

// אם הבדיקה נתקעת (רשת איטית) — לא חוסמים את האפליקציה מעבר לזמן הזה
const CHECK_TIMEOUT_MS = 8000;

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>(__DEV__ || !Updates.isEnabled ? 'done' : 'checking');
  const [statusText, setStatusText] = useState('בודק עדכונים…');
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'done') return;
    let cancelled = false;

    const animateTo = (to: number, duration: number) =>
      Animated.timing(progress, { toValue: to, duration, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();

    (async () => {
      try {
        animateTo(0.35, 900); // "בודק" — התקדמות ראשונית
        const check = Updates.checkForUpdateAsync();
        const timeout = new Promise<{ isAvailable: false }>((res) =>
          setTimeout(() => res({ isAvailable: false }), CHECK_TIMEOUT_MS),
        );
        const result: any = await Promise.race([check, timeout]);
        if (cancelled) return;

        if (!result?.isAvailable) {
          animateTo(1, 250);
          setTimeout(() => !cancelled && setPhase('done'), 250);
          return;
        }

        // יש עדכון — מורידים עם חיווי
        setPhase('downloading');
        setStatusText('מוריד עדכון…');
        animateTo(0.9, 1400);
        await Updates.fetchUpdateAsync();
        if (cancelled) return;
        setStatusText('מחיל עדכון…');
        animateTo(1, 300);
        setTimeout(() => Updates.reloadAsync(), 350); // טעינה מחדש עם הגרסה החדשה
      } catch {
        if (!cancelled) setPhase('done'); // כשל בעדכון לא חוסם את האפליקציה
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, progress]);

  if (phase === 'done') return <>{children}</>;

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.brand}>Time2Give</Text>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
      <View style={styles.statusRow}>
        <ActivityIndicator color={colors.brand100} size="small" />
        <Text style={styles.status}>{statusText}</Text>
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
