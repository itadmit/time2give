import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, StatBlock, Divider, Field } from '../../src/components/ui';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { setMyProfile, upsertRecipientProfile } from '../../src/lib/api';
import { getOtaDiagnostics } from '../../src/lib/otaDiagnostics';
import { supabase } from '../../src/lib/supabase';
import { ROLE_LABELS, RECIPIENT_TYPE_LABELS, LEVEL_META, type UserRole, type RecipientType } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

type Badge = { id: string; badge_type: string };

const ROLE_OPTIONS: { role: UserRole; icon: keyof typeof Ionicons.glyphMap; desc: string }[] = [
  { role: 'donor', icon: 'gift', desc: 'מכין ומספק מזון' },
  { role: 'recipient', icon: 'shield-checkmark', desc: 'מבקש או מאשר תרומות' },
  { role: 'courier', icon: 'car', desc: 'מוביל תרומות למבקשים' },
];
const RECIPIENT_TYPES: RecipientType[] = ['military_unit', 'hospital', 'elderly', 'family', 'ngo', 'rescue', 'evacuee', 'emergency'];

export default function Profile() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [regions, setRegions] = useState<Region[]>([]);
  const [editRoles, setEditRoles] = useState<UserRole[]>([]);
  const [recipientType, setRecipientType] = useState<RecipientType>('military_unit');
  const [recipientRegion, setRecipientRegion] = useState<Region | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // מזהה אם עדכון כבר הורד ומחכה (יוחל בפתיחה הבאה — לא קוראים reloadAsync כי הוא מקריס עם המפה)
  const { isUpdatePending } = Updates.useUpdates();

  // אבחון OTA מהמכשיר — מציג channel/runtime/updateId + לוג expo-updates אמיתי (rollback/crash)
  const showDiagnostics = async () => {
    const report = await getOtaDiagnostics();
    Alert.alert('אבחון OTA', report, [{ text: 'סגור' }]);
  };

  // בדיקת עדכון OTA ידנית. לא קוראים ל-reloadAsync (מקריס עם MapView) — העדכון מוחל ב-cold-restart.
  const checkUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      return Alert.alert('עדכוני OTA לא פעילים כאן', 'הרצה מקומית / Expo Go לא מקבלת עדכוני OTA. זה עובד רק ב-build אמיתי (TestFlight / חנות).');
    }
    if (isUpdatePending) {
      return Alert.alert('עדכון מוכן ✓', 'עדכון כבר הורד. סגור ופתח את האפליקציה כדי להחיל אותו.', [{ text: 'הבנתי' }]);
    }
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        return Alert.alert('אתה מעודכן ✓', 'אין עדכון חדש כרגע.', [
          { text: 'סגור', style: 'cancel' },
          { text: 'אבחון 🔎', onPress: showDiagnostics },
        ]);
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('עדכון מוכן ✓', 'גרסה חדשה הותקנה. סגור ופתח את האפליקציה כדי להחיל אותה.', [{ text: 'הבנתי' }]);
    } catch (e: any) {
      Alert.alert('שגיאה בבדיקת עדכון', e?.message ?? String(e), [
        { text: 'סגור', style: 'cancel' },
        { text: 'אבחון 🔎', onPress: showDiagnostics },
      ]);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase.from('user_badges').select('id,badge_type').eq('user_id', profile.id);
    setBadges((data as Badge[]) ?? []);
    // פרופיל-מקבל (אם קיים) — כדי לטעון מראש סוג המקבל והאזור בעריכה
    const { data: rp } = await supabase
      .from('recipient_profiles')
      .select('recipient_type, region')
      .eq('user_id', profile.id)
      .maybeSingle();
    if (rp) {
      setRecipientType((rp as any).recipient_type);
      setRecipientRegion((rp as any).region);
    }
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
          <Button title="בדוק עדכונים" variant="secondary" icon="cloud-download" onPress={checkUpdates} loading={checkingUpdate} style={{ alignSelf: 'stretch' }} />
          <Txt variant="caption" color={colors.textMuted} center>
            גרסה {Updates.runtimeVersion ?? '—'} · {Updates.updateId ? `OTA ${Updates.updateId.slice(0, 8)}` : 'build מקורי'}
          </Txt>
        </View>
      </View>
    );
  }
  const lvl = LEVEL_META[profile.reputation_level];
  const verified = profile.verification_status === 'approved';
  const isRecipient = profile.roles.includes('recipient');

  // נגזרות מצב-עריכה (מבוססות על התפקידים שנבחרים כרגע בעריכה)
  const editNeedsCoverage = editRoles.includes('donor') || editRoles.includes('courier');
  const editIsRecipient = editRoles.includes('recipient');
  const toggleEditRole = (r: UserRole) =>
    setEditRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const startEdit = () => {
    setName(profile.full_name ?? '');
    setEditRoles(profile.roles);
    setRegions(profile.service_regions?.length ? profile.service_regions : recipientRegion ? [recipientRegion] : []);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!name.trim()) return Alert.alert('חסר שם', 'הזן שם מלא');
    if (editRoles.length === 0) return Alert.alert('בחר תפקיד', 'בחר לפחות תפקיד אחד');
    if (regions.length === 0) return Alert.alert('בחר אזור', editNeedsCoverage ? 'בחר לפחות אזור אחד' : 'בחר את האזור שלך');
    setSaving(true);
    const { error } = await setMyProfile({
      full_name: name.trim(),
      roles: editRoles,
      service_regions: editNeedsCoverage ? regions : [],
    });
    if (error) {
      setSaving(false);
      return Alert.alert('שגיאה', error.message);
    }
    if (editIsRecipient) {
      const { error: rErr } = await upsertRecipientProfile({ recipient_type: recipientType, region: regions[0] });
      if (rErr) {
        setSaving(false);
        return Alert.alert('שגיאה', rErr.message);
      }
    }
    setSaving(false);
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
              <Txt variant="small" weight="bold" color={colors.textMuted} style={{ marginBottom: 2 }}>
                התפקידים שלי
              </Txt>
              <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: 10 }}>
                אפשר לבחור יותר מאחד
              </Txt>
              <View style={{ gap: 8 }}>
                {ROLE_OPTIONS.map((opt) => {
                  const active = editRoles.includes(opt.role);
                  return (
                    <Pressable
                      key={opt.role}
                      onPress={() => toggleEditRole(opt.role)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 12,
                        borderWidth: 2, borderColor: active ? colors.brand700 : colors.border,
                        borderRadius: radius.md, padding: spacing.md,
                      }}
                    >
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: active ? colors.brand700 : colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name={opt.icon} size={20} color={active ? colors.white : colors.brand700} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt weight="bold">{ROLE_LABELS[opt.role]}</Txt>
                        <Txt variant="caption" color={colors.textMuted}>{opt.desc}</Txt>
                      </View>
                      {active ? <Ionicons name="checkmark-circle" size={22} color={colors.brand700} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {editIsRecipient ? (
              <>
                <View style={{ height: spacing.lg }} />
                <Card>
                  <Txt variant="small" weight="bold" color={colors.textMuted} style={{ marginBottom: 10 }}>
                    סוג המקבל
                  </Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
                </Card>
              </>
            ) : null}

            <View style={{ height: spacing.lg }} />
            <Card>
              <Txt variant="small" weight="bold" color={colors.textMuted} style={{ marginBottom: 8 }}>
                {editNeedsCoverage ? 'אזורים שאני מכסה' : 'האזור שלי'}
              </Txt>
              <RegionPicker value={regions} onChange={setRegions} single={editIsRecipient && !editNeedsCoverage} />
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
            <Button title="בדוק עדכונים" variant="secondary" icon="cloud-download" onPress={checkUpdates} loading={checkingUpdate} style={{ marginBottom: spacing.md }} />
            <Txt variant="caption" color={colors.textMuted} center style={{ marginBottom: spacing.md }}>
              גרסה {Updates.runtimeVersion ?? '—'} · {Updates.updateId ? `OTA ${Updates.updateId.slice(0, 8)}` : 'build מקורי'}
            </Txt>
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
  editBtn: { position: 'absolute' as const, top: spacing.md, right: spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand50, alignItems: 'center' as const, justifyContent: 'center' as const },
};
