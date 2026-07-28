import React, { useCallback, useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, Image, Modal, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Txt, Button, EmptyState } from '../../src/components/ui';
import { appAlert } from '../../src/components/AppAlert';
import { HelpModal } from '../../src/components/HelpModal';
import { MapBoundary } from '../../src/components/MapBoundary';
import { OffersMap, type MapOffer } from '../../src/components/OffersMap';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { useFavorites } from '../../src/context/FavoritesContext';
import { LEVEL_META, RECIPIENT_TYPE_LABELS, type ReputationLevel, type RecipientType } from '../../src/lib/domain';
import { claimOffer, commitToNeed } from '../../src/lib/api';
import { regionLabel, REGION_CENTERS, type Region } from '../../src/lib/regions';
import { haversineKm, formatKm } from '../../src/lib/geo';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

type OfferRow = {
  id: string; food_type: string; quantity: number; unit_label: string;
  kosher: boolean; vegetarian: boolean; notes: string | null; photo_url: string | null;
  origin_city: string | null; origin_lat: number | null; origin_lng: number | null;
  donor_name: string; donor_photo: string | null; donor_level: ReputationLevel; donor_rating: number; donor_is_courier: boolean;
  created_at: string;
};
type NeedRow = {
  id: string; region: Region; food_type: string; quantity: number; unit_label: string;
  notes: string | null; recipient_type: RecipientType; display_name: string | null; created_at: string;
};

type Tab = 'offers' | 'needs';
type ViewMode = 'list' | 'map';

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'מנות', label: 'מנות חמות' },
  { key: 'כריכ', label: 'כריכים' },
  { key: 'סנדוויצ', label: 'כריכים' },
  { key: 'שתי', label: 'שתייה' },
  { key: 'מים', label: 'שתייה' },
  { key: 'מאפ', label: 'מאפים' },
  { key: 'עוג', label: 'מאפים' },
  { key: 'פיר', label: 'פירות וירקות' },
  { key: 'ירק', label: 'פירות וירקות' },
  { key: 'חטיף', label: 'חטיפים' },
];
// קטגוריות ייחודיות לתצוגה (label ראשון לכל תווית)
const CHIP_CATS = [
  { key: 'all', label: 'הכל', match: [] as string[] },
  { key: 'hot', label: 'מנות חמות', match: ['מנות', 'חמ', 'מרק', 'שניצל', 'ארוח'] },
  { key: 'sandwich', label: 'כריכים', match: ['כריכ', 'סנדוויצ', 'פיתה', 'פית'] },
  { key: 'drink', label: 'שתייה', match: ['שתי', 'מים', 'משק'] },
  { key: 'bakery', label: 'מאפים', match: ['מאפ', 'עוג', 'לחם', 'דבש', 'מתוק'] },
  { key: 'fruit', label: 'פירות/ירקות', match: ['פיר', 'ירק', 'סלט'] },
  { key: 'snack', label: 'חטיפים', match: ['חטיף', 'אנרג'] },
];

function foodIcon(food: string): keyof typeof Ionicons.glyphMap {
  if (/מים|שתי|משק/.test(food)) return 'water';
  if (/מאפ|עוג|לחם|דבש/.test(food)) return 'cafe';
  if (/פיר|ירק|סלט/.test(food)) return 'nutrition';
  if (/כריכ|סנדוויצ|פית/.test(food)) return 'fast-food';
  return 'flame';
}
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `לפני ${Math.max(1, Math.round(diff / 60))} דק׳`;
  if (diff < 86400) return `לפני ${Math.round(diff / 3600)} שע׳`;
  return `לפני ${Math.round(diff / 86400)} ימים`;
}

