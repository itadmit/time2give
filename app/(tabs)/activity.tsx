import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, StatusBadge, EmptyState } from '../../src/components/ui';
import { appAlert } from '../../src/components/AppAlert';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { claimDelivery } from '../../src/lib/api';
import { statusUI, type AssignmentStatus } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

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

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `לפני ${Math.max(1, Math.round(d / 60))} דק׳`;
  if (d < 86400) return `לפני ${Math.round(d / 3600)} שע׳`;
  return `לפני ${Math.round(d / 86400)} ימים`;
}

/** כותרת קבוצה בסגנון iOS (grouped list header) */
function SectionHeader({ children }: { children: string }) {
  return (
    <Txt variant="caption" weight="bold" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: spacing.sm, marginRight: 4 }}>
      {children}
    </Txt>
  );
}

export default function Activity() {
  const { profile } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [taking, setTaking] = useState<string | null>(null);
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

  const take = (assignmentId: string) => {
    appAlert('לקחת את המשלוח?', 'אתם מתחייבים לאסוף מהתורם ולמסור למבקש. את הכתובת המדויקת תתאמו בטלפון.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'כן, אני לוקח',
        onPress: async () => {
          setTaking(assignmentId);
          const { error } = await claimDelivery(assignmentId);
          setTaking(null);
          if (error) return appAlert('שגיאה', error.message);
          await load();
          router.push(`/assignment/${assignmentId}`);
        },
      },
    ]);
  };

  const waiting = rows.filter((r) => r.status === 'waiting_courier');
  const info = (r: AssignmentRow) => r.need ?? r.offer;

  const renderCard = (r: AssignmentRow, showTake: boolean) => {
    const ui = statusUI(r.status);
    const it = info(r);
    return (
      <Card key={r.id} style={{ marginBottom: 10, padding: spacing.md }} onPress={() => router.push(`/assignment/${r.id}`)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <StatusBadge color={ui.color} tint={ui.tint} icon={ui.icon} />
          <View style={{ flex: 1 }}>
            <Txt weight="bold" numberOfLines={1}>{it ? `${it.quantity} ${it.unit_label} · ${it.food_type}` : 'תרומה'}</Txt>
            <Txt variant="caption" color={colors.textMuted}>{regionLabel(r.general_destination)} · {timeAgo(r.created_at)}</Txt>
          </View>
          <View style={{ backgroundColor: ui.tint, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill }}>
            <Txt variant="caption" weight="bold" color={ui.color} style={{ fontSize: 11 }}>{ui.label}</Txt>
          </View>
          <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        </View>
        {showTake ? (
          <Pressable onPress={() => take(r.id)} style={{ marginTop: 12, backgroundColor: colors.brand700, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            {taking === r.id ? <ActivityIndicator color={colors.white} /> : (
              <>
                <Ionicons name="car" size={18} color={colors.white} />
                <Txt weight="bold" color={colors.white}>אני לוקח את המשלוח</Txt>
              </>
            )}
          </Pressable>
        ) : null}
      </Card>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="הפעילות שלי" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} />}
      >
        {isDriver && waiting.length > 0 ? (
          <>
            <SectionHeader>משלוחים פתוחים לאיסוף</SectionHeader>
            {waiting.map((r) => renderCard(r, true))}
          </>
        ) : null}

        <SectionHeader>כל השיבוצים</SectionHeader>
        {rows.length === 0 ? (
          <EmptyState icon="time-outline" title="אין פעילות עדיין" subtitle="שיבוצים ומשלוחים יופיעו כאן" />
        ) : (
          rows.map((r) => renderCard(r, false))
        )}
      </ScrollView>
    </View>
  );
}
