import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Txt, Field, Button, Header } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing } from '../../src/theme/tokens';

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyOtp } = useAuth();
  const router = useRouter();

  const submit = async () => {
    if (code.replace(/\D/g, '').length < 4) {
      Alert.alert('קוד קצר מדי', 'הזן את הקוד שקיבלת ב-SMS');
      return;
    }
    setLoading(true);
    const { error } = await verifyOtp(phone!, code.trim());
    setLoading(false);
    if (error) {
      Alert.alert('קוד שגוי', error);
      return;
    }
    // AuthGate ינווט אוטומטית ל-onboarding / feed
  };

  return (
    <>
      <Header title="אימות קוד" onBack={() => safeBack()} />
      <Screen scroll>
        <Txt variant="body" color={colors.textMuted} style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
          שלחנו קוד חד-פעמי אל {phone}
        </Txt>
        <Field
          label="קוד האימות"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="______"
          autoFocus
          maxLength={6}
        />
        <Button title="אימות והמשך" onPress={submit} loading={loading} />
      </Screen>
    </>
  );
}
