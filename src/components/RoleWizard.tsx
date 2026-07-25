import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Txt, Button } from './ui';
import { colors, spacing, radius, shadow } from '../theme/tokens';

export const PENDING_ROLE_KEY = 'pending_role';

type Role = 'donor' | 'recipient' | 'courier';
type RoleCard = {
  role: Role;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  accent: string;
};

const ROLE_CARDS: RoleCard[] = [
  { role: 'donor', icon: 'gift', title: 'תורם', desc: 'יש לי מזון לתרום', accent: colors.brand700 },
  { role: 'recipient', icon: 'heart', title: 'מבקש', desc: 'אני צריך תרומה', accent: colors.secondary },
  { role: 'courier', icon: 'car', title: 'נהג מתנדב', desc: 'אני מוביל תרומות', accent: colors.warning },
];

const STEPS = [
  'בוחרים סוג חשבון',
  'מפרסמים תרומה או מוצאים תרומה',
  'נהנים!',
];

/**
 * ויזארד כניסה: קופץ לאורח (בלי session) בכל פתיחה עד שנרשם. שני מסכים —
 * ברוכים הבאים (הסבר קצר) ואז בחירת תפקיד. פשוט וברור גם למשתמש מבוגר.
 * enabled — true רק לאורח, כדי לא להקפיץ למי שכבר מחובר.
 */
export function RoleWizard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<'welcome' | 'menu'>('welcome');

  // קופץ בכל כניסה כשהמשתמש אורח (לא מחובר). נסגר לאותה הפעלה בלבד.
  useEffect(() => {
    if (enabled) {
      setStep('welcome');
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [enabled]);

  const dismiss = () => setVisible(false);

  const register = async (role: Role) => {
    await AsyncStorage.setItem(PENDING_ROLE_KEY, role);
    setVisible(false);
    router.push('/(auth)/phone');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {step === 'welcome' ? (
            <>
              <View style={styles.hero}>
                <Ionicons name="heart-circle" size={44} color={colors.white} />
              </View>
              <Txt variant="h1" weight="extrabold" center style={{ marginTop: spacing.md, marginBottom: 4 }}>
                ברוכים הבאים ל‑Time2Give
              </Txt>
              <Txt variant="body" color={colors.textMuted} center style={{ marginBottom: spacing.lg }}>
                הפלטפורמה שמחברת בין תורמים ליחידות צבאיות
              </Txt>

              <View style={styles.steps}>
                {STEPS.map((text, i) => (
                  <View key={i} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Txt weight="extrabold" color={colors.white} variant="small">{i + 1}</Txt>
                    </View>
                    <Txt weight="medium" style={{ flex: 1 }}>{text}</Txt>
                  </View>
                ))}
              </View>

              <Button title="התחלת הרשמה" icon="arrow-back" iconAfter onPress={() => setStep('menu')} style={{ marginTop: spacing.lg }} />
              <Button title="ארשם בהמשך" variant="ghost" onPress={dismiss} style={{ marginTop: spacing.sm }} />
            </>
          ) : (
            <>
              <Txt variant="h1" weight="extrabold" center style={{ marginBottom: 4 }}>
                מה תרצו לעשות?
              </Txt>
              <Txt variant="caption" color={colors.textMuted} center style={{ marginBottom: spacing.lg }}>
                בחרו את התפקיד שלכם כדי להתחיל
              </Txt>

              <View style={{ gap: 10 }}>
                {ROLE_CARDS.map((c) => (
                  <Pressable key={c.role} onPress={() => register(c.role)} style={styles.roleCard}>
                    <View style={[styles.roleIcon, { backgroundColor: c.accent }]}>
                      <Ionicons name={c.icon} size={24} color={colors.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt weight="bold" variant="h2">{c.title}</Txt>
                      <Txt variant="caption" color={colors.textMuted}>{c.desc}</Txt>
                    </View>
                    <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>

              <Button title="חזרה" variant="ghost" icon="arrow-forward" onPress={() => setStep('welcome')} style={{ marginTop: spacing.lg }} />
              <Button title="ארשם בהמשך" variant="ghost" onPress={dismiss} style={{ marginTop: 2 }} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(11,31,51,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  sheet: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 28,
    padding: spacing.xl,
    ...shadow.card,
  },
  hero: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brand700,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  steps: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brand700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
