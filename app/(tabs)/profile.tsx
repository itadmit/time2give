import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, StatBlock, Divider, Field } from '../../src/components/ui';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { setMyProfile } from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { ROLE_LABELS, LEVEL_META } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

type Badge = { id: string; badge_type: string };

export default function Profile() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('user_badges').select('id,badge_type').eq('user_id', profile.id);
    setBadges((data as Badge[]) ?? []);
  }, [profile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // אורח (בלי התחברות) — מסך הנעה להרשמה/התחברות
  if (!session || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <Header title="פרופיל" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person-circle-outline" size={56} color={colors.brand700} />
          </View>
          <Txt variant="h2" weight="extrabold" center>
            אתה גולש כאורח
          </Txt>
          <Txt color={colors.textMuted} center style={{ marginBottom: spacing.md }}>
            אפשר לצפות בתרומות בחופשיות. כדי לבקש תרומה, לאשר, או לפרסם — יש להתחבר.
          </Txt>
          <Button title="הרשמה / התחברות" icon="log-in" onPress={() => router.push('/(auth)/phone')} style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }
  const lvl = LEVEL_META[profile.reputation_level];
  const verified = profile.verification_status === 'approved';
  const isRecipient = profile.roles.includes('recipient');

  const startEdit = () => {
    setName(profile.full_name ?? '');
    setRegions(profile.service_regions ?? []);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!name.trim()) return Alert.alert('חסר שם', 'הזן שם מלא');
    if (regions.length === 0) return Alert.alert('בחר אזורים', isRecipient ? 'בחר את האזור שלך' : 'בחר לפחות אזור אחד');
    setSaving(true);
    const { error } = await setMyProfile({
      full_name: name.trim(),
      roles: profile.roles,
      service_regions: regions,
    });
    setSaving(false);
    if (error) return Alert.alert('שגיאה', error.message);
    await refreshProfile();
    setEditing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="הפרופיל שלי" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
          {!editing ? (
            <Pressable onPress={startEdit} hitSlop={12} style={styles.editBtn}>
              <Ionicons name="pencil" size={18} color={colors.brand700} />
            </Pressable>
          ) : null}
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.brand700} />
          </View>
          {editing ? (
            <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
              <Field label="שם מלא" value={name} onChangeText={setName} placeholder="לדוגמא: ישראל ישראלי" autoFocus />
            </View>
          ) : (
            <Txt variant="h1" weight="extrabold" style={{ marginTop: spacing.md }}>
              {profile.full_name}
            </Txt>
          )}
          <Txt variant="caption" color={colors.textMuted}>
            {profile.roles.map((r) => ROLE_LABELS[r]).join(' · ')}
          </Txt>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
            <View style={[styles.chip, { backgroundColor: colors.brand700 }]}>
              <Txt variant="caption" weight="bold" color={colors.white}>
                Level {lvl.n} · {lvl.label}
              </Txt>
            </View>
            {profile.rating_count > 0 ? (
              <View style={[styles.chip, { backgroundColor: colors.brand50 }]}>
                <Txt variant="caption" weight="bold" color={colors.brand700}>
                  ⭐ {profile.rating_avg} ({profile.rating_count})
                </Txt>
              </View>
            ) : null}
            {verified ? (
              <View style={[styles.chip, { backgroundColor: '#E7F4EC' }]}>
                <Txt variant="caption" weight="bold" color={colors.success}>
                  ✓ מאומת
                </Txt>
              </View>
            ) : null}
          </View>
        </Card>

        <View style={{ height: spacing.lg }} />
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
          <StatBlock value={profile.total_donations} label="תרומות" />
          <StatBlock value={profile.total_units.toLocaleString()} label="מנות" />
          <StatBlock value={profile.total_deliveries} label="משלוחים" />
          <StatBlock value={profile.units_served} label="יחידות" />
        </Card>

        {editing ? (
          <>
            <View style={{ height: spacing.lg }} />
            <Card>
              <Txt variant="small" weight="bold" color={colors.textMuted} style={{ marginBottom: 8 }}>
                {isRecipient ? 'האזור שלי' : 'אזורים שאני מכסה'}
              </Txt>
              <RegionPicker value={regions} onChange={setRegions} single={isRecipient} />
            </Card>
          </>
        ) : profile.service_regions.length > 0 ? (
          <>
            <View style={{ height: spacing.lg }} />
            <Card>
              <Txt variant="small" weight="bold" color={colors.textMuted} style={{ marginBottom: 8 }}>
                אזורים שאני מכסה
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {profile.service_regions.map((r) => (
                  <View key={r} style={[styles.chip, { backgroundColor: colors.brand50 }]}>
                    <Txt variant="caption" weight="medium" color={colors.brand700}>
                      {regionLabel(r)}
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {badges.length > 0 ? (
          <>
            <View style={{ height: spacing.lg }} />
            <Card>
              <Txt variant="small" weight="bold" color={colors.textMuted} style={{ marginBottom: 8 }}>
                תגים
              </Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {badges.map((b) => (
                  <View key={b.id} style={[styles.chip, { backgroundColor: '#FBF0DA' }]}>
                    <Txt variant="caption" weight="bold" color={colors.warning}>
                      🏅 {b.badge_type}
                    </Txt>
                  </View>
                ))}
              </View>
            </Card>
          </>
        ) : null}

        {editing ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
            <View style={{ flex: 1 }}>
              <Button title="ביטול" variant="ghost" onPress={() => setEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="שמירה" icon="checkmark" onPress={saveEdit} loading={saving} />
            </View>
          </View>
        ) : (
          <>
            <Divider />
            {profile.roles.includes('admin') ? (
              <Button title="פאנל ניהול" icon="settings" onPress={() => router.push('/admin')} style={{ marginBottom: spacing.md }} />
            ) : null}
            <Button title="התנתקות" variant="ghost" icon="log-out" onPress={signOut} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = {
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brand50, alignItems: 'center' as const, justifyContent: 'center' as const },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  editBtn: { position: 'absolute' as const, top: spacing.md, left: spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand50, alignItems: 'center' as const, justifyContent: 'center' as const },
};
