import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Header, Txt, Button, Card } from '../../src/components/ui';
import { appAlert } from '../../src/components/AppAlert';
import { safeBack } from '../../src/lib/nav';
import { useAuth } from '../../src/context/AuthContext';
import { commitToNeed } from '../../src/lib/api';
import { RECIPIENT_TYPE_LABELS, type RecipientType } from '../../src/lib/domain';
import { regionLabel, REGION_CENTERS, type Region } from '../../src/lib/regions';
import { haversineKm, formatKm } from '../../src/lib/geo';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

type Need = {
  id: string; region: Region; food_type: string; quantity: number; unit_label: string;
  notes: string | null; recipient_type: RecipientType; display_name: string | null;
};

export default function NeedDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const isGuest = !session || !profile;
  const [n, setN] = useState<Need | null>(null);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {}
    })();
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('open_needs_v')
      .select('id,region,food_type,quantity,unit_label,notes,recipient_type,display_name')
      .eq('id', id)
      .maybeSingle();
    setN(data as Need);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const commit = () => {
    if (isGuest) return router.push('/(auth)/phone');
    if (!n) return;
    appAlert('התחייבות לבקשה', `${n.quantity} ${n.unit_label} · ${n.food_type}\nאזור ${regionLabel(n.region)}`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'כן, אני מוביל', onPress: () => doCommit(true) },
      { text: 'לא, צריך שינוע', onPress: () => doCommit(false) },
    ]);
  };
  const doCommit = async (selfTransport: boolean) => {
    const { data, error } = await commitToNeed(id!, selfTransport);
    if (error) return appAlert('שגיאה', error.message);
    if (data) router.replace(`/assignment/${data}`);
  };

  const c = n ? REGION_CENTERS[n.region] : null;
  const km = userLoc && c ? haversineKm(userLoc, c) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="בקשת תרומה" onBack={() => safeBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#E7F6EE', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="megaphone" size={36} color={colors.secondary} />
          </View>
          <Txt variant="display" weight="extrabold" center style={{ marginTop: spacing.md }}>{n ? `${n.quantity} ${n.unit_label} · ${n.food_type}` : ''}</Txt>
          <Txt variant="small" color={colors.textMuted} center style={{ marginTop: 2 }}>
            {n ? `${RECIPIENT_TYPE_LABELS[n.recipient_type]} · אזור ${regionLabel(n.region)}` : ''}{km != null ? ` · ${formatKm(km)}` : ''}
          </Txt>
        </View>

        {n?.display_name ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="shield-checkmark" size={22} color={colors.brand700} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color={colors.textMuted}>המבקש</Txt>
              <Txt weight="bold">{n.display_name}</Txt>
            </View>
          </Card>
        ) : null}

        {n?.notes ? (
          <>
            <Txt variant="caption" weight="bold" color={colors.textMuted} style={{ marginTop: spacing.lg, marginBottom: 6 }}>תיאור</Txt>
            <Card><Txt color={colors.text}>{n.notes}</Txt></Card>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title={isGuest ? 'התחבר כדי לתרום' : 'אני אתרום לבקשה זו'} icon={isGuest ? 'log-in' : 'gift'} onPress={commit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
