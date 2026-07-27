import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Alert, Animated, Easing, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Txt, Button, EmptyState } from '../../src/components/ui';
import { HelpModal } from '../../src/components/HelpModal';
import { MapBoundary } from '../../src/components/MapBoundary';
import { OffersMap, type MapOffer } from '../../src/components/OffersMap';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { ROLE_LABELS, LEVEL_META, RECIPIENT_TYPE_LABELS, type ReputationLevel, type RecipientType } from '../../src/lib/domain';
import { claimOffer, commitToNeed, claimDelivery } from '../../src/lib/api';
import { regionLabel, REGION_CENTERS, type Region } from '../../src/lib/regions';
import { haversineKm, formatKm } from '../../src/lib/geo';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

type FeedEvent = { id: number; type: string; payload: any; created_at: string };
type OfferRow = {
  id: string; food_type: string; quantity: number; unit_label: string;
  kosher: boolean; vegetarian: boolean; notes: string | null;
  origin_city: string | null; origin_lat: number | null; origin_lng: number | null;
  donor_name: string; donor_level: ReputationLevel; donor_rating: number; donor_is_courier: boolean;
};
type NeedRow = {
  id: string; region: Region; food_type: string; quantity: number; unit_label: string;
  needed_at: string | null; notes: string | null; recipient_type: RecipientType; display_name: string | null;
};
type DeliveryRow = {
  id: string; general_destination: Region;
  need: { food_type: string; quantity: number; unit_label: string } | null;
  offer: { food_type: string; quantity: number; unit_label: string; origin_lat: number | null; origin_lng: number | null; origin_city: string | null } | null;
};

// 'donate' = תורם (רואה בקשות) · 'receive' = מבקש (רואה תרומות) · 'drive' = נהג (נסיעות ממתינות)
type AppMode = 'donate' | 'receive' | 'drive';
type ViewMode = 'map' | 'list';

const MODE_DEF: Record<AppMode, { label: string; icon: keyof typeof Ionicons.glyphMap; accent: string }> = {
  donate: { label: 'לתרום', icon: 'gift', accent: colors.brand700 },
  receive: { label: 'לבקש', icon: 'megaphone', accent: colors.secondary },
  drive: { label: 'להסיע', icon: 'car', accent: colors.warning },
};

type Item = {
  id: string; foodType: string; quantity: number; unitLabel: string; subtitle: string;
  lat: number | null; lng: number | null; km: number | null;
  badge?: string; badgeColor?: string; needsTransport?: boolean;
  actLabel: string; act: () => void;
};

const ENCOURAGE = ['כל תרומה עושה הבדל 💙', 'יחד תומכים במי שנותן מעצמו', 'תודה שאתם חלק מהקהילה', 'כל מנה מגיעה למי שצריך'];

/** טיקר עדכונים מתחלף: שורה שדוהה פנימה ועולה, ואז נעלמת כלפי מעלה. */
function ActivityTicker({ items }: { items: string[] }) {
  const [idx, setIdx] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    if (items.length === 0) return;
    let timer: ReturnType<typeof setTimeout>;
    opacity.setValue(0); ty.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    if (items.length > 1) {
      timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }),
          Animated.timing(ty, { toValue: -10, duration: 320, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) setIdx((i) => (i + 1) % items.length); });
      }, 3200);
    }
    return () => clearTimeout(timer);
  }, [idx, items.length]);
  if (items.length === 0) return null;
  return (
    <View style={styles.communityChip}>
      <Ionicons name="ribbon" size={16} color={colors.success} />
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateY: ty }] }}>
        <Txt variant="caption" weight="medium" numberOfLines={1}>{items[idx % items.length]}</Txt>
      </Animated.View>
    </View>
  );
}

