import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, Modal, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Txt, Button } from '../../src/components/ui';
import { HelpModal } from '../../src/components/HelpModal';
import { MapBoundary } from '../../src/components/MapBoundary';
import { OffersMap, type MapOffer } from '../../src/components/OffersMap';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { ROLE_LABELS, LEVEL_META, RECIPIENT_TYPE_LABELS, type ReputationLevel, type RecipientType } from '../../src/lib/domain';
import { claimOffer, commitToNeed } from '../../src/lib/api';
import { regionLabel, REGION_CENTERS, type Region } from '../../src/lib/regions';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

type FeedEvent = { id: number; type: string; payload: any; created_at: string };
type Intent = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
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
};
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
};
type MapMode = 'offers' | 'needs';

/**
 * דף בית בסגנון אפליקציית Tesla:
 *  - מפה כקנבס מלא ברקע (ממורכזת על המשתמש).
 *  - כרטיס סטטוס צף למעלה (מי אני + מוניטין + התראות).
 *  - "דוק" פקודות צף למטה: סטטיסטיקות חיות + שורת כפתורי פעולה מעוגלים + הצצה לפעילות הקהילה.
 * אין גלילת-עמוד: המפה שולטת, הכל צף מעליה.
 */
export default function Feed() {
  const { profile, session } = useAuth();
  const { unread } = useNotifications();
  const router = useRouter();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [totals, setTotals] = useState({ donations: 0, units: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>('offers');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const isGuest = !session || !profile;
  const isRecipient = !!profile?.roles?.includes('recipient');
  const isDonor = !!profile?.roles?.includes('donor');

  const load = useCallback(async () => {
    const { data } = await supabase.from('feed_events').select('*').order('created_at', { ascending: false }).limit(20);
    setEvents((data as FeedEvent[]) ?? []);
    const { data: agg } = await supabase.from('profiles_public').select('total_donations,total_units');
    if (agg) {
      setTotals({
        donations: agg.reduce((s: number, r: any) => s + (r.total_donations ?? 0), 0),
        units: agg.reduce((s: number, r: any) => s + (r.total_units ?? 0), 0),
      });
    }
    const { data: off } = await supabase
      .from('open_offers_v')
      .select('id,food_type,quantity,unit_label,kosher,vegetarian,notes,origin_city,origin_lat,origin_lng,donor_name,donor_level,donor_rating');
    setOffers((off as OfferRow[]) ?? []);
    const { data: nd } = await supabase
      .from('open_needs_v')
      .select('id,region,food_type,quantity,unit_label,needed_at,notes,recipient_type,display_name');
    setNeeds((nd as NeedRow[]) ?? []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const role = profile?.roles?.[0];
  const level = profile ? LEVEL_META[profile.reputation_level] : null;

  // "במה אתה מעוניין?" — בורר כוונה. אורח → הרשמה/התחברות; מחובר → מסך הפעולה המתאים.
  const go = (loggedInPath: string) => () => router.push(isGuest ? '/(auth)/phone' : (loggedInPath as any));
  const intents: Intent[] = [
    { key: 'seek', label: 'אני מחפש תרומה', icon: 'search', onPress: go('/need/new') },
    { key: 'donate', label: 'אני רוצה לתרום', icon: 'gift', onPress: go('/offer/new') },
    { key: 'transport', label: 'אני רוצה לשנע את התרומה', icon: 'car', onPress: go('/(tabs)/activity') },
    { key: 'coordinator', label: 'רוצה להצטרף כרכז', icon: 'git-network', onPress: go('/(tabs)/activity') },
  ];

  const latest = events[0];

  // בקשות (region בלבד) → סמנים במרכז האזור, עם היסט קטן לבקשות באותו אזור כדי שלא יחפפו
  const needMarkers: MapOffer[] = needs.map((n, i) => {
    const c = REGION_CENTERS[n.region];
    const sameBefore = needs.slice(0, i).filter((x) => x.region === n.region).length;
    const off = sameBefore * 0.02;
    return {
      id: n.id,
      food_type: n.food_type,
      quantity: n.quantity,
      unit_label: n.unit_label,
      origin_lat: c ? c.lat + off : null,
      origin_lng: c ? c.lng + off : null,
    };
  });
  const offerMarkers: MapOffer[] = offers;
  const markers = mapMode === 'offers' ? offerMarkers : needMarkers;

  const selectedOffer = mapMode === 'offers' ? offers.find((o) => o.id === selectedId) ?? null : null;
  const selectedNeed = mapMode === 'needs' ? needs.find((n) => n.id === selectedId) ?? null : null;
  const selectedLevel = selectedOffer ? LEVEL_META[selectedOffer.donor_level] : null;

  const closeMap = () => {
    setSelectedId(null);
    setMapOpen(false);
  };
  const switchMode = (m: MapMode) => {
    setMapMode(m);
    setSelectedId(null);
  };

  // בחירת תרומה מהמפה (מקבל בלבד) → claim → מסך השיבוץ
  const claim = (offer: OfferRow) => {
    if (isGuest) return router.push('/(auth)/phone');
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
    closeMap();
    await load();
    if (data) router.push(`/assignment/${data}`);
  };

  // התחייבות לבקשה מהמפה (תורם בלבד) → commit → מסך השיבוץ
  const commit = (need: NeedRow) => {
    if (isGuest) return router.push('/(auth)/phone');
    Alert.alert(
      'התחייבות לבקשה',
      `${need.quantity} ${need.unit_label} · ${need.food_type}\nאזור ${regionLabel(need.region)}\n\nהאם תבצע את השינוע בעצמך?`,
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
    closeMap();
    await load();
    if (data) router.push(`/assignment/${data}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand700 }}>
      {/* מפת רקע פול-סקרין בשחור-לבן (mutedStandard), לא-אינטראקטיבית. נופלת חיננית לרקע מותג ב-Expo Go */}
      <MapBoundary fallback={<View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brand700 }]} />}>
        <OffersMap offers={offers} variant="fullscreen" mapType="mutedStandard" interactive={false} />
      </MapBoundary>
      {/* לחיצה על המפה → פותחת מפה צבעונית אינטראקטיבית בפול-סקרין */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setMapOpen(true)}>
        <View style={styles.tapHint} pointerEvents="none">
          <Ionicons name="expand" size={14} color={colors.white} />
          <Txt variant="caption" weight="medium" color={colors.white}>הקש למפה מלאה</Txt>
        </View>
      </Pressable>

      {/* ── כרטיס סטטוס צף עליון ── */}
      <SafeAreaView edges={['top']} style={styles.topWrap} pointerEvents="box-none">
        <View style={styles.statusCard}>
          <View style={styles.avatar}>
            {isGuest ? (
              <Ionicons name="person" size={22} color={colors.white} />
            ) : (
              <Txt weight="extrabold" color={colors.white} variant="h2">
                {profile?.full_name?.trim()?.charAt(0) ?? '👋'}
              </Txt>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="bold">
              {isGuest ? 'שלום אורח 👋' : `שלום ${profile?.full_name?.split(' ')[0] ?? ''} 👋`}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Txt variant="caption" color={colors.textMuted}>
                {isGuest ? 'התחבר לפעולות' : role ? ROLE_LABELS[role] : ''}
              </Txt>
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
                <Txt variant="caption" weight="bold" color={colors.white} style={{ fontSize: 9 }}>
                  {unread > 9 ? '9+' : unread}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        </View>
      </SafeAreaView>

      <HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} role={role} />

      {/* ── דוק פקודות צף תחתון ── */}
      <SafeAreaView edges={['bottom']} style={styles.dockWrap} pointerEvents="box-none">
        {/* הצצה לפעילות הקהילה (צ'יפ) */}
        {latest ? (
          <View style={styles.communityChip}>
            <Ionicons name="ribbon" size={16} color={colors.success} />
            <Txt variant="caption" weight="medium" style={{ flex: 1 }} numberOfLines={1}>
              {latest.payload?.text ?? 'פעילות חדשה בקהילה'}
            </Txt>
          </View>
        ) : null}

        <View style={styles.dock}>
          {/* סטטיסטיקות חיות */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Txt variant="h2" weight="extrabold" color={colors.brand700}>{totals.units.toLocaleString()}</Txt>
              <Txt variant="caption" color={colors.textMuted}>מנות שחולקו</Txt>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Txt variant="h2" weight="extrabold" color={colors.brand700}>{totals.donations.toLocaleString()}</Txt>
              <Txt variant="caption" color={colors.textMuted}>תרומות</Txt>
            </View>
          </View>

          {/* "במה אתה מעוניין?" — בורר כוונה */}
          <Txt weight="bold" style={styles.intentTitle}>במה אתה מעוניין?</Txt>
          <View style={styles.intentList}>
            {intents.map((it) => (
              <Pressable
                key={it.key}
                onPress={it.onPress}
                style={({ pressed }) => [styles.intentRow, pressed && { backgroundColor: colors.brand50 }]}
              >
                <View style={styles.intentIcon}>
                  <Ionicons name={it.icon} size={20} color={colors.brand700} />
                </View>
                <Txt weight="medium" style={{ flex: 1 }}>{it.label}</Txt>
                <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* ── מפה צבעונית אינטראקטיבית בפול-סקרין (נפתחת בלחיצה על מפת הרקע) ── */}
      <Modal visible={mapOpen} animationType="slide" onRequestClose={closeMap} presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: colors.brand700 }}>
          <StatusBar style="dark" />
          <MapBoundary fallback={<View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Txt color={colors.white}>מפה זמינה ב-Dev Build</Txt></View>}>
            <OffersMap key={mapMode} offers={markers} variant="fullscreen" mapType="standard" interactive onSelect={setSelectedId} />
          </MapBoundary>
          {/* insets מהקומפוננטה (root provider) — אמין בתוך Modal, שלא כמו SafeAreaView שם */}
          <View style={[styles.modalTop, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
            <Pressable onPress={closeMap} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            {/* טוגלים: תרומות זמינות / בקשות לתרומה */}
            <View style={styles.toggleWrap}>
              <Pressable onPress={() => switchMode('offers')} style={[styles.toggle, mapMode === 'offers' && styles.toggleOn]}>
                <Ionicons name="gift" size={15} color={mapMode === 'offers' ? colors.white : colors.brand700} />
                <Txt variant="caption" weight="bold" color={mapMode === 'offers' ? colors.white : colors.brand700}>תרומות זמינות</Txt>
              </Pressable>
              <Pressable onPress={() => switchMode('needs')} style={[styles.toggle, mapMode === 'needs' && styles.toggleOn]}>
                <Ionicons name="megaphone" size={15} color={mapMode === 'needs' ? colors.white : colors.brand700} />
                <Txt variant="caption" weight="bold" color={mapMode === 'needs' ? colors.white : colors.brand700}>בקשות לתרומה</Txt>
              </Pressable>
            </View>
          </View>

          {/* כרטיס פרטים — תרומה (מצב 'offers') */}
          {selectedOffer ? (
            <View style={[styles.detailCard, { paddingBottom: insets.bottom + spacing.lg }]}>
              <Pressable onPress={() => setSelectedId(null)} hitSlop={10} style={styles.detailClose}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={styles.detailIcon}>
                  <Ionicons name="fast-food" size={24} color={colors.brand700} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" variant="h2">{selectedOffer.quantity} {selectedOffer.unit_label} · {selectedOffer.food_type}</Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {selectedOffer.donor_name}
                    {selectedLevel ? ` · Level ${selectedLevel.n}` : ''}
                    {selectedOffer.donor_rating > 0 ? ` · ⭐ ${selectedOffer.donor_rating}` : ''}
                    {selectedOffer.origin_city ? ` · ${selectedOffer.origin_city}` : ''}
                  </Txt>
                </View>
              </View>

              {(selectedOffer.kosher || selectedOffer.vegetarian || selectedOffer.notes) ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: spacing.md }}>
                  {selectedOffer.kosher ? <View style={styles.tag}><Txt variant="caption" weight="medium" color={colors.brand700}>כשר</Txt></View> : null}
                  {selectedOffer.vegetarian ? <View style={styles.tag}><Txt variant="caption" weight="medium" color={colors.brand700}>צמחוני</Txt></View> : null}
                  {selectedOffer.notes ? <Txt variant="caption" color={colors.textMuted} style={{ flex: 1 }} numberOfLines={2}>{selectedOffer.notes}</Txt> : null}
                </View>
              ) : null}

              {isRecipient ? (
                <Button title="בחר תרומה זו" icon="checkmark-circle" onPress={() => claim(selectedOffer)} style={{ marginTop: spacing.lg }} />
              ) : isGuest ? (
                <Button title="התחבר כדי לבחור תרומה" variant="secondary" icon="log-in" onPress={() => router.push('/(auth)/phone')} style={{ marginTop: spacing.lg }} />
              ) : null}
            </View>
          ) : null}

          {/* כרטיס פרטים — בקשה (מצב 'needs') */}
          {selectedNeed ? (
            <View style={[styles.detailCard, { paddingBottom: insets.bottom + spacing.lg }]}>
              <Pressable onPress={() => setSelectedId(null)} hitSlop={10} style={styles.detailClose}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={[styles.detailIcon, { backgroundColor: '#FBF0DA' }]}>
                  <Ionicons name="restaurant" size={24} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" variant="h2">{selectedNeed.quantity} {selectedNeed.unit_label} · {selectedNeed.food_type}</Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {RECIPIENT_TYPE_LABELS[selectedNeed.recipient_type]} · אזור {regionLabel(selectedNeed.region)}
                  </Txt>
                </View>
              </View>

              {selectedNeed.notes ? (
                <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.md }} numberOfLines={2}>{selectedNeed.notes}</Txt>
              ) : null}

              {isDonor ? (
                <Button title="אני מתחייב לבקשה" icon="hand-left" onPress={() => commit(selectedNeed)} style={{ marginTop: spacing.lg }} />
              ) : isGuest ? (
                <Button title="התחבר כדי להתחייב" variant="secondary" icon="log-in" onPress={() => router.push('/(auth)/phone')} style={{ marginTop: spacing.lg }} />
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const CARD_BG = 'rgba(255,255,255,0.96)';

const styles = StyleSheet.create({
  topWrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: CARD_BG,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.brand700,
    alignItems: 'center', justifyContent: 'center',
  },
  levelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.brand50,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 2, left: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },

  dockWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  communityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'center',
    backgroundColor: CARD_BG,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    marginBottom: spacing.sm, maxWidth: '100%',
    ...shadow.card,
  },
  dock: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    ...shadow.card,
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingBottom: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border },

  intentTitle: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  intentList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  intentRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  intentIcon: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center',
  },

  tapHint: {
    position: 'absolute', top: '38%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(20,58,94,0.55)',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },

  modalTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: CARD_BG,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  modalTitle: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: CARD_BG,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    ...shadow.card,
  },

  toggleWrap: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: radius.pill,
    padding: 4,
    gap: 4,
    ...shadow.card,
  },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  toggleOn: { backgroundColor: colors.brand700 },

  detailCard: {
    position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg, paddingTop: spacing.xl,
    ...shadow.card,
  },
  detailClose: {
    position: 'absolute', top: spacing.md, left: spacing.md,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', zIndex: 1,
  },
  detailIcon: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center',
  },
  tag: {
    backgroundColor: colors.brand50,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
});
