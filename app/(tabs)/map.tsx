import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, EmptyState } from '../../src/components/ui';
import { MapBoundary } from '../../src/components/MapBoundary';
import { OffersMap } from '../../src/components/OffersMap';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { claimOffer } from '../../src/lib/api';
import { LEVEL_META, type ReputationLevel } from '../../src/lib/domain';
import { colors, spacing, radius } from '../../src/theme/tokens';

type OfferRow = {
  id: string;
  food_type: string;
  quantity: number;
  unit_label: string;
  kosher: boolean;
  vegetarian: boolean;
  notes: string | null;
  origin_city: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  donor_name: string;
  donor_level: ReputationLevel;
  donor_rating: number;
  created_at: string;
};

export default function OffersScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const isDonor = profile?.roles?.includes('donor');
  const isRecipient = profile?.roles?.includes('recipient');

  const load = useCallback(async () => {
    const { data } = await supabase.from('open_offers_v').select('*').order('created_at', { ascending: false });
    setOffers((data as OfferRow[]) ?? []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const claim = (offer: OfferRow) => {
    Alert.alert(
      'בחירת תרומה',
      `${offer.quantity} ${offer.unit_label} · ${offer.food_type}\nמאת ${offer.donor_name}\n\nכיצד תרצה לקבל?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'איסוף עצמאי', onPress: () => doClaim(offer.id, false) },
        { text: 'בקשת שינוע', onPress: () => doClaim(offer.id, true) },
      ],
    );
  };

  const doClaim = async (offerId: string, needTransport: boolean) => {
    const { data, error } = await claimOffer(offerId, needTransport);
    if (error) return Alert.alert('שגיאה', error.message);
    await load();
    if (data) router.push(`/assignment/${data}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="תרומות זמינות" subtitle="תרומות מוכנות לאיסוף" />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} />}
      >
        {/* מפה אמיתית (dev build) עם נפילה חיננית ל-placeholder ב-Expo Go */}
        <View style={{ marginBottom: spacing.lg }}>
          <MapBoundary
            fallback={
              <View style={styles.mapPlaceholder}>
                <Ionicons name="map" size={40} color={colors.brand500} />
                <Txt variant="small" color={colors.textMuted} center style={{ marginTop: 8 }}>
                  תצוגת מפה זמינה ב-Dev Build
                </Txt>
                <Txt variant="caption" color={colors.textMuted} center>
                  (המפה מציגה מיקומי מוצא של תורמים בלבד)
                </Txt>
              </View>
            }
          >
            <OffersMap offers={offers} />
          </MapBoundary>
        </View>

        {isDonor ? (
          <Button title="פרסם תרומה מוכנה" icon="gift" onPress={() => router.push('/offer/new')} style={{ marginBottom: spacing.lg }} />
        ) : null}

        {offers.length === 0 ? (
          <EmptyState icon="gift-outline" title="אין תרומות זמינות כרגע" subtitle="תרומות מוכנות יופיעו כאן" />
        ) : (
          offers.map((o) => {
            const lvl = LEVEL_META[o.donor_level];
            return (
              <Card key={o.id} accent={colors.brand500} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="fast-food" size={22} color={colors.brand700} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold">
                      {o.quantity} {o.unit_label} · {o.food_type}
                    </Txt>
                    <Txt variant="caption" color={colors.textMuted}>
                      {o.donor_name} · Level {lvl.n} {o.donor_rating > 0 ? `· ⭐ ${o.donor_rating}` : ''}
                      {o.origin_city ? ` · ${o.origin_city}` : ''}
                    </Txt>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {o.kosher ? <Tag label="כשר" /> : null}
                  {o.vegetarian ? <Tag label="צמחוני" /> : null}
                </View>
                {isRecipient ? (
                  <Button title="בחר תרומה זו" icon="checkmark-circle" onPress={() => claim(o)} style={{ marginTop: 12 }} />
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: colors.brand50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill }}>
      <Txt variant="caption" weight="medium" color={colors.brand700}>
        {label}
      </Txt>
    </View>
  );
}

const styles = {
  mapPlaceholder: {
    height: 160,
    borderRadius: radius.lg,
    backgroundColor: colors.brand50,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing.lg,
  },
};
