import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Txt, Field, Button, Card } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { DEMO_LOGINS, DEMO_PASSWORD, findDemoByPhone } from '../../src/lib/demoUsers';
import { colors, spacing } from '../../src/theme/tokens';

/** ממיר 05X-XXXXXXX ל-E.164 (+9725X...) */
function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  if (digits.length === 9) return `+972${digits}`;
  return null;
}

export default function PhoneScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  const { signInWithPhone, signInDemo } = useAuth();
  const router = useRouter();

  const demoLogin = async (email: string) => {
    setDemoEmail(email);
    const { error } = await signInDemo(email, DEMO_PASSWORD);
    setDemoEmail(null);
    if (error) Alert.alert('כניסת דמו נכשלה', error);
    // AuthGate ינווט אוטומטית
  };

  const submit = async () => {
    const e164 = toE164(phone);
    if (!e164) {
      Alert.alert('מספר לא תקין', 'הזן מספר טלפון ישראלי תקין, למשל 050-1234567');
      return;
    }

    // מספרי בדיקה hardcoded (dev בלבד): כניסה מיידית בלי SMS
    const demo = __DEV__ ? findDemoByPhone(e164) : undefined;
    if (demo) {
      setLoading(true);
      const { error } = await signInDemo(demo.email, DEMO_PASSWORD);
      setLoading(false);
      if (error) Alert.alert('כניסת בדיקה נכשלה', error);
      return; // בלי OTP
    }

    setLoading(true);
    const { error } = await signInWithPhone(e164);
    setLoading(false);
    if (error) {
      Alert.alert('שגיאה בשליחת קוד', error);
      return;
    }
    router.push({ pathname: '/(auth)/otp', params: { phone: e164 } });
  };

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', marginTop: 48, marginBottom: 32 }}>
        <View style={styles.logo}>
          <Ionicons name="heart-circle" size={64} color={colors.brand700} />
        </View>
        <Txt variant="display" weight="extrabold" color={colors.brand700} center>
          Time2Give
        </Txt>
        <Txt variant="body" color={colors.textMuted} center style={{ marginTop: 4 }}>
          מחברים בין תורמים למי שצריך - במהירות ובביטחון
        </Txt>
      </View>

      <Field
        label="מספר הטלפון שלך"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="לדוגמה: 050-123-4567"
        autoFocus
      />
      <Button title="שליחת קוד אימות" onPress={submit} loading={loading} icon="arrow-back" />
      <Txt variant="caption" color={colors.textMuted} center style={{ marginTop: spacing.lg }}>
        נשלח אליך קוד חד-פעמי ב-SMS
      </Txt>

      {__DEV__ ? (
        <Card style={{ marginTop: spacing.xxl, borderWidth: 1, borderColor: colors.warning, borderStyle: 'dashed', backgroundColor: '#FBF0DA', gap: spacing.sm }}>
          <Txt variant="small" weight="bold" color={colors.warning}>
            🛠 מספרי בדיקה (בלי SMS)
          </Txt>
          <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            אפשר להקליד את אחד המספרים למעלה ולהתחבר מיד, או ללחוץ כאן:
          </Txt>
          {DEMO_LOGINS.map((d) => (
            <Button
              key={d.email}
              title={d.label}
              variant="secondary"
              icon={d.icon as keyof typeof Ionicons.glyphMap}
              loading={demoEmail === d.email}
              onPress={() => demoLogin(d.email)}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = {
  logo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.brand50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.lg,
  },
};
