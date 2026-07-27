import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { Screen, Header, Field, Button, Txt, Pill } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { createNeed } from '../../src/lib/api';
import { type Region } from '../../src/lib/regions';
import { colors, spacing } from '../../src/theme/tokens';

const FOOD_OPTIONS = ['מנות חמות', "סנדוויצ'ים", 'מים ושתייה', 'פירות וירקות', 'מנות קרב', 'חטיפים ומאפים'];
const UNIT_OPTIONS = ['מנות', 'ארגזים', 'חבילות', 'כיכרות'];

/** כותרת שלב עם עיגול ממוספר — מדריך את המשתמש בעמוד אחד פשוט (בלי ויזארד רב-שלבי). */
function Section({ num, title, hint }: { num: number; title: string; hint?: string }) {
  return (
    <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand700, alignItems: 'center', justifyContent: 'center' }}>
          <Txt weight="extrabold" color={colors.white} variant="small">{num}</Txt>
        </View>
        <Txt variant="h2" weight="bold">{title}</Txt>
      </View>
      {hint ? <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

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
    appAlert('הבקשה פורסמה 🎉', 'תורמים באזור קיבלו התראה', [{ text: 'מעולה', onPress: () => safeBack() }]);
  };

  return (
    <>
      <Header title="בקשת תרומה חדשה" onBack={() => safeBack()} />
      <Screen scroll>
        <Section num={1} title="מה צריך?" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          {FOOD_OPTIONS.map((f) => (
            <Pill key={f} label={f} active={foodType === f} onPress={() => setFoodType(f)} />
          ))}
        </View>
        <Field label="או כתבו סוג מזון אחר" value={foodType} onChangeText={setFoodType} placeholder="לדוגמה: מנות חמות" />

        <Section num={2} title="כמה?" />
        <Field label="כמות" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="לדוגמה: 70" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {UNIT_OPTIONS.map((u) => (
            <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>

        <Section num={3} title="לאיזה אזור?" hint="הבקשה מתפרסמת ברמת אזור בלבד — לעולם לא מיקום מדויק. את הנקודה המדויקת תתאמו בטלפון." />
        <RegionPicker value={region} onChange={setRegion} single />

        <Section num={4} title="הערות (לא חובה)" />
        <Field label="בלי כתובת מדויקת!" value={notes} onChangeText={setNotes} multiline placeholder="לדוגמה: למחר בבוקר, כשר" />

        <Button title="פרסם בקשה" icon="megaphone" onPress={submit} loading={loading} style={{ marginTop: spacing.xl }} />
      </Screen>
    </>
  );
}
