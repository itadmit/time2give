import React, { useEffect, useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Txt, Field, Button, Header, Card, Divider } from '../../src/components/ui';
import { RegionPicker } from '../../src/components/RegionPicker';
import { PENDING_ROLE_KEY } from '../../src/components/RoleWizard';
import { useAuth } from '../../src/context/AuthContext';
import { setMyProfile, upsertRecipientProfile } from '../../src/lib/api';
import { ROLE_LABELS, RECIPIENT_TYPE_LABELS, type UserRole, type RecipientType } from '../../src/lib/domain';
import type { Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

// שלושה תפקידים בלבד: תורם / מבקש / נהג מתנדב (מאחד את הרכז והנהג הישנים).
const ROLE_OPTIONS: { role: UserRole; icon: keyof typeof Ionicons.glyphMap; desc: string; disabled?: boolean }[] = [
  { role: 'donor', icon: 'gift', desc: 'מכין ומספק מזון' },
  { role: 'recipient', icon: 'shield-checkmark', desc: 'מבקש או מאשר תרומות' },
  { role: 'courier', icon: 'car', desc: 'מוביל תרומות למבקשים' },
];

const RECIPIENT_TYPES: RecipientType[] = ['military_unit', 'hospital', 'elderly', 'family', 'ngo', 'rescue', 'evacuee', 'emergency'];

export default function Onboarding() {
  const { refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [recipientType, setRecipientType] = useState<RecipientType>('military_unit');
  const [loading, setLoading] = useState(false);

  // תפקיד שנבחר בויזארד הפתיחה — נטען מראש
  useEffect(() => {
    AsyncStorage.getItem(PENDING_ROLE_KEY).then((r) => {
      if (r === 'donor' || r === 'recipient' || r === 'courier') setRoles([r as UserRole]);
      AsyncStorage.removeItem(PENDING_ROLE_KEY);
    });
  }, []);

  const isRecipient = roles.includes('recipient');
  // תורם ונהג מתנדב בוחרים אזורים שהם יכולים להגיע אליהם
  const needsCoverage = roles.includes('donor') || roles.includes('courier');
  const toggleRole = (r: UserRole) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const save = async () => {
    if (!name.trim()) return Alert.alert('חסר שם', 'הזן שם מלא');
    if (roles.length === 0) return Alert.alert('בחר תפקיד', 'בחר לפחות תפקיד אחד');
    if (regions.length === 0) return Alert.alert('בחר אזור', needsCoverage ? 'בחר לפחות אזור אחד' : 'בחר את האזור שלך');

    setLoading(true);
    const { error } = await setMyProfile({
      full_name: name.trim(),
      roles,
      service_regions: needsCoverage ? regions : [],
    });
    if (error) {
      setLoading(false);
      return Alert.alert('שגיאה', error.message);
    }
    if (isRecipient) {
      const { error: rErr } = await upsertRecipientProfile({ recipient_type: recipientType, region: regions[0] });
      if (rErr) {
        setLoading(false);
        return Alert.alert('שגיאה', rErr.message);
      }
    }
    await refreshProfile();
    setLoading(false);
  };

  return (
    <>
      <Header title="הגדרת פרופיל" />
      <Screen scroll>
        <Field label="שם מלא" value={name} onChangeText={setName} placeholder="לדוגמא: ישראל ישראלי" autoFocus />

        <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 2 }}>
          מה התפקידים שלך?
        </Txt>
        <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: 8 }}>
          אפשר לבחור יותר מאחד (למשל תורם וגם נהג מתנדב)
        </Txt>
        <View style={{ gap: 10, marginBottom: spacing.xl }}>
          {ROLE_OPTIONS.map((opt) => {
            const active = roles.includes(opt.role);
            return (
              <Pressable key={opt.role} onPress={() => !opt.disabled && toggleRole(opt.role)} disabled={opt.disabled}>
                <Card style={{ borderWidth: 2, borderColor: active ? colors.brand700 : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 12, opacity: opt.disabled ? 0.6 : 1 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: opt.disabled ? colors.border : active ? colors.brand700 : colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={opt.disabled ? 'lock-closed' : opt.icon} size={22} color={opt.disabled ? colors.textMuted : active ? colors.white : colors.brand700} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" color={opt.disabled ? colors.textMuted : colors.text}>{ROLE_LABELS[opt.role]}</Txt>
                    <Txt variant="caption" color={colors.textMuted}>
                      {opt.desc}
                    </Txt>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={colors.brand700} /> : null}
                </Card>
              </Pressable>
            );
          })}
        </View>

        {isRecipient ? (
          <>
            <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 8 }}>
              סוג המקבל
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.xl }}>
              {RECIPIENT_TYPES.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setRecipientType(t)}
                  style={{ paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: recipientType === t ? colors.brand900 : colors.brand50 }}
                >
                  <Txt variant="small" weight="bold" color={recipientType === t ? colors.white : colors.brand700}>
                    {RECIPIENT_TYPE_LABELS[t]}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {(needsCoverage || isRecipient) && (
          <>
            <Divider />
            <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 8 }}>
              {needsCoverage ? 'לאילו אזורים אתה יכול להגיע?' : 'באיזה אזור אתה?'}
            </Txt>
            <RegionPicker value={regions} onChange={setRegions} single={isRecipient && !needsCoverage} />
            <View style={{ height: spacing.xl }} />
          </>
        )}

        <Button title="סיום והתחלה" onPress={save} loading={loading} />
        <Button title="התנתקות" variant="ghost" onPress={signOut} style={{ marginTop: spacing.md }} />
      </Screen>
    </>
  );
}
