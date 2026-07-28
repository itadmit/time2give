import React, { useState } from 'react';
import { View } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { Screen, Header, Field, Button, Txt, Pill } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { createNeed } from '../../src/lib/api';
import { type Region } from '../../src/lib/regions';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

const FOOD_OPTIONS = ['מנות חמות', "סנדוויצ'ים", 'מים ושתייה', 'פירות וירקות', 'מנות קרב', 'חטיפים ומאפים'];
const UNIT_OPTIONS = ['מנות', 'ארגזים', 'חבילות', 'כיכרות'];

export default function NewNeed() {
  const { profile } = useAuth();
  const [region, setRegion] = useState<Region[]>(profile?.service_regions?.slice(0, 1) ?? []);
  const [foodType, setFoodType] = useState('מנות חמות');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('מנות');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const qty = parseInt(quantity, 10);
    if (!foodType.trim()) return appAlert('מה צריך?', 'בחרו או כתבו איזה מזון דרוש');
    if (!qty || qty <= 0) return appAlert('כמה?', 'מלאו כמות (מספר גדול מ-0)');
    if (region.length !== 1) return appAlert('לאיזה אזור?', 'בחרו אזור אחד');

    setLoading(true);
    const { error } = await createNeed({
      region: region[0],
      food_type: foodType.trim(),
      quantity: qty,
      unit_label: unit.trim() || 'מנות',
      notes: notes.trim() || null,
    });
    setLoading(false);
    if (error) return appAlert('שגיאה', error.message);
    appAlert('הבקשה פורסמה', 'תורמים באזור קיבלו התראה', [{ text: 'מעולה', onPress: () => safeBack() }]);
  };

  return (
    <>
      <Header title="בקשת תרומה חדשה" onBack={() => safeBack()} />
      <Screen scroll style={{ backgroundColor: colors.surface }}>
        {/* ── מה צריך + כמות ── */}
        <Txt
          variant="caption"
          weight="bold"
          color={colors.textMuted}
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm, marginRight: 4 }}
        >
          מה צריך?
        </Txt>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.lg,
            ...shadow.card,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
            {FOOD_OPTIONS.map((f) => (
              <Pill key={f} label={f} active={foodType === f} onPress={() => setFoodType(f)} />
            ))}
          </View>
          <Field label="או כתבו סוג מזון אחר" value={foodType} onChangeText={setFoodType} placeholder="לדוגמה: מנות חמות" />

          <View style={{ height: spacing.lg }} />
          <Field label="כמות" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="לדוגמה: 70" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md }}>
            {UNIT_OPTIONS.map((u) => (
              <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
            ))}
          </View>
        </View>

        {/* ── לאיזה אזור ── */}
        <Txt
          variant="caption"
          weight="bold"
          color={colors.textMuted}
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm, marginRight: 4 }}
        >
          לאיזה אזור?
        </Txt>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.lg,
            ...shadow.card,
          }}
        >
          <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>
            הבקשה מתפרסמת ברמת אזור בלבד — לעולם לא מיקום מדויק. את הנקודה המדויקת תתאמו בטלפון.
          </Txt>
          <RegionPicker value={region} onChange={setRegion} single />
        </View>

        {/* ── הערות ── */}
        <Txt
          variant="caption"
          weight="bold"
          color={colors.textMuted}
          style={{ marginTop: spacing.lg, marginBottom: spacing.sm, marginRight: 4 }}
        >
          הערות (לא חובה)
        </Txt>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: spacing.lg,
            ...shadow.card,
          }}
        >
          <Field label="בלי כתובת מדויקת!" value={notes} onChangeText={setNotes} multiline placeholder="לדוגמה: למחר בבוקר, כשר" />
        </View>

        <Button title="פרסם בקשה" icon="megaphone" onPress={submit} loading={loading} style={{ marginTop: spacing.xl }} />
      </Screen>
    </>
  );
}
