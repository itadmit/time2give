import React, { useState } from 'react';
import { View, Alert, Pressable, Modal, Image, ActivityIndicator } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Header, Field, Button, Txt, Pill } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { publishOffer } from '../../src/lib/api';
import { pickAndUploadPhoto } from '../../src/lib/uploadPhoto';
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
  // null = טרם ענו · true = התורם מוביל בעצמו · false = צריך נהג מתנדב
  const [selfCourier, setSelfCourier] = useState<boolean | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundAddress, setFoundAddress] = useState<string | null>(null); // כתובת שנמצאה → מודל אישור
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const addPhoto = async () => {
    setUploadingPhoto(true);
    const { url, error } = await pickAndUploadPhoto('offers');
    setUploadingPhoto(false);
    if (error) return appAlert('שגיאה בהעלאת התמונה', error);
    if (url) setPhotoUrl(url);
  };

  const useMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return appAlert('אין הרשאה', 'לא ניתנה הרשאת מיקום');
      const pos = await Location.getCurrentPositionAsync({});
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const g = geo[0];
      if (g?.city) setCity(g.city);
      const parts = [g?.street, g?.city, g?.region].filter(Boolean) as string[];
      const addr = Array.from(new Set(parts)).join(', ') || `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
      setFoundAddress(addr);
    } catch {
      appAlert('שגיאה', 'לא ניתן לקבל מיקום');
    }
  };

  const submit = async () => {
    const qty = parseInt(quantity, 10);
    if (!foodType.trim()) return appAlert('מה תורמים?', 'בחרו או כתבו סוג מזון');
    if (!qty || qty <= 0) return appAlert('כמה?', 'מלאו כמות (מספר גדול מ-0)');
    if (selfCourier === null) return appAlert('שינוע', 'בחרו אם תוכלו לשנע את התרומה בעצמכם');
    if (regions.length === 0) {
      return appAlert('בחרו אזור', selfCourier ? 'לאילו אזורים תוכלו להגיע?' : 'באיזה אזור נמצאת התרומה?');
    }

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
      photo_url: photoUrl,
      donor_is_courier: selfCourier,
    });
    setLoading(false);
    if (error) return appAlert('שגיאה', error.message);
    appAlert('התרומה פורסמה 🎉', 'התרומה מופיעה כעת למקבלים באזור', [{ text: 'מעולה', onPress: () => safeBack() }]);
  };

  return (
    <>
      <Header title="פרסום תרומה חדשה" onBack={() => safeBack()} />
      <Screen scroll>
        {/* תמונה — משדרג את המודעה (כמו יד2) */}
        <Pressable onPress={addPhoto} disabled={uploadingPhoto} style={{ height: 170, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.brand50, borderWidth: photoUrl ? 0 : 1.5, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
          {photoUrl ? (
            <>
              <Image source={{ uri: photoUrl }} style={{ width: '100%', height: '100%' }} />
              <View style={{ position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(11,31,51,0.6)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill }}>
                <Ionicons name="camera" size={14} color={colors.white} />
                <Txt variant="caption" weight="bold" color={colors.white}>החלף תמונה</Txt>
              </View>
            </>
          ) : uploadingPhoto ? (
            <ActivityIndicator color={colors.brand700} />
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera" size={26} color={colors.brand700} />
              </View>
              <Txt weight="bold" color={colors.brand700}>הוסף תמונה</Txt>
              <Txt variant="caption" color={colors.textMuted}>מודעה עם תמונה מקבלת יותר תשומת לב</Txt>
            </View>
          )}
        </Pressable>

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

        <Section num={4} title="שינוע" hint="האם תוכלו לשנע את התרומה בעצמכם?" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Button title="כן, אביא בעצמי" icon="car" variant={selfCourier === true ? 'primary' : 'secondary'} onPress={() => setSelfCourier(true)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="לא, צריך שינוע" icon="cube" variant={selfCourier === false ? 'primary' : 'secondary'} onPress={() => setSelfCourier(false)} />
          </View>
        </View>
        {selfCourier === false ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FBF0DA', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md }}>
            <Ionicons name="information-circle" size={18} color={colors.warning} />
            <Txt variant="caption" color={colors.textMuted} style={{ flex: 1 }}>
              התרומה תופיע במפה עם סימון "צריך שינוע", ונהגים מתנדבים באזור יקבלו התראה 🚗
            </Txt>
          </View>
        ) : null}

        {selfCourier !== null ? (
          <>
            <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginTop: spacing.lg, marginBottom: 8 }}>
              {selfCourier ? 'לאילו אזורים תוכלו להגיע?' : 'באיזה אזור נמצאת התרומה?'}
            </Txt>
            <RegionPicker value={regions} onChange={setRegions} single={!selfCourier} />
          </>
        ) : null}

        <Section num={5} title="עוד פרטים (לא חובה)" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          <Toggle label="כשר" value={kosher} onToggle={() => setKosher(!kosher)} />
          <Toggle label="צמחוני" value={veg} onToggle={() => setVeg(!veg)} />
        </View>
        <Field label="הערות" value={notes} onChangeText={setNotes} multiline placeholder="לדוגמה: מוכן לאיסוף מ-14:00" />

        <Button title="פרסם תרומה" icon="gift" onPress={submit} loading={loading} style={{ marginTop: spacing.xl }} />
      </Screen>

      {/* מודל אישור מיקום — מחליף את ה-Alert, מיושר לימין ומציג את הכתובת שנמצאה */}
      <Modal visible={!!foundAddress} transparent animationType="fade" onRequestClose={() => setFoundAddress(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(11,31,51,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl }} onPress={() => setFoundAddress(null)}>
          <Pressable style={{ width: '100%', backgroundColor: colors.white, borderRadius: 24, padding: spacing.xl }} onPress={(e) => e.stopPropagation()}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.md }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#E7F6EE', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="location" size={26} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="h2" weight="extrabold">המיקום נשמר ✓</Txt>
                <Txt variant="caption" color={colors.textMuted}>יוצג למקבלים על המפה</Txt>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
              <Ionicons name="navigate" size={18} color={colors.brand700} />
              <Txt weight="bold" style={{ flex: 1 }}>{foundAddress}</Txt>
            </View>
            <Button title="מעולה" icon="checkmark" onPress={() => setFoundAddress(null)} style={{ marginTop: spacing.lg }} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
