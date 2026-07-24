import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Txt, Field, Button, Header, Card, Divider } from '../../src/components/ui';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { setMyProfile, upsertRecipientProfile } from '../../src/lib/api';
import { ROLE_LABELS, RECIPIENT_TYPE_LABELS, type UserRole, type RecipientType } from '../../src/lib/domain';
import type { Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

const ROLE_OPTIONS: { role: UserRole; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { role: 'donor', icon: 'gift', desc: 'מכין/מספק מזון' },
  { role: 'recipient', icon: 'shield-checkmark', desc: 'נציג יחידה / רס"פ' },
  { role: 'coordinator', icon: 'git-network', desc: 'מנהל שינוע' },
  { role: 'courier', icon: 'car', desc: 'מוביל תרומות' },
];

const RECIPIENT_TYPES: RecipientType[] = ['military_unit', 'hospital', 'elderly', 'family', 'ngo', 'rescue', 'evacuee', 'emergency'];

export default function Onboarding() {
  const { refreshProfile, signOut } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [recipientType, setRecipientType] = useState<RecipientType>('military_unit');
  const [loading, setLoading] = useState(false);

  const isRecipient = role === 'recipient';
  const needsCoverage = role === 'donor' || role === 'courier' || role === 'coordinator';

  const save = async () => {
    if (!name.trim()) return Alert.alert('חסר שם', 'הזן שם מלא');
    if (!role) return Alert.alert('בחר תפקיד', 'יש לבחור תפקיד אחד');
    if (needsCoverage && regions.length === 0) return Alert.alert('בחר אזורים', 'בחר לפחות אזור אחד שאתה מכסה');
    if (isRecipient && regions.length !== 1) return Alert.alert('בחר אזור', 'בחר את האזור שלך');

    setLoading(true);
    const { error } = await setMyProfile({
      full_name: name.trim(),
      roles: [role],
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

        <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 8 }}>
          מה התפקיד שלך?
        </Txt>
        <View style={{ gap: 10, marginBottom: spacing.xl }}>
          {ROLE_OPTIONS.map((opt) => {
            const active = role === opt.role;
            return (
              <Pressable key={opt.role} onPress={() => setRole(opt.role)}>
                <Card style={{ borderWidth: 2, borderColor: active ? colors.brand700 : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: active ? colors.brand700 : colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={opt.icon} size={22} color={active ? colors.white : colors.brand700} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold">{ROLE_LABELS[opt.role]}</Txt>
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
              {isRecipient ? 'באיזה אזור אתה?' : 'לאילו אזורים אתה יכול להגיע?'}
            </Txt>
            <RegionPicker value={regions} onChange={setRegions} single={isRecipient} />
            <View style={{ height: spacing.xl }} />
          </>
        )}

        <Button title="סיום והתחלה" onPress={save} loading={loading} />
        <Button title="התנתקות" variant="ghost" onPress={signOut} style={{ marginTop: spacing.md }} />
      </Screen>
    </>
  );
}
