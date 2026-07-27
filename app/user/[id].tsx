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
type Review = { id: string; score: number; comment: string | null; created_at: string; rater_name: string | null };
type HistItem = { id: string; food_type: string; quantity: number; unit_label: string; created_at: string };

const heDate = (s: string) => new Date(s).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [u, setU] = useState<PublicUser | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [history, setHistory] = useState<HistItem[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles_public')
      .select('id,full_name,photo_url,roles,reputation_level,rating_avg,rating_count,total_donations,total_units,total_deliveries,units_served')
      .eq('id', id)
      .maybeSingle();
    setU((data as PublicUser) ?? null);
    const { data: rv } = await supabase
      .from('public_reviews')
      .select('id,score,comment,created_at,rater_name')
      .eq('ratee_id', id)
      .order('created_at', { ascending: false })
      .limit(12);
    setReviews((rv as Review[]) ?? []);
    const { data: hist } = await supabase
      .from('offers')
      .select('id,food_type,quantity,unit_label,created_at')
      .eq('donor_id', id)
      .eq('status', 'fulfilled')
      .order('created_at', { ascending: false })
      .limit(12);
    setHistory((hist as HistItem[]) ?? []);
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

            {/* חוות דעת */}
            {reviews.length > 0 ? (
              <>
                <View style={{ height: spacing.lg }} />
                <Card>
                  <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
                    חוות דעת ({u.rating_count})
                  </Txt>
                  {reviews.map((rv, i) => (
                    <View key={rv.id} style={{ paddingVertical: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Txt weight="bold">{rv.rater_name ?? 'משתמש'}</Txt>
                        <Txt variant="caption" color={colors.warning}>{'⭐'.repeat(rv.score)}</Txt>
                      </View>
                      {rv.comment ? <Txt variant="small" color={colors.text} style={{ marginTop: 2 }}>{rv.comment}</Txt> : null}
                      <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{heDate(rv.created_at)}</Txt>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {/* היסטוריית תרומות */}
            {history.length > 0 ? (
              <>
                <View style={{ height: spacing.lg }} />
                <Card>
                  <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
                    היסטוריית תרומות
                  </Txt>
                  {history.map((h, i) => (
                    <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: spacing.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#E7F6EE', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="gift" size={18} color={colors.secondary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt weight="bold" variant="small">{h.quantity} {h.unit_label} · {h.food_type}</Txt>
                        <Txt variant="caption" color={colors.textMuted}>{heDate(h.created_at)}</Txt>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Txt variant="caption" weight="bold" color={colors.success}>הושלמה</Txt>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}
            <View style={{ height: spacing.xl }} />
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
