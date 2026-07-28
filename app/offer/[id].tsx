import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Txt, Button, Rating } from '../../src/components/ui';
import { appAlert } from '../../src/components/AppAlert';
import { safeBack } from '../../src/lib/nav';
import { useAuth } from '../../src/context/AuthContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { claimOffer } from '../../src/lib/api';
import { LEVEL_META, type ReputationLevel } from '../../src/lib/domain';
import { haversineKm, formatKm } from '../../src/lib/geo';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

type Offer = {
  id: string; food_type: string; quantity: number; unit_label: string;
  kosher: boolean; vegetarian: boolean; notes: string | null; photo_url: string | null;
  origin_city: string | null; origin_lat: number | null; origin_lng: number | null;
  donor_name: string; donor_photo: string | null; donor_level: ReputationLevel; donor_rating: number; donor_is_courier: boolean;
};

export default function OfferDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const isGuest = !session || !profile;
  const { isSaved, toggle } = useFavorites();
  const [o, setO] = useState<Offer | null>(null);
  const [donorId, setDonorId] = useState<string | null>(null);
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
      .from('open_offers_v')
      .select('id,food_type,quantity,unit_label,kosher,vegetarian,notes,photo_url,origin_city,origin_lat,origin_lng,donor_name,donor_photo,donor_level,donor_rating,donor_is_courier')
      .eq('id', id)
      .maybeSingle();
    setO(data as Offer);
    const { data: row } = await supabase.from('offers').select('donor_id').eq('id', id).maybeSingle();
    setDonorId((row as any)?.donor_id ?? null);
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const claim = () => {
    if (isGuest) return router.push('/(auth)/phone');
    if (!o) return;
    appAlert('קבלת תרומה', `${o.quantity} ${o.unit_label} · ${o.food_type}\nמאת ${o.donor_name}`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'איסוף עצמאי', onPress: () => doClaim(false) },
      { text: 'צריך שינוע', onPress: () => doClaim(true) },
    ]);
  };
  const doClaim = async (needTransport: boolean) => {
    const { data, error } = await claimOffer(id!, needTransport);
    if (error) return appAlert('שגיאה', error.message);
    if (data) router.replace(`/assignment/${data}`);
  };

  const lvl = o ? LEVEL_META[o.donor_level] : null;
  const km = userLoc && o?.origin_lat != null && o?.origin_lng != null ? haversineKm(userLoc, { lat: o.origin_lat, lng: o.origin_lng }) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={o?.photo_url ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* תמונה עליונה immersive + חזרה + לב */}
        <View style={{ height: 280, backgroundColor: colors.brand50 }}>
          {o?.photo_url ? (
            <Image source={{ uri: o.photo_url }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="fast-food" size={64} color={colors.brand500} />
            </View>
          )}
          <SafeAreaView edges={['top']} style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
              <Pressable onPress={() => safeBack()} hitSlop={8} style={styles.circleBtn}>
                <Ionicons name="chevron-forward" size={24} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => toggle(id!)} hitSlop={8} style={styles.circleBtn}>
                <Ionicons name={isSaved(id!) ? 'heart' : 'heart-outline'} size={22} color={isSaved(id!) ? colors.danger : colors.text} />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        <View style={{ padding: spacing.lg }}>
          <Txt variant="display" weight="extrabold">{o ? `${o.quantity} ${o.unit_label} · ${o.food_type}` : ''}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            {o?.origin_city ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Ionicons name="location" size={14} color={colors.textMuted} />
                <Txt variant="small" color={colors.textMuted}>{o.origin_city}{km != null ? ` · ${formatKm(km)}` : ''}</Txt>
              </View>
            ) : null}
          </View>

          {/* תגיות */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md }}>
            <View style={[styles.tag, { backgroundColor: o?.donor_is_courier ? '#E7F6EE' : '#FBF0DA', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              {!o?.donor_is_courier ? <Ionicons name="car" size={13} color={colors.warning} /> : null}
              <Txt variant="caption" weight="bold" color={o?.donor_is_courier ? colors.secondary : colors.warning}>{o?.donor_is_courier ? 'התורם מביא' : 'צריך שינוע'}</Txt>
            </View>
            {o?.kosher ? <View style={styles.tag}><Txt variant="caption" weight="medium" color={colors.brand700}>כשר</Txt></View> : null}
            {o?.vegetarian ? <View style={styles.tag}><Txt variant="caption" weight="medium" color={colors.brand700}>צמחוני</Txt></View> : null}
          </View>

          {/* כרטיס תורם */}
          <Pressable onPress={() => donorId && router.push(`/user/${donorId}` as any)} style={styles.donorCard}>
            {o?.donor_photo ? (
              <Image source={{ uri: o.donor_photo }} style={{ width: 46, height: 46, borderRadius: 23 }} />
            ) : (
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                <Txt weight="extrabold" color={colors.brand700}>{o?.donor_name?.trim()?.charAt(0) ?? '?'}</Txt>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color={colors.textMuted}>התורם</Txt>
              <Txt weight="bold">{o?.donor_name ?? ''}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {lvl ? <Txt variant="caption" color={colors.textMuted}>Level {lvl.n} · {lvl.label}</Txt> : null}
                {o && o.donor_rating > 0 ? <Rating value={o.donor_rating} /> : null}
              </View>
            </View>
            <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
          </Pressable>

          {o?.notes ? (
            <>
              <Txt variant="caption" weight="bold" color={colors.textMuted} style={{ marginTop: spacing.lg, marginBottom: 6 }}>תיאור</Txt>
              <Txt color={colors.text}>{o.notes}</Txt>
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* כפתור קבוע תחתון */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title={isGuest ? 'התחבר כדי לקבל' : 'קבל תרומה זו'} icon={isGuest ? 'log-in' : 'checkmark-circle'} onPress={claim} color={colors.secondary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', ...shadow.card },
  tag: { backgroundColor: colors.brand50, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  donorCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg, ...shadow.card },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