export default function Feed() {
  const { profile, session } = useAuth();
  const { unread } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isGuest = !session || !profile;

  const roles = profile?.roles ?? [];
  const isDonor = roles.includes('donor');
  const isRecipient = roles.includes('recipient');
  const isDriver = roles.includes('courier') || roles.includes('coordinator');

  // המצבים שמוצגים למשתמש — רק לפי התפקידים שלו. אורח → גולש בלתרום/לבקש.
  const modes: AppMode[] = isGuest
    ? ['donate', 'receive']
    : (['donate', 'receive', 'drive'].filter(
        (m) => (m === 'donate' && isDonor) || (m === 'receive' && isRecipient) || (m === 'drive' && isDriver),
      ) as AppMode[]);
  const effectiveModes = modes.length ? modes : (['donate', 'receive'] as AppMode[]);

  const [appMode, setAppMode] = useState<AppMode>(effectiveModes[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [totals, setTotals] = useState({ donations: 0, units: 0 });
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // אם התפקידים השתנו והמצב הנוכחי כבר לא רלוונטי — עוברים למצב הראשון הזמין
  const modesKey = effectiveModes.join(',');
  useEffect(() => {
    if (!effectiveModes.includes(appMode)) setAppMode(effectiveModes[0]);
  }, [modesKey]);

  // מיקום המשתמש (אם כבר אושרה הרשאה) — לחישוב מרחקים
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
    const { data: ev } = await supabase.from('feed_events').select('*').order('created_at', { ascending: false }).limit(20);
    setEvents((ev as FeedEvent[]) ?? []);
    const { data: agg } = await supabase.from('profiles_public').select('total_donations,total_units');
    if (agg) {
      setTotals({
        donations: agg.reduce((s: number, r: any) => s + (r.total_donations ?? 0), 0),
        units: agg.reduce((s: number, r: any) => s + (r.total_units ?? 0), 0),
      });
    }
    const { data: off } = await supabase
      .from('open_offers_v')
      .select('id,food_type,quantity,unit_label,kosher,vegetarian,notes,origin_city,origin_lat,origin_lng,donor_name,donor_level,donor_rating,donor_is_courier');
    setOffers((off as OfferRow[]) ?? []);
    const { data: nd } = await supabase
      .from('open_needs_v')
      .select('id,region,food_type,quantity,unit_label,needed_at,notes,recipient_type,display_name');
    setNeeds((nd as NeedRow[]) ?? []);
    if (isDriver) {
      const { data: dl } = await supabase
        .from('assignments')
        .select('id,general_destination,need:need_id(food_type,quantity,unit_label),offer:offer_id(food_type,quantity,unit_label,origin_lat,origin_lng,origin_city)')
        .eq('status', 'waiting_courier')
        .is('deleted_at', null);
      setDeliveries((dl as unknown as DeliveryRow[]) ?? []);
    }
  }, [isDriver]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const role = roles[0];
  const level = profile ? LEVEL_META[profile.reputation_level] : null;
  const accent = MODE_DEF[appMode].accent;

  const dist = (lat?: number | null, lng?: number | null): number | null =>
    userLoc && lat != null && lng != null ? haversineKm(userLoc, { lat, lng }) : null;

  const goLogin = () => router.push('/(auth)/phone');

  // פעולות
  const doClaim = async (offerId: string, needTransport: boolean) => {
    const { data, error } = await claimOffer(offerId, needTransport);
    if (error) return Alert.alert('שגיאה', error.message);
    setSelectedId(null); await load();
    if (data) router.push(`/assignment/${data}`);
  };
  const claim = (o: OfferRow) => {
    if (isGuest) return goLogin();
    Alert.alert('בחירת תרומה', `${o.quantity} ${o.unit_label} · ${o.food_type}\nמאת ${o.donor_name}\n\nכיצד תרצה לקבל?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'איסוף עצמאי', onPress: () => doClaim(o.id, false) },
      { text: 'בקשת שינוע', onPress: () => doClaim(o.id, true) },
    ]);
  };
  const doCommit = async (needId: string, selfTransport: boolean) => {
    const { data, error } = await commitToNeed(needId, selfTransport);
    if (error) return Alert.alert('שגיאה', error.message);
    setSelectedId(null); await load();
    if (data) router.push(`/assignment/${data}`);
  };
  const commit = (n: NeedRow) => {
    if (isGuest) return goLogin();
    Alert.alert('התחייבות לבקשה', `${n.quantity} ${n.unit_label} · ${n.food_type}\nאזור ${regionLabel(n.region)}\n\nהאם תבצע את השינוע בעצמך?`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'כן, אני מוביל', onPress: () => doCommit(n.id, true) },
      { text: 'לא, צריך שינוע', onPress: () => doCommit(n.id, false) },
    ]);
  };
  const grab = async (assignmentId: string) => {
    if (isGuest) return goLogin();
    const { error } = await claimDelivery(assignmentId);
    if (error) return Alert.alert('שגיאה', error.message);
    setSelectedId(null); await load();
    router.push(`/assignment/${assignmentId}`);
  };

  // בניית פריטים למצב הנוכחי, ממוינים לפי הקרוב
  let items: Item[] = [];
  if (appMode === 'receive') {
    items = offers.map((o) => ({
      id: o.id, foodType: o.food_type, quantity: o.quantity, unitLabel: o.unit_label,
      subtitle: `${o.donor_name}${o.origin_city ? ' · ' + o.origin_city : ''}`,
      lat: o.origin_lat, lng: o.origin_lng, km: dist(o.origin_lat, o.origin_lng),
      badge: o.donor_is_courier ? 'התורם מביא' : '🚗 צריך שינוע',
      badgeColor: o.donor_is_courier ? colors.secondary : colors.warning,
      needsTransport: !o.donor_is_courier,
      actLabel: 'קבל תרומה זו', act: () => claim(o),
    }));
  } else if (appMode === 'donate') {
    items = needs.map((n) => {
      const c = REGION_CENTERS[n.region];
      return {
        id: n.id, foodType: n.food_type, quantity: n.quantity, unitLabel: n.unit_label,
        subtitle: `${RECIPIENT_TYPE_LABELS[n.recipient_type]} · אזור ${regionLabel(n.region)}`,
        lat: c?.lat ?? null, lng: c?.lng ?? null, km: dist(c?.lat, c?.lng),
        actLabel: 'אני אתרום', act: () => commit(n),
      };
    });
  } else {
    items = deliveries.map((d) => {
      const info = d.need ?? d.offer;
      const c = REGION_CENTERS[d.general_destination];
      const lat = d.offer?.origin_lat ?? c?.lat ?? null;
      const lng = d.offer?.origin_lng ?? c?.lng ?? null;
      return {
        id: d.id, foodType: info?.food_type ?? 'תרומה', quantity: info?.quantity ?? 0, unitLabel: info?.unit_label ?? '',
        subtitle: `אזור ${regionLabel(d.general_destination)}${d.offer?.origin_city ? ' · ' + d.offer.origin_city : ''}`,
        lat, lng, km: dist(lat, lng), needsTransport: true,
        actLabel: 'אני לוקח את המשלוח', act: () => grab(d.id),
      };
    });
  }
  items = items.slice().sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  const markers: MapOffer[] = items
    .filter((i) => i.lat != null && i.lng != null)
    .map((i, idx) => {
      // היסט קטן לפריטים באותה נקודה (בקשות/נסיעות ברמת אזור) כדי שלא יחפפו
      const sameBefore = items.slice(0, idx).filter((x) => x.lat === i.lat && x.lng === i.lng).length;
      const off = appMode === 'receive' ? 0 : sameBefore * 0.015;
      return { id: i.id, food_type: i.foodType, quantity: i.quantity, unit_label: i.unitLabel, origin_lat: (i.lat as number) + off, origin_lng: (i.lng as number) + off, needsTransport: i.needsTransport };
    });

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const emptyText = appMode === 'donate' ? 'אין בקשות פתוחות כרגע' : appMode === 'receive' ? 'אין תרומות זמינות כרגע' : 'אין נסיעות ממתינות כרגע';
  const primaryCta = appMode === 'donate' ? { label: 'פרסם תרומה', icon: 'gift' as const, path: '/offer/new' } : appMode === 'receive' ? { label: 'בקש תרומה', icon: 'megaphone' as const, path: '/need/new' } : null;

  const tickerItems = (() => {
    const real = events.map((e) => e.payload?.text).filter((t): t is string => !!t);
    return real.length ? real : ENCOURAGE;
  })();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* ── כותרת עליונה ── */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.surface }}>
        <View style={styles.topBar}>
          <View style={styles.avatar}>
            {isGuest ? <Ionicons name="person" size={20} color={colors.white} /> : (
              <Txt weight="extrabold" color={colors.white} variant="h2">{profile?.full_name?.trim()?.charAt(0) ?? ''}</Txt>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="bold">{isGuest ? 'שלום אורח 👋' : `שלום ${profile?.full_name?.split(' ')[0] ?? ''}`}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Txt variant="caption" color={colors.textMuted}>{isGuest ? 'התחבר לפעולות' : role ? ROLE_LABELS[role] : ''}</Txt>
              {level ? (
                <View style={styles.levelPill}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.brand700} />
                  <Txt variant="caption" weight="medium" color={colors.brand700}>{level.label}</Txt>
                </View>
              ) : null}
            </View>
          </View>
          <Pressable onPress={() => setHelpOpen(true)} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="help-circle-outline" size={22} color={colors.brand700} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="notifications" size={20} color={colors.brand700} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Txt variant="caption" weight="bold" color={colors.white} style={{ fontSize: 9 }}>{unread > 9 ? '9+' : unread}</Txt>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* ── מתג מצבים (רק לפי התפקידים) — אם יש יותר ממצב אחד ── */}
        {effectiveModes.length > 1 ? (
          <View style={styles.modeSwitch}>
            {effectiveModes.map((m) => {
              const active = appMode === m;
              return (
                <Pressable key={m} onPress={() => { setAppMode(m); setSelectedId(null); }} style={[styles.modeBtn, active && { backgroundColor: MODE_DEF[m].accent }]}>
                  <Ionicons name={MODE_DEF[m].icon} size={16} color={active ? colors.white : MODE_DEF[m].accent} />
                  <Txt weight="bold" variant="small" color={active ? colors.white : colors.textMuted}>{MODE_DEF[m].label}</Txt>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.singleModeChip, { borderColor: accent }]}>
            <Ionicons name={MODE_DEF[appMode].icon} size={16} color={accent} />
            <Txt weight="bold" variant="small" color={accent}>{MODE_DEF[appMode].label}</Txt>
          </View>
        )}

        {/* ── מתג מפה / רשימה + מונה ── */}
        <View style={styles.viewRow}>
          <View style={styles.viewToggle}>
            <Pressable onPress={() => setViewMode('map')} style={[styles.viewBtn, viewMode === 'map' && styles.viewBtnActive]}>
              <Ionicons name="map" size={15} color={viewMode === 'map' ? colors.brand700 : colors.textMuted} />
              <Txt variant="caption" weight="bold" color={viewMode === 'map' ? colors.brand700 : colors.textMuted}>מפה</Txt>
            </Pressable>
            <Pressable onPress={() => setViewMode('list')} style={[styles.viewBtn, viewMode === 'list' && styles.viewBtnActive]}>
              <Ionicons name="list" size={16} color={viewMode === 'list' ? colors.brand700 : colors.textMuted} />
              <Txt variant="caption" weight="bold" color={viewMode === 'list' ? colors.brand700 : colors.textMuted}>רשימה</Txt>
            </Pressable>
          </View>
          <Txt variant="caption" color={colors.textMuted}>{items.length} {appMode === 'drive' ? 'נסיעות' : appMode === 'donate' ? 'בקשות' : 'תרומות'}</Txt>
        </View>
      </SafeAreaView>

      <HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} role={role} />

      {/* ── תוכן: מפה או רשימה ── */}
      <View style={{ flex: 1 }}>
        {viewMode === 'map' ? (
          <View style={{ flex: 1 }}>
            <MapBoundary fallback={<View style={[StyleSheet.absoluteFill, styles.mapFallback]}><Ionicons name="map-outline" size={40} color={colors.brand500} /><Txt color={colors.textMuted} style={{ marginTop: 8 }}>המפה תיטען בקרוב</Txt></View>}>
              <OffersMap key={appMode} offers={markers} variant="fullscreen" mapType="standard" interactive pinColor={accent} onSelect={setSelectedId} />
            </MapBoundary>
            {selected ? (
              <View style={[styles.detailCard, { paddingBottom: insets.bottom + spacing.md }]}>
                <Pressable onPress={() => setSelectedId(null)} hitSlop={10} style={styles.detailClose}>
                  <Ionicons name="close" size={18} color={colors.textMuted} />
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={[styles.detailIcon, { backgroundColor: accent + '18' }]}>
                    <Ionicons name={MODE_DEF[appMode].icon} size={24} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold" variant="h2">{selected.quantity ? `${selected.quantity} ${selected.unitLabel} · ` : ''}{selected.foodType}</Txt>
                    <Txt variant="caption" color={colors.textMuted}>{selected.subtitle}{selected.km != null ? ` · ${formatKm(selected.km)}` : ''}</Txt>
                  </View>
                </View>
                {selected.badge ? (
                  <View style={[styles.badgeTag, { backgroundColor: (selected.badgeColor ?? colors.brand700) + '18', marginTop: spacing.md }]}>
                    <Txt variant="caption" weight="bold" color={selected.badgeColor ?? colors.brand700}>{selected.badge}</Txt>
                  </View>
                ) : null}
                <Button title={isGuest ? 'התחבר' : selected.actLabel} icon={isGuest ? 'log-in' : 'checkmark-circle'} onPress={isGuest ? goLogin : selected.act} color={accent} style={{ marginTop: spacing.lg }} />
              </View>
            ) : null}
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
            {items.length === 0 ? (
              <EmptyState icon="sparkles-outline" title={emptyText} subtitle={userLoc ? 'ממוין לפי הקרוב אליך' : undefined} />
            ) : (
              items.map((i) => (
                <Pressable key={i.id} onPress={isGuest ? goLogin : i.act} style={styles.listCard}>
                  <View style={[styles.detailIcon, { backgroundColor: accent + '18' }]}>
                    <Ionicons name={MODE_DEF[appMode].icon} size={22} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt weight="bold">{i.quantity ? `${i.quantity} ${i.unitLabel} · ` : ''}{i.foodType}</Txt>
                    <Txt variant="caption" color={colors.textMuted} numberOfLines={1}>{i.subtitle}</Txt>
                    {i.badge ? <Txt variant="caption" weight="bold" color={i.badgeColor ?? colors.brand700} style={{ marginTop: 2 }}>{i.badge}</Txt> : null}
                  </View>
                  <View style={{ alignItems: 'center', gap: 2 }}>
                    <View style={[styles.kmPill, { backgroundColor: accent + '15' }]}>
                      <Ionicons name="navigate" size={11} color={accent} />
                      <Txt variant="caption" weight="bold" color={accent}>{formatKm(i.km)}</Txt>
                    </View>
                    <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* ── דוק תחתון: טיקר + כפתור ראשי (מוסתר כשכרטיס פרטים פתוח במפה) ── */}
      <SafeAreaView edges={['bottom']} style={styles.dockWrap} pointerEvents="box-none">
        {!(viewMode === 'map' && selected) ? <ActivityTicker items={tickerItems} /> : null}
        {primaryCta && !(viewMode === 'map' && selected) ? (
          <Pressable onPress={() => (isGuest ? goLogin() : router.push(primaryCta.path as any))} style={[styles.primaryCta, { backgroundColor: accent }]}>
            <Ionicons name={primaryCta.icon} size={20} color={colors.white} />
            <Txt weight="bold" color={colors.white}>{primaryCta.label}</Txt>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const CARD_BG = 'rgba(255,255,255,0.98)';
const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brand700, alignItems: 'center', justifyContent: 'center' },
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.brand50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, left: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },

  modeSwitch: { flexDirection: 'row', backgroundColor: colors.brand50, borderRadius: radius.pill, padding: 4, gap: 4, marginHorizontal: spacing.lg, marginTop: spacing.md },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.md, borderRadius: radius.pill },
  singleModeChip: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', gap: 6, marginHorizontal: spacing.lg, marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1.5 },

  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  viewToggle: { flexDirection: 'row', backgroundColor: colors.brand50, borderRadius: radius.pill, padding: 3, gap: 3 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: radius.pill },
  viewBtnActive: { backgroundColor: colors.white, ...shadow.card },

  mapFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand50 },

  listCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: 10, ...shadow.card },
  detailIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kmPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },

  dockWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  primaryCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: radius.md, ...shadow.card },
  communityChip: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', backgroundColor: CARD_BG, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginBottom: spacing.sm, maxWidth: '100%', ...shadow.card },

  detailCard: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md, backgroundColor: colors.card, borderRadius: 24, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, ...shadow.card },
  detailClose: { position: 'absolute', top: spacing.md, right: spacing.md, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  badgeTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
