import React, { useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Txt, Field, Button } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { useAuth } from '../../src/context/AuthContext';
import { DEMO_PASSWORD, findDemoByPhone } from '../../src/lib/demoUsers';
import { colors, spacing, radius } from '../../src/theme/tokens';

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
  const { signInWithPhone, signInDemo } = useAuth();
  const router = useRouter();

  const submit = async () => {
    const e164 = toE164(phone);
    if (!e164) {
      appAlert('מספר לא תקין', 'הזן מספר טלפון ישראלי תקין, למשל 050-1234567');
      return;
    }

    // מספרי בדיקה hardcoded (dev בלבד): כניסה מיידית בלי SMS
    const demo = __DEV__ ? findDemoByPhone(e164) : undefined;
    if (demo) {
      setLoading(true);
      const { error } = await signInDemo(demo.email, DEMO_PASSWORD);
      setLoading(false);
      if (error) appAlert('כניסת בדיקה נכשלה', error);
      return; // בלי OTP
    }

    setLoading(true);
    const { error } = await signInWithPhone(e164);
    setLoading(false);
    if (error) {
      appAlert('שגיאה בשליחת קוד', error);
      return;
    }
    router.push({ pathname: '/(auth)/otp', params: { phone: e164 } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* אייקוני שורת הסטטוס בכהה — אחרת הם לבנים על רקע בהיר ונעלמים */}
      <StatusBar style="dark" />
      {/* שורת ניווט עליונה עם כפתור חזרה (המסך הזה בלי Header) */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          <Pressable onPress={() => safeBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-forward" size={26} color={colors.brand700} />
          </Pressable>
        </View>
      </SafeAreaView>
      <Screen scroll>
      <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 32 }}>
        <View style={styles.logo}>
          <Ionicons name="heart-circle" size={64} color={colors.brand700} />
        </View>
        <Txt variant="display" weight="extrabold" color={colors.brand700} center>
          Time2Give
        </Txt>
        <Txt variant="body" color={colors.textMuted} center style={{ marginTop: 4 }}>
          הפלטפורמה שמחברת בין תורמים ליחידות צבאיות
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
        נשלח אליך קוד חד-פעמי ב-WhatsApp
      </Txt>
      </Screen>
    </View>
  );
}

const styles = {
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.brand50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
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
