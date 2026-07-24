import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Button } from './ui';
import { colors, spacing, radius } from '../theme/tokens';

const SEEN_KEY = 'role_wizard_seen_v1';
export const PENDING_ROLE_KEY = 'pending_role';

type Cube = {
  role: 'donor' | 'recipient' | 'coordinator' | 'courier';
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  disabled?: boolean;
};

const CUBES: Cube[] = [
  { role: 'donor', icon: 'gift', title: 'תורם', desc: 'מכין ומספק מזון לחיילים' },
  { role: 'recipient', icon: 'shield-checkmark', title: 'חייל', desc: 'מבקש או מאשר תרומות' },
  { role: 'coordinator', icon: 'git-network', title: 'רכז', desc: 'מחבר תורמים לחיילים · טעון אישור' },
  { role: 'courier', icon: 'car', title: 'נהג', desc: 'מוזמן ע"י רכזים בלבד · לביטחון חיילינו', disabled: true },
];

/**
 * ויזארד פתיחה ראשונה: המשתמש רואה את סוגי המשתמשים (קוביות), ויכול לבחור תפקיד
 * להרשמה או ללחוץ "לא כעת" ולגלוש כאורח. חייל יכול לצפות חופשי או להירשם.
 * enabled — true רק לאורח (בלי session), כדי לא להקפיץ למי שכבר מחובר.
 */
export function RoleWizard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'menu' | 'soldier'>('menu');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY);
      if (!seen && !cancelled) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const markSeen = () => AsyncStorage.setItem(SEEN_KEY, '1');

  const dismiss = async () => {
    await markSeen();
    setVisible(false);
  };

  const register = async (role: Cube['role']) => {
    await AsyncStorage.setItem(PENDING_ROLE_KEY, role);
    await markSeen();
    setVisible(false);
    router.push('/(auth)/phone');
  };

  const onCube = (c: Cube) => {
    if (c.disabled) return;
    if (c.role === 'recipient') setStep('soldier');
    else register(c.role);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {step === 'menu' ? (
            <>
              <Txt variant="h2" weight="extrabold" center style={{ marginBottom: 4 }}>
                ברוכים הבאים ל-Time2Give
              </Txt>
              <Txt variant="caption" color={colors.textMuted} center style={{ marginBottom: spacing.lg }}>
                אפשר לגלוש חופשי. כדי לבצע פעולה — בחר תפקיד:
              </Txt>
              <View style={styles.grid}>
                {CUBES.map((c) => (
                  <Pressable key={c.role} onPress={() => onCube(c)} disabled={c.disabled} style={[styles.cube, c.disabled && styles.cubeDisabled]}>
                    <View style={[styles.cubeIcon, { backgroundColor: c.disabled ? colors.border : colors.brand50 }]}>
                      <Ionicons name={c.disabled ? 'lock-closed' : c.icon} size={26} color={c.disabled ? colors.textMuted : colors.brand700} />
                    </View>
                    <Txt weight="bold" center style={{ marginTop: 8 }} color={c.disabled ? colors.textMuted : colors.text}>
                      {c.title}
                    </Txt>
                    <Txt variant="caption" color={colors.textMuted} center style={{ marginTop: 2 }}>
                      {c.desc}
                    </Txt>
                  </Pressable>
                ))}
              </View>
              <Button title="לא כעת" variant="ghost" onPress={dismiss} style={{ marginTop: spacing.lg }} />
            </>
          ) : (
            <>
              <View style={styles.cubeIcon}>
                <Ionicons name="shield-checkmark" size={30} color={colors.brand700} />
              </View>
              <Txt variant="h2" weight="extrabold" center style={{ marginTop: spacing.sm, marginBottom: 4 }}>
                חייל
              </Txt>
              <Txt variant="caption" color={colors.textMuted} center style={{ marginBottom: spacing.lg }}>
                אפשר לצפות בתרומות בלי הרשמה. הרשמה נדרשת רק כדי לבקש תרומה או לאשר תרומה שהוצעה.
              </Txt>
              <Button title="צפייה חופשית" icon="eye" onPress={dismiss} style={{ marginBottom: 10 }} />
              <Button title="הרשמה (לבקשה/אישור)" variant="secondary" icon="person-add" onPress={() => register('recipient')} />
              <Button title="חזרה" variant="ghost" onPress={() => setStep('menu')} style={{ marginTop: 8 }} />
            </>
          )}
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
  },
  grid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    justifyContent: 'space-between' as const,
  },
  cube: {
    width: '47%' as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: 'center' as const,
  },
  cubeDisabled: { opacity: 0.7 },
  cubeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    alignSelf: 'center' as const,
  },
};
