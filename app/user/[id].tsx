import React, { useCallback, useState } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, StatBlock } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { supabase } from '../../src/lib/supabase';
import { ROLE_LABELS, LEVEL_META, type UserRole, type ReputationLevel } from '../../src/lib/domain';
import { colors, spacing, radius } from '../../src/theme/tokens';

type PublicUser = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  roles: UserRole[];
  reputation_level: ReputationLevel;
  rating_avg: number;
  rating_count: number;
  total_donations: number;
  total_units: number;
  total_deliveries: number;
  units_served: number;
};

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [u, setU] = useState<PublicUser | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles_public')
      .select('id,full_name,photo_url,roles,reputation_level,rating_avg,rating_count,total_donations,total_units,total_deliveries,units_served')
      .eq('id', id)
      .maybeSingle();
    setU((data as PublicUser) ?? null);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const lvl = u ? LEVEL_META[u.reputation_level] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="פרופיל" onBack={() => safeBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {u ? (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              {u.photo_url ? (
                <Image source={{ uri: u.photo_url }} style={{ width: 88, height: 88, borderRadius: 44 }} />
              ) : (
                <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                  <Txt variant="display" weight="extrabold" color={colors.brand700}>{u.full_name?.trim()?.charAt(0) ?? '?'}</Txt>
                </View>
              )}
              <Txt variant="h1" weight="extrabold" style={{ marginTop: spacing.md }}>{u.full_name ?? 'משתמש'}</Txt>
              {u.roles?.length ? (
                <Txt variant="caption" color={colors.textMuted}>{u.roles.map((r) => ROLE_LABELS[r]).join(' · ')}</Txt>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: spacing.md }}>
                {lvl ? (
                  <View style={[styles.chip, { backgroundColor: colors.brand700 }]}>
                    <Txt variant="caption" weight="bold" color={colors.white}>Level {lvl.n} · {lvl.label}</Txt>
                  </View>
                ) : null}
                {u.rating_count > 0 ? (
                  <View style={[styles.chip, { backgroundColor: colors.brand50 }]}>
                    <Txt variant="caption" weight="bold" color={colors.brand700}>⭐ {u.rating_avg} ({u.rating_count})</Txt>
                  </View>
                ) : null}
              </View>
            </Card>

            <View style={{ height: spacing.lg }} />
            <Card style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
              <StatBlock value={u.total_donations} label="תרומות" />
              <StatBlock value={u.total_units.toLocaleString()} label="מנות" />
              <StatBlock value={u.total_deliveries} label="משלוחים" />
              <StatBlock value={u.units_served} label="יחידות" />
            </Card>
          </>
        ) : (
          <View style={{ alignItems: 'center', marginTop: 80, gap: spacing.md }}>
            <Ionicons name="person-circle-outline" size={56} color={colors.brand500} />
            <Txt color={colors.textMuted}>טוען פרופיל…</Txt>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = {
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
};
