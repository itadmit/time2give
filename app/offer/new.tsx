import React, { useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Field, Button, Txt, Pill } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { publishOffer } from '../../src/lib/api';
import type { Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

const FOOD_OPTIONS = ['מנות חמות', "סנדוויצ'ים", 'מים ושתייה', 'פירות וירקות', 'מנות קרב', 'חטיפים ומאפים'];
const UNIT_OPTIONS = ['מנות', 'ארגזים', 'חבילות', 'כיכרות'];

/** כותרת שלב עם עיגול ממוספר — מדריך את המשתמש בעמוד אחד פשוט. */
function Section({ num, title, hint }: { num: number; title: string; hint?: string }) {
  return (
    <View style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
          <Txt weight="extrabold" color={colors.white} variant="small">{num}</Txt>
        </View>
        <Txt variant="h2" weight="bold">{title}</Txt>
      </View>
      {hint ? <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>{hint}</Txt> : null}
    </View>
  );
}

function Toggle({ label, value, onToggle }: { label: string; value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: value ? colors.brand700 : colors.brand50 }}
    >
      <Ionicons name={value ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={value ? colors.white : colors.brand700} />
      <Txt variant="small" weight="bold" color={value ? colors.white : colors.brand700}>{label}</Txt>
    </Pressable>
  );
}

export default function NewOffer() {
  const { profile } = useAuth();
  const [foodType, setFoodType] = useState('מנות חמות');
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
      Alert.alert('מיקום נשמר ✓', 'מיקום המוצא יוצג על המפה');
    } catch {
      Alert.alert('שגיאה', 'לא ניתן לקבל מיקום');
    }
  };

  const submit = async () => {
    const qty = parseInt(quantity, 10);
    if (!foodType.trim()) return Alert.alert('מה תורמים?', 'בחרו או כתבו סוג מזון');
    if (!qty || qty <= 0) return Alert.alert('כמה?', 'מלאו כמות (מספר גדול מ-0)');
    if (regions.length === 0) return Alert.alert('בחרו אזורים', 'לאילו אזורים אפשר להגיע?');

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
    Alert.alert('התרומה פורסמה 🎉', 'התרומה מופיעה כעת למקבלים באזור', [{ text: 'מעולה', onPress: () => safeBack() }]);
  };

  return (
    <>
      <Header title="פרסום תרומה חדשה" onBack={() => safeBack()} />
      <Screen scroll>
        <Section num={1} title="מה תורמים?" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          {FOOD_OPTIONS.map((f) => (
            <Pill key={f} label={f} active={foodType === f} onPress={() => setFoodType(f)} />
          ))}
        </View>
        <Field label="או כתבו סוג מזון אחר" value={foodType} onChangeText={setFoodType} placeholder="לדוגמה: סנדוויצ'ים" />

        <Section num={2} title="כמה?" />
        <Field label="כמות" value={quantity} onChangeText={setQuantity} keyboardType="number-pad" placeholder="לדוגמה: 50" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {UNIT_OPTIONS.map((u) => (
            <Pill key={u} label={u} active={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>

        <Section num={3} title="מאיפה אוספים?" hint="הכי קל: לחצו על הכפתור והמיקום יימלא לבד." />
        <Button title={coords ? 'המיקום שלי נשמר ✓' : 'השתמש במיקום שלי'} variant="secondary" icon="location" onPress={useMyLocation} style={{ marginBottom: spacing.md }} />
        <Field label="עיר מוצא (לא חובה)" value={city} onChangeText={setCity} placeholder="לדוגמה: אשקלון" />
        <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: 8 }}>
          לאילו אזורים אפשר להגיע?
        </Txt>
        <RegionPicker value={regions} onChange={setRegions} />

        <Section num={4} title="עוד פרטים (לא חובה)" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          <Toggle label="כשר" value={kosher} onToggle={() => setKosher(!kosher)} />
          <Toggle label="צמחוני" value={veg} onToggle={() => setVeg(!veg)} />
          <Toggle label="אני מוביל בעצמי" value={selfCourier} onToggle={() => setSelfCourier(!selfCourier)} />
        </View>
        <Field label="הערות" value={notes} onChangeText={setNotes} multiline placeholder="לדוגמה: מוכן לאיסוף מ-14:00" />

        <Button title="פרסם תרומה" icon="gift" onPress={submit} loading={loading} style={{ marginTop: spacing.xl }} />
      </Screen>
    </>
  );
}
