import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, Alert, Image, StyleSheet } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, StatBlock, Field } from '../../src/components/ui';
import { RegionPicker } from '../../src/components/RegionPicker';
import { useAuth } from '../../src/context/AuthContext';
import { setMyProfile, upsertRecipientProfile } from '../../src/lib/api';
import { getOtaDiagnostics } from '../../src/lib/otaDiagnostics';
import { supabase } from '../../src/lib/supabase';
import { ROLE_LABELS, RECIPIENT_TYPE_LABELS, LEVEL_META, type UserRole, type RecipientType } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

type Badge = { id: string; badge_type: string };

// תווית קבוצה בסגנון iOS grouped list — טקסט אפור קטן מעל הכרטיס הלבן
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Txt variant="caption" weight="bold" color={colors.textMuted} style={{ marginTop: spacing.lg, marginBottom: spacing.sm, marginRight: 4 }}>
      {children}
    </Txt>
  );
}

// שורת רשימה בסגנון iOS — אייקון + תווית + chevron אחורה, עם hairline מפריד
function Row({
  icon,
  label,
  onPress,
  loading,
  danger,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  loading?: boolean;
  danger?: boolean;
  last?: boolean;
}) {
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
        pressed && { backgroundColor: colors.surface },
      ]}
    >
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.brand700} />
      <Txt weight="medium" color={fg} style={{ flex: 1 }}>
        {label}
      </Txt>
      {loading ? (
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
      ) : (
        <Ionicons name="chevron-back" size={18} color={colors.separator} />
      )}
    </Pressable>
  );
}

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
    appAlert('אבחון OTA', report, [{ text: 'סגור' }]);
  };

  // בדיקת עדכון OTA ידנית. לא קוראים ל-reloadAsync (מקריס עם MapView) — העדכון מוחל ב-cold-restart.
  const checkUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      return appAlert('עדכוני OTA לא פעילים כאן', 'הרצה מקומית / Expo Go לא מקבלת עדכוני OTA. זה עובד רק ב-build אמיתי (TestFlight / חנות).');
    }
    if (isUpdatePending) {
      return appAlert('עדכון מוכן ✓', 'עדכון כבר הורד. סגור ופתח את האפליקציה כדי להחיל אותו.', [{ text: 'הבנתי' }]);
    }
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        return appAlert('אתה מעודכן ✓', 'אין עדכון חדש כרגע.', [
          { text: 'סגור', style: 'cancel' },
          { text: 'אבחון 🔎', onPress: showDiagnostics },
        ]);
      }
      await Updates.fetchUpdateAsync();
      appAlert('עדכון מוכן ✓', 'גרסה חדשה הותקנה. סגור ופתח את האפליקציה כדי להחיל אותה.', [{ text: 'הבנתי' }]);
    } catch (e: any) {
      appAlert('שגיאה בבדיקת עדכון', e?.message ?? String(e), [
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
    if (!name.trim()) return appAlert('חסר שם', 'הזן שם מלא');
    if (editRoles.length === 0) return appAlert('בחר תפקיד', 'בחר לפחות תפקיד אחד');
    if (regions.length === 0) return appAlert('בחר אזור', editNeedsCoverage ? 'בחר לפחות אזור אחד' : 'בחר את האזור שלך');
    setSaving(true);
    const { error } = await setMyProfile({
      full_name: name.trim(),
      roles: editRoles,
      service_regions: editNeedsCoverage ? regions : [],
    });
    if (error) {
      setSaving(false);
      return appAlert('שגיאה', error.message);
    }
    if (editIsRecipient) {
      const { error: rErr } = await upsertRecipientProfile({ recipient_type: recipientType, region: regions[0] });
      if (rErr) {
        setSaving(false);
        return appAlert('שגיאה', rErr.message);
      }
    }
    setSaving(false);
    await refreshProfile();
    setEditing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="הפרופיל שלי" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* כרטיס פרופיל — אווטאר, שם, תפקידים, באדג'ים */}
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          {!editing ? (
            <Pressable onPress={startEdit} hitSlop={12} style={styles.editBtn}>
              <Ionicons name="pencil" size={16} color={colors.brand700} />
            </Pressable>
          ) : null}
          <View style={styles.avatar}>
            {profile.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={44} color={colors.brand700} />
            )}
          </View>
          {editing ? (
            <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
              <Field label="שם מלא" value={name} onChangeText={setName} placeholder="לדוגמא: ישראל ישראלי" autoFocus />
            </View>
          ) : (
            <Txt variant="h1" weight="extrabold" center style={{ marginTop: spacing.md }}>
              {profile.full_name}
            </Txt>
          )}
          <Txt variant="caption" color={colors.textMuted} center style={{ marginTop: 2 }}>
            {profile.roles.map((r) => ROLE_LABELS[r]).join(' · ')}
          </Txt>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: spacing.md }}>
            <View style={[styles.chip, { backgroundColor: colors.brand700 }]}>
              <Txt variant="caption" weight="bold" color={colors.white}>
                Level {lvl.n} · {lvl.label}
              </Txt>
            </View>
            {profile.rating_count > 0 ? (
              <View style={[styles.chip, { backgroundColor: colors.brand50, flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                <Ionicons name="star" size={12} color={colors.brand700} />
                <Txt variant="caption" weight="bold" color={colors.brand700}>{profile.rating_avg} ({profile.rating_count})</Txt>
              </View>
            ) : null}
            {verified ? (
              <View style={[styles.chip, { backgroundColor: '#E7F4EC', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                <Txt variant="caption" weight="bold" color={colors.success}>מאומת</Txt>
              </View>
            ) : null}
          </View>
        </Card>

        {/* סטטיסטיקות */}
        <SectionLabel>הפעילות שלי</SectionLabel>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
          <StatBlock value={profile.total_donations} label="תרומות" />
          <StatBlock value={profile.total_units.toLocaleString()} label="מנות" />
          <StatBlock value={profile.total_deliveries} label="משלוחים" />
          <StatBlock value={profile.units_served} label="יחידות" />
        </Card>

        {editing ? (
          <>
            <SectionLabel>התפקידים שלי</SectionLabel>
            <Card>
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
                <SectionLabel>סוג המקבל</SectionLabel>
                <Card>
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

            <SectionLabel>{editNeedsCoverage ? 'אזורים שאני מכסה' : 'האזור שלי'}</SectionLabel>
            <Card>
              <RegionPicker value={regions} onChange={setRegions} single={editIsRecipient && !editNeedsCoverage} />
            </Card>
          </>
        ) : profile.service_regions.length > 0 ? (
          <>
            <SectionLabel>אזורים שאני מכסה</SectionLabel>
            <Card>
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
            <SectionLabel>תגים</SectionLabel>
            <Card>
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
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.xl }}>
            <View style={{ flex: 1 }}>
              <Button title="ביטול" variant="ghost" onPress={() => setEditing(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="שמירה" icon="checkmark" onPress={saveEdit} loading={saving} />
            </View>
          </View>
        ) : (
          <>
            {/* פעולות — שורות רשימה בסגנון iOS בתוך כרטיס לבן אחד */}
            <SectionLabel>הגדרות</SectionLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {profile.roles.includes('admin') ? (
                <Row icon="settings-outline" label="פאנל ניהול" onPress={() => router.push('/admin')} />
              ) : null}
              <Row icon="cloud-download-outline" label="בדוק עדכונים" onPress={checkUpdates} loading={checkingUpdate} />
              <Row icon="log-out-outline" label="התנתקות" onPress={signOut} danger last />
            </Card>
            <Txt variant="caption" color={colors.textMuted} center style={{ marginTop: spacing.lg }}>
              גרסה {Updates.runtimeVersion ?? '—'} · {Updates.updateId ? `OTA ${Updates.updateId.slice(0, 8)}` : 'build מקורי'}
            </Txt>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  editBtn: { position: 'absolute', top: spacing.md, left: spacing.md, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 14, backgroundColor: colors.card },
});
