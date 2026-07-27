import React, { useCallback, useState } from 'react';
import { View, ScrollView, Alert, RefreshControl } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, EmptyState, Divider, Field } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import {
  adminKpis,
  adminPendingUsers,
  adminApproveUser,
  adminResetAll,
  adminGetIntegrationConfig,
  adminSetIntegrationConfig,
} from '../../src/lib/api';
import { ROLE_LABELS, type UserRole } from '../../src/lib/domain';
import { colors, spacing } from '../../src/theme/tokens';

type PendingUser = { id: string; full_name: string | null; phone: string | null; roles: UserRole[]; created_at: string };

const KPI_LABELS: Record<string, string> = {
  users: 'משתמשים',
  donors: 'תורמים',
  couriers: 'משנעים',
  recipients: 'מקבלים',
  open_needs: 'בקשות פתוחות',
  open_offers: 'תרומות פתוחות',
  assignments_total: 'שיבוצים',
  assignments_confirmed: 'הושלמו',
  total_units: 'מנות שחולקו',
  cancelled_pct: '% ביטולים',
};

export default function AdminPanel() {
  const router = useRouter();
  const [kpis, setKpis] = useState<Record<string, any> | null>(null);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waToken, setWaToken] = useState('');
  const [waInstance, setWaInstance] = useState('');
  const [waSaving, setWaSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: k, error: kErr } = await adminKpis();
    if (kErr) {
      setErr(kErr.message);
      return;
    }
    setErr(null);
    setKpis(k as Record<string, any>);
    const { data: p } = await adminPendingUsers();
    setPending((p as PendingUser[]) ?? []);
    const { data: cfg } = await adminGetIntegrationConfig();
    const map = Object.fromEntries(((cfg as { key: string; value: string | null }[]) ?? []).map((r) => [r.key, r.value ?? '']));
    setWaToken(map['whatsapp_token'] ?? '');
    setWaInstance(map['whatsapp_instance_id'] ?? '');
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const decide = async (u: PendingUser, approve: boolean) => {
    const { error } = await adminApproveUser(u.id, approve);
    if (error) return appAlert('שגיאה', error.message);
    await load();
  };

  const saveWhatsapp = async () => {
    setWaSaving(true);
    const r1 = await adminSetIntegrationConfig('whatsapp_token', waToken.trim());
    const r2 = await adminSetIntegrationConfig('whatsapp_instance_id', waInstance.trim());
    setWaSaving(false);
    if (r1.error || r2.error) return appAlert('שגיאה', (r1.error ?? r2.error)!.message);
    appAlert('נשמר', 'פרטי ה-WhatsApp עודכנו. קודי האימות יישלחו דרך iBot.');
  };

  const resetAll = () => {
    appAlert(
      'איפוס כל התוכן',
      'פעולה זו תמחק את כל התרומות, הבקשות, השיבוצים, הפיד וההתראות ותאפס מונים. המשתמשים יישארו. להמשיך?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'אפס הכל',
          style: 'destructive',
          onPress: async () => {
            const { error } = await adminResetAll();
            if (error) return appAlert('שגיאה', error.message);
            appAlert('בוצע', 'כל התוכן אופס.');
            await load();
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="פאנל ניהול" onBack={() => safeBack()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} />}
      >
        {err ? (
          <Card style={{ backgroundColor: '#F9E4E4' }}>
            <Txt weight="bold" color={colors.danger}>
              גישת אדמין נדחתה
            </Txt>
            <Txt variant="caption" color={colors.textMuted}>
              {err}
            </Txt>
          </Card>
        ) : null}

        {kpis ? (
          <>
            <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
              נתונים
            </Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {Object.entries(KPI_LABELS).map(([key, label]) => (
                <Card key={key} style={{ width: '47%', alignItems: 'center', paddingVertical: spacing.lg }}>
                  <Txt variant="h1" weight="extrabold" color={colors.brand700}>
                    {kpis[key] ?? 0}
                  </Txt>
                  <Txt variant="caption" color={colors.textMuted} center>
                    {label}
                  </Txt>
                </Card>
              ))}
            </View>
            <Divider />
          </>
        ) : null}

        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          WhatsApp (iBot) — קודי אימות
        </Txt>
        <Card style={{ marginBottom: spacing.lg }}>
          <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
            קודי ה-OTP נשלחים ב-WhatsApp דרך iBot. הזן את ה-Token וה-Instance ID מהדשבורד של iBot.
          </Txt>
          <Field
            label="Token"
            value={waToken}
            onChangeText={setWaToken}
            placeholder="eyJhbGciOi..."
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Field
            label="Instance ID"
            value={waInstance}
            onChangeText={setWaInstance}
            placeholder="eyJ1aWQiOi..."
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button title="שמור פרטי WhatsApp" icon="logo-whatsapp" onPress={saveWhatsapp} loading={waSaving} style={{ marginTop: spacing.sm }} />
        </Card>
        <Divider />

        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          כלי בדיקות
        </Txt>
        <Card style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
          <Button title="ניהול תוכן (מחיקה פר-פריט)" variant="secondary" icon="list" onPress={() => router.push('/admin/content')} />
          <Button title="אפס הכל" variant="danger" icon="trash" onPress={resetAll} />
        </Card>
        <Divider />

        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          ממתינים לאישור ({pending.length})
        </Txt>
        {pending.length === 0 ? (
          <EmptyState icon="checkmark-done-circle-outline" title="אין בקשות אישור" />
        ) : (
          pending.map((u) => (
            <Card key={u.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={22} color={colors.brand700} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold">{u.full_name ?? 'ללא שם'}</Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {u.roles.map((r) => ROLE_LABELS[r]).join(' · ')} · {u.phone}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Button title="אשר" icon="checkmark" onPress={() => decide(u, true)} style={{ flex: 1 }} />
                <Button title="דחה" variant="danger" icon="close" onPress={() => decide(u, false)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
