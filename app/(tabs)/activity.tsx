import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useRouter, useFocusEffect } from 'expo-router';
import { Header, Txt, Card, Button, StatusBadge, EmptyState } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { claimDelivery } from '../../src/lib/api';
import { statusUI, type AssignmentStatus } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing } from '../../src/theme/tokens';

type AssignmentRow = {
  id: string;
  status: AssignmentStatus;
  general_destination: Region;
  self_transport: boolean;
  created_at: string;
  need: { food_type: string; quantity: number; unit_label: string } | null;
  offer: { food_type: string; quantity: number; unit_label: string } | null;
};

const SELECT = '*, need:need_id(food_type,quantity,unit_label), offer:offer_id(food_type,quantity,unit_label)';

export default function Activity() {
  const { profile } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [taking, setTaking] = useState<string | null>(null);
  // נהג מתנדב (מאחד רכז+נהג ישנים) רואה משלוחים פתוחים ותופס אותם בעצמו
  const isDriver =
    profile?.roles?.includes('courier') ||
    profile?.roles?.includes('coordinator') ||
    profile?.roles?.includes('admin');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('assignments')
      .select(SELECT)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setRows((data as AssignmentRow[]) ?? []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // הנהג המתנדב תופס את המשלוח בעצמו — במקום שיבוץ ידני של רכז
  const take = async (assignmentId: string) => {
    setTaking(assignmentId);
    const { error } = await claimDelivery(assignmentId);
    setTaking(null);
    if (error) return appAlert('שגיאה', error.message);
    await load();
    router.push(`/assignment/${assignmentId}`);
  };

  const waiting = rows.filter((r) => r.status === 'waiting_courier');
  const info = (r: AssignmentRow) => r.need ?? r.offer;

  const renderCard = (r: AssignmentRow, showTake: boolean) => {
    const ui = statusUI(r.status);
    const it = info(r);
    return (
      <Card key={r.id} accent={ui.color} style={{ marginBottom: 12 }} onPress={() => router.push(`/assignment/${r.id}`)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <StatusBadge color={ui.color} tint={ui.tint} icon={ui.icon} />
          <View style={{ flex: 1 }}>
            <Txt weight="bold">
              {it ? `${it.quantity} ${it.unit_label} · ${it.food_type}` : 'תרומה'}
            </Txt>
            <Txt variant="caption" color={colors.textMuted}>
              {ui.label} · אזור {regionLabel(r.general_destination)}
            </Txt>
          </View>
          <Txt variant="caption" color={ui.color} weight="bold">
            {ui.label}
          </Txt>
        </View>
        {showTake ? (
          <Button
            title="אני לוקח את המשלוח"
            icon="car"
            loading={taking === r.id}
            onPress={() => take(r.id)}
            style={{ marginTop: 12 }}
          />
        ) : null}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="הפעילות שלי" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} />}
      >
        {isDriver && waiting.length > 0 ? (
          <>
            <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
              משלוחים פתוחים לאיסוף
            </Txt>
            {waiting.map((r) => renderCard(r, true))}
            <View style={{ height: spacing.lg }} />
          </>
        ) : null}

        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          כל השיבוצים
        </Txt>
        {rows.length === 0 ? (
          <EmptyState icon="time-outline" title="אין פעילות עדיין" subtitle="שיבוצים ומשלוחים יופיעו כאן" />
        ) : (
          rows.map((r) => renderCard(r, false))
        )}
      </ScrollView>
    </View>
  );
}
