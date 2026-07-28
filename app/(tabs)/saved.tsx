import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Header, Txt, EmptyState } from '../../src/components/ui';
import { appAlert } from '../../src/components/AppAlert';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { claimOffer } from '../../src/lib/api';
import { haversineKm, formatKm } from '../../src/lib/geo';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

type OfferRow = {
  id: string; food_type: string; quantity: number; unit_label: string;
  origin_city: string | null; origin_lat: number | null; origin_lng: number | null;
  photo_url: string | null; donor_name: string; donor_is_courier: boolean;
};
function foodIcon(food: string): keyof typeof Ionicons.glyphMap {
  if (/מים|שתי|משק/.test(food)) return 'water';
  if (/מאפ|עוג|לחם|דבש/.test(food)) return 'cafe';
  if (/פיר|ירק|סלט/.test(food)) return 'nutrition';
  if (/כריכ|סנדוויצ|פית/.test(food)) return 'fast-food';
  return 'flame';
}

export default function Saved() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const isGuest = !session || !profile;
  const { saved, toggle } = useFavorites();
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } catch {}
      if (!saved.length) { setRows([]); return; }
      const { data } = await supabase
        .from('open_offers_v')
        .select('id,food_type,quantity,unit_label,origin_city,origin_lat,origin_lng,photo_url,donor_name,donor_is_courier')
        .in('id', saved);
      // שמירה על סדר השמירה
      const order = new Map(saved.map((id, i) => [id, i]));
      setRows(((data as OfferRow[]) ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)));
    })();
  }, [saved]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="שמורים" subtitle={rows.length ? `${rows.length} תרומות שמורות` : undefined} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {rows.length === 0 ? (
          <EmptyState icon="heart-outline" title="אין תרומות שמורות" subtitle="לחצו על ❤️ בכרטיס כדי לשמור תרומה" />
        ) : (
          rows.map((o) => {
            const km = userLoc && o.origin_lat != null && o.origin_lng != null ? haversineKm(userLoc, { lat: o.origin_lat, lng: o.origin_lng }) : null;
            return (
              <Pressable key={o.id} onPress={() => router.push(`/offer/${o.id}` as any)} style={styles.card}>
                <View style={styles.photo}>
                  {o.photo_url ? <Image source={{ uri: o.photo_url }} style={{ width: '100%', height: '100%' }} /> : (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name={foodIcon(o.food_type)} size={30} color={colors.brand700} /></View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" numberOfLines={1}>{o.quantity} {o.unit_label} · {o.food_type}</Txt>
                  <Txt variant="caption" color={colors.textMuted} numberOfLines={1}>{o.donor_name}</Txt>
                  {o.origin_city ? <Txt variant="caption" color={colors.textMuted}>📍 {o.origin_city}{km != null ? ` · ${formatKm(km)}` : ''}</Txt> : null}
                </View>
                <Pressable onPress={() => toggle(o.id)} hitSlop={10} style={{ padding: 4 }}>
                  <Ionicons name="heart" size={24} color={colors.danger} />
                </Pressable>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12, ...shadow.card },
  photo: { width: 72, height: 72, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
});
