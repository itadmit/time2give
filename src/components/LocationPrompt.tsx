import React, { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Button } from './ui';
import { colors, spacing, radius } from '../theme/tokens';

const SEEN_KEY = 'location_prompt_seen_v1';

/**
 * מודל "רך" שמוצג פעם אחת בכניסה הראשונה לאפליקציה (אחרי התחברות + onboarding),
 * מסביר למה צריך מיקום ומפעיל את דיאלוג ההרשאה של מערכת ההפעלה.
 * enabled - true רק כשהמשתמש מחובר ומאושר, כדי לא להקפיץ את המודל במסכי ההתחברות.
 */
export function LocationPrompt({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY);
      if (seen || cancelled) return;
      // אם ההרשאה כבר קיימת - אין צורך לשאול, פשוט מסמנים כנראה
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      if (status === 'granted') {
        await AsyncStorage.setItem(SEEN_KEY, '1');
        return;
      }
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const dismiss = async () => {
    await AsyncStorage.setItem(SEEN_KEY, '1');
    setVisible(false);
  };

  const allow = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // גם אם נכשל/נדחה - לא נציג שוב
    }
    await dismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconWrap}>
            <Ionicons name="location" size={34} color={colors.brand700} />
          </View>
          <Txt variant="h2" weight="extrabold" center style={{ marginBottom: 8 }}>
            הרשאת מיקום
          </Txt>
          <Txt color={colors.textMuted} center style={{ marginBottom: spacing.lg }}>
            כדי להציג תרומות ובקשות בקרבתך ולפתוח את המפה במיקום שלך - נבקש גישה למיקום המכשיר. תוכל לשנות זאת בכל עת בהגדרות.
          </Txt>
          <Button title="אישור מיקום" icon="location" onPress={allow} style={{ marginBottom: 10 }} />
          <Button title="לא עכשיו" variant="secondary" onPress={dismiss} />
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing.xl,
  },
  sheet: {
    width: '100%' as const,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center' as const,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brand50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.md,
  },
};
