import React, { useCallback, useState } from 'react';
import { View, ScrollView, Alert, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, EmptyState } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { supabase } from '../../src/lib/supabase';
import { couriersForAssignment, assignCourier } from '../../src/lib/api';
import { LEVEL_META, type ReputationLevel } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

type Courier = {
  id: string;
  full_name: string | null;
  photo_url: string | null;
  reputation_level: ReputationLevel;
  rating_avg: number;
  rating_count: number;
  total_deliveries: number;
  service_regions?: Region[];
  covers_region?: boolean;
  active_deliveries?: number;
};
type Info = { food_type: string; quantity: number; unit_label: string } | null;

export default function Dispatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [region, setRegion] = useState<Region | null>(null);
  const [item, setItem] = useState<Info>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // הקשר השיבוץ
    const { data: a } = await supabase
      .from('assignments')
      .select('general_destination, need:need_id(food_type,quantity,unit_label), offer:offer_id(food_type,quantity,unit_label)')
      .eq('id', id)
      .maybeSingle();
    if (a) {
      setRegion((a as any).general_destination);
      setItem(((a as any).need ?? (a as any).offer) as Info);
    }
    // מועמדים מדורגים (RPC), עם fallback אם הפונקציה עדיין לא הוחלה
    const { data, error } = await couriersForAssignment(id!);
    if (!error && data) {
      setCouriers(data as Courier[]);
    } else {
      const { data: basic } = await supabase
        .from('profiles_public')
        .select('id, full_name, photo_url, reputation_level, rating_avg, rating_count, total_deliveries')
        .contains('roles', ['courier'])
        .order('rating_avg', { ascending: false });
      setCouriers((basic as Courier[]) ?? []);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const assign = async (c: Courier) => {
    setAssigning(c.id);
    const { error } = await assignCourier(id!, c.id);
    setAssigning(null);
    if (error) return appAlert('שגיאה', error.message);
    router.back();
  };

  const renderCourier = (c: Courier, best: boolean) => {
    const level = LEVEL_META[c.reputation_level];
    const initials = (c.full_name ?? '?').trim().slice(0, 2);
    return (
      <Card key={c.id} style={{ marginBottom: 12, borderColor: best ? colors.brand500 : colors.border, borderWidth: best ? 1.5 : 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
            <Txt weight="bold" color={colors.brand700}>{initials}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Txt weight="bold">{c.full_name ?? 'משנע'}</Txt>
              {best ? (
                <View style={{ backgroundColor: colors.brand700, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 }}>
                  <Txt variant="caption" weight="bold" color={colors.white} style={{ fontSize: 10 }}>מומלץ</Txt>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name="star" size={13} color={colors.warning} />
              <Txt variant="caption" color={colors.textMuted}>
                {c.rating_count > 0 ? `${c.rating_avg} (${c.rating_count})` : 'ללא דירוג'} · {level?.label ?? ''} · {c.total_deliveries} משלוחים
              </Txt>
            </View>
          </View>
        </View>

        {/* כיסוי אזור + זמינות */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {c.covers_region !== undefined ? (
            <Chip
              icon={c.covers_region ? 'location' : 'alert-circle'}
              label={c.covers_region ? `מכסה את ${region ? regionLabel(region) : 'האזור'}` : 'מחוץ לאזורו'}
              color={c.covers_region ? colors.success : colors.textMuted}
            />
          ) : null}
          {c.active_deliveries !== undefined ? (
            <Chip
              icon="cube"
              label={c.active_deliveries === 0 ? 'פנוי כעת' : `${c.active_deliveries} משלוחים פעילים`}
              color={c.active_deliveries === 0 ? colors.success : colors.warning}
            />
          ) : null}
          {(c.service_regions ?? []).map((r) => (
            <Chip key={r} label={regionLabel(r)} color={r === region ? colors.brand700 : colors.textMuted} />
          ))}
        </View>

        <Button
          title="שבץ משנע זה"
          icon="person-add"
          onPress={() => assign(c)}
          loading={assigning === c.id}
          style={{ marginTop: 12 }}
        />
      </Card>
    );
  };

  const covering = couriers.filter((c) => c.covers_region);
  const others = couriers.filter((c) => !c.covers_region);
  const hasCoverageInfo = couriers.some((c) => c.covers_region !== undefined);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="שיבוץ משנע" subtitle={region ? `יעד: ${regionLabel(region)}` : undefined} onBack={() => safeBack()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brand700} />}
      >
        {item ? (
          <Card style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="cube" size={22} color={colors.brand700} />
            <Txt weight="bold">{item.quantity} {item.unit_label} · {item.food_type}</Txt>
          </Card>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.brand700} style={{ marginTop: 40 }} />
        ) : couriers.length === 0 ? (
          <EmptyState icon="car-outline" title="אין משנעים זמינים" subtitle="לא נמצאו משנעים מאושרים" />
        ) : hasCoverageInfo ? (
          <>
            <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
              מכסים את האזור ({covering.length})
            </Txt>
            {covering.length === 0 ? (
              <Txt variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.md }}>אין משנע שאישר את האזור — אפשר לשבץ מרשימת הנוספים.</Txt>
            ) : (
              covering.map((c, i) => renderCourier(c, i === 0))
            )}
            {others.length > 0 ? (
              <>
                <Txt variant="h2" weight="bold" style={{ marginVertical: spacing.md }}>
                  משנעים נוספים ({others.length})
                </Txt>
                {others.map((c) => renderCourier(c, false))}
              </>
            ) : null}
          </>
        ) : (
          couriers.map((c, i) => renderCourier(c, i === 0))
        )}
      </ScrollView>
    </View>
  );
}

function Chip({ icon, label, color }: { icon?: string; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: color + '18', borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
      {icon ? <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={12} color={color} /> : null}
      <Txt variant="caption" weight="bold" color={color}>{label}</Txt>
    </View>
  );
}
