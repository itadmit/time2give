import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Header, Field, Button, Txt } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { createNeed } from '../../src/lib/api';
import type { Region } from '../../src/lib/regions';
import { colors, spacing } from '../../src/theme/tokens';

export default function NewNeed() {
  const router = useRouter();
  const { profile } = useAuth();
  const [region, setRegion] = useState<Region[]>(profile?.service_regions?.slice(0, 1) ?? []);
  const [foodType, setFoodType] = useState('סנדוויצ\'ים');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('מנות');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const qty = parseInt(quantity, 10);
    if (region.length !== 1) return Alert.alert('בחר אזור', 'בחר את האזור של הבקשה');
    if (!foodType.trim() || !qty || qty <= 0) return Alert.alert('חסרים פרטים', 'מלא סוג וכמות');
    setLoading(true);
    const { data, error } = await createNeed({
      region: region[0],
      food_type: foodType.trim(),
      quantity: qty,
      unit_label: unit.trim() || 'מנות',
      notes: notes.trim() || null,
    });
    setLoading(false);
    if (error) return Alert.alert('שגיאה', error.message);
    Alert.alert('הבקשה פורסמה', 'תורמים באזור קיבלו התראה', [{ text: 'מעולה', onPress: () => safeBack() }]);
  };

  return (
    <>
      <Header title="בקשת תרומה חדשה" onBack={() => safeBack()} />
      <Screen scroll>
        <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
          הבקשה מתפרסמת ברמת אזור בלבד - לעולם לא מיקום מדויק. הנקודה המדויקת מתואמת טלפונית לאחר התאמה.
        </Txt>
        <Field label="סוג מזון" value={foodType} onChangeText={setFoodType} placeholder="לדוגמא: סנדוויצ'ים" />
        <Field label="כמות" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="לדוגמא: 70" />
        <Field label="יחידת מידה" value={unit} onChangeText={setUnit} placeholder="לדוגמא: מנות" />
        <Field label="הערות (ללא מיקום!)" value={notes} onChangeText={setNotes} multiline placeholder="לדוגמא: למחר בבוקר, כשר" />

        <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 8 }}>
          אזור
        </Txt>
        <RegionPicker value={region} onChange={setRegion} single />

        <Button title="פרסם בקשה" icon="megaphone" onPress={submit} loading={loading} style={{ marginTop: spacing.xl }} />
      </Screen>
    </>
  );
}
