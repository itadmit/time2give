import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, Pill, EmptyState } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { commitToNeed } from '../../src/lib/api';
import { RECIPIENT_TYPE_LABELS, type RecipientType } from '../../src/lib/domain';
import { ALL_REGIONS, regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing } from '../../src/theme/tokens';

type NeedRow = {
  id: string;
  region: Region;
  food_type: string;
  quantity: number;
  unit_label: string;
  needed_at: string | null;
  notes: string | null;
  recipient_type: RecipientType;
  display_name: string | null;
  created_at: string;
};

export default function Needs() {
  const { profile } = useAuth();
  const router = useRouter();
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [filter, setFilter] = useState<Region | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const isRecipient = profile?.roles?.includes('recipient');
  const isDonor = profile?.roles?.includes('donor');

  const load = useCallback(async () => {
    let q = supabase.from('open_needs_v').select('*').order('created_at', { ascending: false });
    if (filter !== 'all') q = q.eq('region', filter);
    const { data } = await q;
    setNeeds((data as NeedRow[]) ?? []);
  }, [filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const commit = (need: NeedRow) => {
    Alert.alert(
      'התחייבות לבקשה',
      `${need.quantity} ${need.unit_label} - ${need.food_type}\nאזור ${regionLabel(need.region)}\n\nהאם תבצע את השינוע בעצמך?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'כן, אני מוביל', onPress: () => doCommit(need.id, true) },
        { text: 'לא, צריך שינוע', onPress: () => doCommit(need.id, false) },
      ],
    );
  };

  const doCommit = async (needId: string, selfTransport: boolean) => {
    const { data, error } = await commitToNeed(needId, selfTransport);
    if (error) return Alert.alert('שגיאה', error.message);
    await load();
    if (data) router.push(`/assignment/${data}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="בקשות פתוחות" subtitle="דרושות תרומות באזורים" />
      <ScrollView
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} />}
      >
        <View style={{ backgroundColor: colors.surface, paddingVertical: spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
            <Pill label="הכל" active={filter === 'all'} onPress={() => setFilter('all')} />
            {ALL_REGIONS.map((r) => (
              <Pill key={r} label={regionLabel(r)} active={filter === r} onPress={() => setFilter(r)} />
            ))}
          </ScrollView>
        </View>

        <View style={{ padding: spacing.lg, paddingTop: 0 }}>
          {isRecipient ? (
            <Button title="פרסם בקשה חדשה" icon="add-circle" onPress={() => router.push('/need/new')} style={{ marginBottom: spacing.lg }} />
          ) : null}

          {needs.length === 0 ? (
            <EmptyState icon="megaphone-outline" title="אין בקשות פתוחות" subtitle="בקשות חדשות יופיעו כאן" />
          ) : (
            needs.map((n) => (
              <Card key={n.id} accent={colors.warning} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FBF0DA', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="restaurant" size={22} color={colors.warning} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold">
                      {n.quantity} {n.unit_label} · {n.food_type}
                    </Txt>
                    <Txt variant="caption" color={colors.textMuted}>
                      {RECIPIENT_TYPE_LABELS[n.recipient_type]} · אזור {regionLabel(n.region)}
                    </Txt>
                  </View>
                </View>
                {n.notes ? (
                  <Txt variant="small" color={colors.textMuted} style={{ marginTop: 8 }}>
                    {n.notes}
                  </Txt>
                ) : null}
                {isDonor ? (
                  <Button title="אני מתחייב לבקשה" icon="hand-left" onPress={() => commit(n)} style={{ marginTop: 12 }} />
                ) : null}
              </Card>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
