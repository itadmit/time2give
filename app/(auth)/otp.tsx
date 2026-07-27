import React, { useRef, useState } from 'react';
import { View, Alert, TextInput, Pressable, StyleSheet } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useLocalSearchParams } from 'expo-router';
import { Screen, Txt, Button, Header } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, radius } from '../../src/theme/tokens';

const CODE_LENGTH = 6;

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyOtp } = useAuth();
  const inputRef = useRef<TextInput>(null);

  const doVerify = async (value: string) => {
    if (loading) return;
    setLoading(true);
    const { error } = await verifyOtp(phone!, value);
    setLoading(false);
    if (error) {
      setCode('');
      appAlert('קוד שגוי', error);
      inputRef.current?.focus();
      return;
    }
    // AuthGate ינווט אוטומטית ל-onboarding / feed
  };

  const onChange = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    // כשמגיעים לספרה האחרונה — שולחים אוטומטית
    if (digits.length === CODE_LENGTH) doVerify(digits);
  };

  return (
    <>
      <Header title="אימות קוד" onBack={() => safeBack()} />
      <Screen>
        <Txt variant="body" color={colors.textMuted} center style={{ marginTop: spacing.xl, marginBottom: spacing.sm }}>
          שלחנו קוד חד-פעמי בן {CODE_LENGTH} ספרות אל:
        </Txt>
        {/* writingDirection ltr — המספר מוצג משמאל-לימין כך שה-+ בצד שמאל, וממורכז */}
        <Txt variant="body" weight="bold" color={colors.text} center style={{ marginBottom: spacing.xl, writingDirection: 'ltr' }}>
          {phone}
        </Txt>

        {/* תיבות ספרה-לספרה. TextInput שקוף מעליהן תופס את ההקלדה ואת מילוי-האוטומטי מ-SMS. */}
        <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxesRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const char = code[i] ?? '';
            const active = i === code.length;
            return (
              <View key={i} style={[styles.box, char ? styles.boxFilled : null, active ? styles.boxActive : null]}>
                <Txt variant="h1" weight="extrabold" color={colors.brand700}>{char}</Txt>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          caretHidden
          style={styles.hiddenInput}
        />

        <Button
          title="אימות והמשך"
          onPress={() => (code.length === CODE_LENGTH ? doVerify(code) : appAlert('קוד קצר מדי', `הזן ${CODE_LENGTH} ספרות`))}
          loading={loading}
          style={{ marginTop: spacing.xxl }}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  // direction ltr — הספרה הראשונה משמאל, כמו שמצפים בקוד מספרי (גם ב-RTL)
  boxesRow: {
    flexDirection: 'row',
    direction: 'ltr',
    justifyContent: 'center',
    gap: 10,
  },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.brand500, backgroundColor: colors.brand50 },
  boxActive: { borderColor: colors.brand700 },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
