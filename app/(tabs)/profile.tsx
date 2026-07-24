import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
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
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  // מזהה אם עדכון כבר הורד ומחכה להפעלה מחדש (המצב הנפוץ שגורם ל"לא מתעדכן")
  const { isUpdatePending } = Updates.useUpdates();

  // בדיקת עדכון OTA ידנית (EAS Update) — עוזר לראות שינויי JS ב-TestFlight בלי build חדש
  const checkUpdates = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      return Alert.alert('עדכוני OTA לא פעילים כאן', 'הרצה מקומית / Expo Go לא מקבלת עדכוני OTA. זה עובד רק ב-build אמיתי (TestFlight / חנות).');
    }
    // אם עדכון כבר הורד ברקע — רק צריך לטעון מחדש כדי להחיל אותו
    if (isUpdatePending) {
      return Alert.alert('עדכון מוכן ✓', 'עדכון כבר הורד ומחכה. לטעון מחדש עכשיו?', [
        { text: 'אחר כך', style: 'cancel' },
        { text: 'טען מחדש', onPress: () => Updates.reloadAsync() },
      ]);
    }
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setCheckingUpdate(false);
        // ייתכן שעדכון כבר הורד קודם אך טרם הופעל — נותנים אפשרות לטעון מחדש בכל זאת
        return Alert.alert('אתה מעודכן ✓', 'אין עדכון חדש בשרת. אם שינוי אמור כבר להיות מותקן, נסה לטעון מחדש.', [
          { text: 'סגור', style: 'cancel' },
          { text: 'טען מחדש בכל זאת', onPress: () => Updates.reloadAsync() },
        ]);
      }
      await Updates.fetchUpdateAsync();
      Alert.alert('עדכון הותקן', 'האפליקציה תיטען מחדש כדי להחיל את העדכון.', [
        { text: 'טען מחדש', onPress: () => Updates.reloadAsync() },
      ]);
    } catch (e: any) {
      Alert.alert('שגיאה בבדיקת עדכון', e?.message ?? String(e));
    } finally {
      setCheckingUpdate(false);
    }
  };

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
  editBtn: { position: 'absolute' as const, top: spacing.md, left: spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brand50, alignItems: 'center' as const, justifyContent: 'center' as const },
};
