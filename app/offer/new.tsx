import React, { useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Field, Button, Txt, Card } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { publishOffer } from '../../src/lib/api';
import type { Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

const STEPS = ['פרטי התרומה', 'מיקום ואזורים', 'סיכום ופרסום'];

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: value ? colors.brand700 : colors.brand50 }}
    >
      <Ionicons name={value ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={value ? colors.white : colors.brand700} />
      <Txt variant="small" weight="bold" color={value ? colors.white : colors.brand700}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** מחוון שלבים - עיגולים ממוספרים עם קו מחבר */
function StepIndicator({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <React.Fragment key={label}>
            <View style={{ alignItems: 'center', width: 80 }}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done || active ? colors.brand700 : colors.brand50,
                }}
              >
                {done ? (
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                ) : (
                  <Txt variant="small" weight="bold" color={active ? colors.white : colors.textMuted}>
                    {i + 1}
                  </Txt>
                )}
              </View>
              <Txt variant="caption" weight={active ? 'bold' : 'regular'} color={active ? colors.brand700 : colors.textMuted} center style={{ marginTop: 4 }}>
                {label}
              </Txt>
            </View>
            {i < STEPS.length - 1 ? (
              <View style={{ flex: 1, height: 2, backgroundColor: i < step ? colors.brand700 : colors.border, marginBottom: 18 }} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Txt variant="small" color={colors.textMuted}>{label}</Txt>
      <Txt variant="small" weight="bold">{value}</Txt>
    </View>
  );
}

export default function NewOffer() {
  const router = useRouter();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [foodType, setFoodType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('מנות');
  const [city, setCity] = useState('');
  const [regions, setRegions] = useState<Region[]>(profile?.service_regions ?? []);
  const [kosher, setKosher] = useState(false);
  const [veg, setVeg] = useState(false);
  const [selfCourier, setSelfCourier] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('אין הרשאה', 'לא ניתנה הרשאת מיקום');
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo[0]?.city) setCity(geo[0].city);
      Alert.alert('מיקום נשמר', 'מיקום המוצא יוצג על המפה');
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לקבל מיקום');
    }
  };

  // ולידציה לכל שלב לפני המעבר הבא
  const validateStep = (): boolean => {
    if (step === 0) {
      const qty = parseInt(quantity, 10);
      if (!foodType.trim() || !qty || qty <= 0) {
        Alert.alert('חסרים פרטים', 'מלא סוג מזון וכמות תקינה');
        return false;
      }
    }
    if (step === 1) {
      if (regions.length === 0) {
        Alert.alert('בחר אזורים', 'לאילו אזורים אתה יכול להגיע?');
        return false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    if (step === 0) return safeBack();
    setStep((s) => s - 1);
  };

  const submit = async () => {
    const qty = parseInt(quantity, 10);
    setLoading(true);
    const { error } = await publishOffer({
      food_type: foodType.trim(),
      quantity: qty,
      unit_label: unit.trim() || 'מנות',
      service_regions: regions,
      origin_city: city.trim() || null,
      origin_lat: coords?.lat ?? null,
      origin_lng: coords?.lng ?? null,
      kosher,
      vegetarian: veg,
      notes: notes.trim() || null,
      donor_is_courier: selfCourier,
    });
    setLoading(false);
    if (error) return Alert.alert('שגיאה', error.message);
    Alert.alert('התרומה פורסמה', 'התרומה מופיעה כעת למקבלים באזור', [{ text: 'מעולה', onPress: () => safeBack() }]);
  };

  return (
    <>
      <Header title="יצירת תרומה חדשה" onBack={back} />
      <Screen scroll>
        <View style={{ marginTop: spacing.md }}>
          <StepIndicator step={step} />
        </View>

        {/* שלב 1 - פרטי התרומה */}
        {step === 0 && (
          <View>
            <Field label="סוג מזון" value={foodType} onChangeText={setFoodType} placeholder="לדוגמא: סנדוויצ'ים" autoFocus />
            <Field label="כמות" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="לדוגמא: 50" />
            <Field label="יחידת מידה" value={unit} onChangeText={setUnit} placeholder="לדוגמא: מנות" />
            <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 8 }}>
              מאפיינים
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Toggle label="כשר" value={kosher} onToggle={() => setKosher(!kosher)} />
              <Toggle label="צמחוני" value={veg} onToggle={() => setVeg(!veg)} />
            </View>
          </View>
        )}

        {/* שלב 2 - מיקום ואזורים */}
        {step === 1 && (
          <View>
            <Field label="עיר מוצא" value={city} onChangeText={setCity} placeholder="לדוגמא: אשקלון" />
            <Button title={coords ? 'המיקום נשמר ✓' : 'השתמש במיקומי למפה'} variant="secondary" icon="location" onPress={useMyLocation} style={{ marginBottom: spacing.lg }} />
            <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 8 }}>
              לאילו אזורים אתה יכול להגיע?
            </Txt>
            <RegionPicker value={regions} onChange={setRegions} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg }}>
              <Toggle label="אני מוביל בעצמי" value={selfCourier} onToggle={() => setSelfCourier(!selfCourier)} />
            </View>
          </View>
        )}

        {/* שלב 3 - סיכום ופרסום */}
        {step === 2 && (
          <View>
            <Field label="הערות" value={notes} onChangeText={setNotes} multiline placeholder="לדוגמא: מוכן לאיסוף מ-14:00" />
            <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 8 }}>
              סיכום
            </Txt>
            <Card style={{ marginBottom: spacing.lg }}>
              <SummaryRow label="סוג מזון" value={foodType.trim() || '-'} />
              <SummaryRow label="כמות" value={`${quantity || '-'} ${unit.trim() || ''}`} />
              <SummaryRow label="עיר מוצא" value={city.trim() || '-'} />
              <SummaryRow label="אזורי הגעה" value={regions.length ? `${regions.length} אזורים` : '-'} />
              <SummaryRow label="מאפיינים" value={[kosher && 'כשר', veg && 'צמחוני', selfCourier && 'מוביל עצמי'].filter(Boolean).join(', ') || '-'} />
            </Card>
          </View>
        )}

        {/* ניווט בין שלבים */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button title={step === 0 ? 'ביטול' : 'הקודם'} variant="ghost" onPress={back} />
          </View>
          <View style={{ flex: 1 }}>
            {step < STEPS.length - 1 ? (
              <Button title="הבא" icon="arrow-back" onPress={next} />
            ) : (
              <Button title="פרסם תרומה" icon="gift" onPress={submit} loading={loading} />
            )}
          </View>
        </View>
      </Screen>
    </>
  );
}