export default function Feed() {
  const { profile, session } = useAuth();
  const { unread } = useNotifications();
  const { isSaved, toggle: toggleFav } = useFavorites();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isGuest = !session || !profile;

  const [tab, setTab] = useState<Tab>('offers');
  const [view, setView] = useState<ViewMode>('list');
  const [cat, setCat] = useState('all');
  const [search, setSearch] = useState('');
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [cityLabel, setCityLabel] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        const geo = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const g = geo[0];
        setCityLabel(g?.city || g?.subregion || g?.region || null);
      } catch {}
    })();
  }, []);
  // תווית מיקום: עיר מה-GPS, אחרת האזור מהפרופיל
  const locLabel = cityLabel ?? (profile?.service_regions?.[0] ? regionLabel(profile.service_regions[0]) : null);

  const load = useCallback(async () => {
    const { data: off } = await supabase
      .from('open_offers_v')
      .select('id,food_type,quantity,unit_label,kosher,vegetarian,notes,photo_url,origin_city,origin_lat,origin_lng,donor_name,donor_photo,donor_level,donor_rating,donor_is_courier,created_at');
    setOffers((off as OfferRow[]) ?? []);
    const { data: nd } = await supabase
      .from('open_needs_v')
      .select('id,region,food_type,quantity,unit_label,notes,recipient_type,display_name,created_at');
    setNeeds((nd as NeedRow[]) ?? []);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dist = (lat?: number | null, lng?: number | null): number | null =>
    userLoc && lat != null && lng != null ? haversineKm(userLoc, { lat, lng }) : null;

  const matchCat = (food: string) => {
    if (cat === 'all') return true;
    const c = CHIP_CATS.find((x) => x.key === cat);
    return c ? c.match.some((m) => food.includes(m)) : true;
  };
  const matchSearch = (s: string) => !search.trim() || s.includes(search.trim());

  // פריטים אחידים לתצוגה
  type Item = {
    id: string; food: string; quantity: number; unit: string; subtitle: string;
    photo: string | null; lat: number | null; lng: number | null; km: number | null;
    badge: string; badgeColor: string; needsTransport?: boolean; city: string; created_at: string;
    donorName?: string; donorPhoto?: string | null; rating?: number;
    act: () => void;
  };

  const goLogin = () => router.push('/(auth)/phone');

  const claim = (o: OfferRow) => {
    if (isGuest) return goLogin();
    appAlert('קבלת תרומה', `${o.quantity} ${o.unit_label} · ${o.food_type}\nמאת ${o.donor_name}`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'איסוף עצמאי', onPress: () => doClaim(o.id, false) },
      { text: 'צריך שינוע', onPress: () => doClaim(o.id, true) },
    ]);
  };
  const doClaim = async (offerId: string, needTransport: boolean) => {
    const { data, error } = await claimOffer(offerId, needTransport);
    if (error) return appAlert('שגיאה', error.message);
    setSelectedId(null); await load();
    if (data) router.push(`/assignment/${data}`);
  };
  const commit = (n: NeedRow) => {
    if (isGuest) return goLogin();
    appAlert('התחייבות לבקשה', `${n.quantity} ${n.unit_label} · ${n.food_type}\nאזור ${regionLabel(n.region)}`, [
      { text: 'ביטול', style: 'cancel' },
      { text: 'כן, אני מוביל', onPress: () => doCommit(n.id, true) },
      { text: 'לא, צריך שינוע', onPress: () => doCommit(n.id, false) },
    ]);
  };
  const doCommit = async (needId: string, selfTransport: boolean) => {
    const { data, error } = await commitToNeed(needId, selfTransport);
    if (error) return appAlert('שגיאה', error.message);
    setSelectedId(null); await load();
    if (data) router.push(`/assignment/${data}`);
  };

  let items: Item[] = [];
  if (tab === 'offers') {
    items = offers
      .filter((o) => matchCat(o.food_type) && matchSearch(`${o.food_type} ${o.donor_name} ${o.origin_city ?? ''}`))
      .map((o) => ({
        id: o.id, food: o.food_type, quantity: o.quantity, unit: o.unit_label,
        subtitle: o.donor_name, photo: o.photo_url, lat: o.origin_lat, lng: o.origin_lng, km: dist(o.origin_lat, o.origin_lng),
        badge: o.donor_is_courier ? 'התורם מביא' : 'צריך שינוע', badgeColor: o.donor_is_courier ? colors.secondary : colors.warning,
        needsTransport: !o.donor_is_courier, city: o.origin_city ?? '', created_at: o.created_at,
        donorName: o.donor_name, donorPhoto: o.donor_photo, rating: o.donor_rating,
        act: () => claim(o),
      }));
  } else {
    items = needs
      .filter((n) => matchCat(n.food_type) && matchSearch(`${n.food_type} ${n.display_name ?? ''}`))
      .map((n) => {
        const c = REGION_CENTERS[n.region];
        return {
          id: n.id, food: n.food_type, quantity: n.quantity, unit: n.unit_label,
          subtitle: `${RECIPIENT_TYPE_LABELS[n.recipient_type]} · ${regionLabel(n.region)}`,
          photo: null, lat: c?.lat ?? null, lng: c?.lng ?? null, km: dist(c?.lat, c?.lng),
          badge: 'בקשה פתוחה', badgeColor: colors.brand700, city: regionLabel(n.region), created_at: n.created_at,
          act: () => commit(n),
        };
      });
  }
  items = items.slice().sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));

  const markers: MapOffer[] = items
    .filter((i) => i.lat != null && i.lng != null)
    .map((i, idx) => {
      const sameBefore = items.slice(0, idx).filter((x) => x.lat === i.lat && x.lng === i.lng).length;
      const off = tab === 'offers' ? 0 : sameBefore * 0.015;
      return { id: i.id, food_type: i.food, quantity: i.quantity, unit_label: i.unit, origin_lat: (i.lat as number) + off, origin_lng: (i.lng as number) + off, needsTransport: i.needsTransport };
    });
  const selected = items.find((i) => i.id === selectedId) ?? null;
  const accent = tab === 'offers' ? colors.brand700 : colors.secondary;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.white }}>
        {/* סרגל עליון */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.push(isGuest ? '/(auth)/phone' : '/(tabs)/profile')} style={styles.avatar}>
            {!isGuest && profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
              <Ionicons name="person" size={20} color={colors.white} />
            )}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={colors.textMuted}>{isGuest ? 'שלום 👋' : `שלום ${profile?.full_name?.split(' ')[0] ?? ''}`}</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location" size={16} color={colors.secondary} />
              <Txt weight="extrabold" variant="h2">{locLabel ? `סביבך · ${locLabel}` : 'תרומות באזור שלך'}</Txt>
            </View>
          </View>
          <Pressable onPress={() => setHelpOpen(true)} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="help-circle-outline" size={22} color={colors.brand700} />
          </Pressable>
          <Pressable onPress={() => router.push('/notifications')} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="notifications" size={20} color={colors.brand700} />
            {unread > 0 ? <View style={styles.badge}><Txt variant="caption" weight="bold" color={colors.white} style={{ fontSize: 9 }}>{unread > 9 ? '9+' : unread}</Txt></View> : null}
          </Pressable>
        </View>

        {/* חיפוש */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="חיפוש תרומה, תורם או עיר…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {search ? <Pressable onPress={() => setSearch('')} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable> : null}
        </View>

        {/* טאב תרומות/בקשות */}
        <View style={styles.tabSwitch}>
          <Pressable onPress={() => { setTab('offers'); setSelectedId(null); }} style={[styles.tabBtn, tab === 'offers' && { backgroundColor: colors.brand700 }]}>
            <Txt weight="bold" variant="small" color={tab === 'offers' ? colors.white : colors.textMuted}>תרומות זמינות</Txt>
          </Pressable>
          <Pressable onPress={() => { setTab('needs'); setSelectedId(null); }} style={[styles.tabBtn, tab === 'needs' && { backgroundColor: colors.secondary }]}>
            <Txt weight="bold" variant="small" color={tab === 'needs' ? colors.white : colors.textMuted}>בקשות פתוחות</Txt>
          </Pressable>
        </View>

        {/* קטגוריות */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {CHIP_CATS.map((c) => (
            <Pressable key={c.key} onPress={() => setCat(c.key)} style={[styles.chip, cat === c.key && { backgroundColor: accent, borderColor: accent }]}>
              <Txt variant="caption" weight="bold" color={cat === c.key ? colors.white : colors.textMuted}>{c.label}</Txt>
            </Pressable>
          ))}
        </ScrollView>

        {/* מפה/רשימה + מונה */}
        <View style={styles.viewRow}>
          <View style={styles.viewToggle}>
            <Pressable onPress={() => setView('list')} style={[styles.viewBtn, view === 'list' && styles.viewBtnActive]}>
              <Ionicons name="list" size={15} color={view === 'list' ? colors.brand700 : colors.textMuted} />
              <Txt variant="caption" weight="bold" color={view === 'list' ? colors.brand700 : colors.textMuted}>רשימה</Txt>
            </Pressable>
            <Pressable onPress={() => setView('map')} style={[styles.viewBtn, view === 'map' && styles.viewBtnActive]}>
              <Ionicons name="map" size={15} color={view === 'map' ? colors.brand700 : colors.textMuted} />
              <Txt variant="caption" weight="bold" color={view === 'map' ? colors.brand700 : colors.textMuted}>מפה</Txt>
            </Pressable>
          </View>
          <Txt variant="caption" color={colors.textMuted}>{items.length} {tab === 'offers' ? 'תרומות' : 'בקשות'}</Txt>
        </View>
      </SafeAreaView>

      <HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} role={profile?.roles?.[0]} />

      {/* תוכן */}
      <View style={{ flex: 1 }}>
        {view === 'map' ? (
          <View style={{ flex: 1 }}>
            <MapBoundary fallback={<View style={[StyleSheet.absoluteFill, styles.mapFallback]}><Ionicons name="map-outline" size={40} color={colors.brand500} /><Txt color={colors.textMuted} style={{ marginTop: 8 }}>המפה תיטען בקרוב</Txt></View>}>
              <OffersMap key={tab} offers={markers} variant="fullscreen" mapType="standard" interactive pinColor={accent} onSelect={setSelectedId} />
            </MapBoundary>
            {selected ? (
              <View style={[styles.detailCard, { paddingBottom: insets.bottom + spacing.md }]}>
                <Pressable onPress={() => setSelectedId(null)} hitSlop={10} style={styles.detailClose}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
                <Txt weight="bold" variant="h2">{selected.quantity} {selected.unit} · {selected.food}</Txt>
                <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{selected.subtitle}{selected.km != null ? ` · ${formatKm(selected.km)}` : ''}</Txt>
                <Button title={isGuest ? 'התחבר' : tab === 'offers' ? 'קבל תרומה זו' : 'אני אתרום'} icon={isGuest ? 'log-in' : 'checkmark-circle'} onPress={isGuest ? goLogin : selected.act} color={accent} style={{ marginTop: spacing.md }} />
              </View>
            ) : null}
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
            {items.length === 0 ? (
              <EmptyState icon="sparkles-outline" title={tab === 'offers' ? 'אין תרומות זמינות כרגע' : 'אין בקשות פתוחות כרגע'} subtitle={userLoc ? 'ממוין לפי הקרוב אליך' : undefined} />
            ) : (
              items.map((i) => (
                <Pressable key={i.id} onPress={isGuest ? goLogin : i.act} style={styles.card}>
                  <View style={styles.cardPhoto}>
                    {i.photo ? (
                      <Image source={{ uri: i.photo }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: accent + '12', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name={foodIcon(i.food)} size={34} color={accent} />
                      </View>
                    )}
                    <View style={[styles.cardBadge, { backgroundColor: i.badgeColor }]}>
                      <Txt variant="caption" weight="bold" color={colors.white} style={{ fontSize: 10 }}>{tab === 'offers' && i.needsTransport ? '🚗 ' : ''}{i.badge}</Txt>
                    </View>
                    {tab === 'offers' ? (
                      <Pressable onPress={() => toggleFav(i.id)} hitSlop={8} style={styles.heart}>
                        <Ionicons name={isSaved(i.id) ? 'heart' : 'heart-outline'} size={16} color={isSaved(i.id) ? colors.danger : colors.white} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
                    <View>
                      <Txt weight="bold" variant="body" numberOfLines={1}>{i.quantity} {i.unit} · {i.food}</Txt>
                      <Txt variant="caption" color={colors.textMuted} numberOfLines={1} style={{ marginTop: 2 }}>{i.subtitle}</Txt>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {i.city ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Ionicons name="location" size={12} color={colors.textMuted} />
                          <Txt variant="caption" color={colors.textMuted}>{i.city}{i.km != null ? ` · ${formatKm(i.km)}` : ''}</Txt>
                        </View>
                      ) : null}
                      {tab === 'offers' && i.rating ? <Txt variant="caption" weight="bold" color={colors.warning}>⭐ {i.rating}</Txt> : null}
                      <Txt variant="caption" color={colors.textMuted}>· {timeAgo(i.created_at)}</Txt>
                    </View>
                  </View>
                  <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand700, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, left: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, textAlign: 'right', padding: 0 },

  tabSwitch: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, gap: 4, marginHorizontal: spacing.lg, marginTop: spacing.md },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.pill },

  chipsRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8 },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white },

  viewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  viewToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, gap: 3 },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill },
  viewBtnActive: { backgroundColor: colors.white, ...shadow.card },

  mapFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand50 },

  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: 12, ...shadow.card },
  cardPhoto: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface },
  cardBadge: { position: 'absolute', bottom: 6, right: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  heart: { position: 'absolute', top: 5, left: 5, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },

  detailCard: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, ...shadow.card },
  detailClose: { position: 'absolute', top: spacing.md, right: spacing.md, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
});
