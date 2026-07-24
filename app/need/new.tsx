import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Screen, Header, Field, Button, Txt, Pill, Card, Stepper } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { createNeed } from '../../src/lib/api';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing } from '../../src/theme/tokens';

const FOOD_OPTIONS = ['מנות חמות', "סנדוויצ'ים", 'מים ושתייה', 'פירות וירקות', 'מנות קרב', 'חטיפים ומאפים'];
const UNIT_OPTIONS = ['מנות', 'ארגזים', 'חבילות', 'כיכרות'];
const STEPS = ['מה צריך?', 'לאיזה אזור?', 'סיכום ופרסום'];

export default function NewNeed() {
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [region, setRegion] = useState<Region[]>(profile?.service_regions?.slice(0, 1) ?? []);
  const [foodType, setFoodType] = useState('מנות חמות');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('מנות');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const qty = parseInt(quantity, 10);

  const next = () => {
    if (step === 0) {
      if (!foodType.trim()) return Alert.alert('מה צריך?', 'בחרו או כתבו איזה מזון דרוש');
      if (!qty || qty <= 0) return Alert.alert('כמה?', 'מלאו כמות (מספר גדול מ-0)');
    }
    if (step === 1 && region.length !== 1) return Alert.alert('לאיזה אזור?', 'בחרו אזור אחד');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    setLoading(true);
    const { error } = await createNeed({
      region: region[0],
      food_type: foodType.trim(),
      quantity: qty,
      unit_label: unit.trim() || 'מנות',
      notes: notes.trim() || null,
    });
    setLoading(false);
    if (error) return Alert.alert('שגיאה', error.message);
    Alert.alert('הבקשה פורסמה 🎉', 'תורמים באזור קיבלו התראה', [{ text: 'מעולה', onPress: () => safeBack() }]);
  };

  return (
    <>
      <Header title="בקשת תרומה חדשה" subtitle={`שלב ${step + 1} מתוך ${STEPS.length} · ${STEPS[step]}`} onBack={() => (step === 0 ? safeBack() : setStep((s) => s - 1))} />
      <Screen scroll>
        {/* מחוון שלבים */}
        <Stepper steps={STEPS} current={step} />

        {/* שלב 1 — מה צריך */}
        {step === 0 ? (
          <>
            <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>מה היחידה צריכה?</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg }}>
              {FOOD_OPTIONS.map((f) => (
                <Pill key={f} label={f} active={foodType === f} onPress={() => setFoodType(f)} />
              ))}
            </View>
            <Field label="או כתבו סוג מזון אחר" value={foodType} onChangeText={setFoodType} placeholder="לדוגמה: מנות חמות" />

            <Txt variant="h2" weight="bold" style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>כמה?</Txt>
            <Field label="כמות" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="לדוגמה: 70" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {UNIT_OPTIONS.map((u) => (
                <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
              ))}
            </View>
          </>
        ) : null}

        {/* שלב 2 — אזור */}
        {step === 1 ? (
          <>
            <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.sm }}>לאיזה אזור?</Txt>
            <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
              הבקשה מתפרסמת ברמת אזור בלבד — לעולם לא מיקום מדויק. את הנקודה המדויקת תתאמו בטלפון לאחר התאמה.
            </Txt>
            <RegionPicker value={region} onChange={setRegion} single />
          </>
        ) : null}

        {/* שלב 3 — סיכום */}
        {step === 2 ? (
          <>
            <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>עוד משהו? (לא חובה)</Txt>
            <Field label="הערות (בלי כתובת מדויקת!)" value={notes} onChangeText={setNotes} multiline placeholder="לדוגמה: למחר בבוקר, כשר" />

            <Card style={{ marginTop: spacing.md, gap: 6 }}>
              <Txt weight="bold">סיכום הבקשה</Txt>
              <Txt variant="small" color={colors.textMuted}>מה: {qty || '—'} {unit} · {foodType}</Txt>
              <Txt variant="small" color={colors.textMuted}>אזור: {region[0] ? regionLabel(region[0]) : '—'}</Txt>
              {notes.trim() ? <Txt variant="small" color={colors.textMuted}>הערות: {notes.trim()}</Txt> : null}
            </Card>
          </>
        ) : null}

        {/* ניווט */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xl }}>
          {step > 0 ? (
            <Button title="חזרה" variant="secondary" icon="arrow-forward" onPress={() => setStep((s) => s - 1)} style={{ flex: 1 }} />
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button title="המשך" icon="arrow-back" onPress={next} style={{ flex: 2 }} />
          ) : (
            <Button title="פרסם בקשה" icon="megaphone" onPress={submit} loading={loading} style={{ flex: 2 }} />
          )}
        </View>
      </Screen>
    </>
  );
}
