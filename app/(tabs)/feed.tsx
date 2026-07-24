import React, { useCallback, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt } from '../../src/components/ui';
import { HelpModal } from '../../src/components/HelpModal';
import { MapBoundary } from '../../src/components/MapBoundary';
import { OffersMap, type MapOffer } from '../../src/components/OffersMap';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { ROLE_LABELS, LEVEL_META } from '../../src/lib/domain';
import { supabase } from '../../src/lib/supabase';
import { colors, spacing, radius, shadow } from '../../src/theme/tokens';

type FeedEvent = { id: number; type: string; payload: any; created_at: string };
type Cmd = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; primary?: boolean };

/**
 * דף בית בסגנון אפליקציית Tesla:
 *  - מפה כקנבס מלא ברקע (ממורכזת על המשתמש).
 *  - כרטיס סטטוס צף למעלה (מי אני + מוניטין + התראות).
 *  - "דוק" פקודות צף למטה: סטטיסטיקות חיות + שורת כפתורי פעולה מעוגלים + הצצה לפעילות הקהילה.
 * אין גלילת-עמוד: המפה שולטת, הכל צף מעליה.
 */
export default function Feed() {
  const { profile } = useAuth();
  const { unread } = useNotifications();
  const router = useRouter();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [offers, setOffers] = useState<MapOffer[]>([]);
  const [totals, setTotals] = useState({ donations: 0, units: 0 });
  const [helpOpen, setHelpOpen] = useState(false);

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
      .select('id,food_type,quantity,unit_label,origin_lat,origin_lng');
    setOffers((off as MapOffer[]) ?? []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const role = profile?.roles?.[0];
  const level = profile ? LEVEL_META[profile.reputation_level] : null;

  // שורת הפקודות תלוית-תפקיד (סגנון "כפתורי שליטה" של טסלה)
  const commands: Cmd[] = (() => {
    const map: Cmd = { key: 'map', label: 'מפת תרומות', icon: 'map', onPress: () => router.push('/(tabs)/map') };
    const activity: Cmd = { key: 'activity', label: 'הפעילות שלי', icon: 'time', onPress: () => router.push('/(tabs)/activity') };
    switch (role) {
      case 'donor':
        return [
          { key: 'offer', label: 'פרסם תרומה', icon: 'gift', primary: true, onPress: () => router.push('/offer/new') },
          { key: 'needs', label: 'בקשות באזור', icon: 'megaphone', onPress: () => router.push('/(tabs)/needs') },
          map, activity,
        ];
      case 'recipient':
        return [
          { key: 'need', label: 'בקש תרומה', icon: 'megaphone', primary: true, onPress: () => router.push('/need/new') },
          map, activity,
        ];
      case 'coordinator':
        return [
          { key: 'dispatch', label: 'ממתין לשינוע', icon: 'git-network', primary: true, onPress: () => router.push('/(tabs)/activity') },
          map,
        ];
      case 'courier':
        return [{ key: 'my', label: 'המשלוחים שלי', icon: 'car', primary: true, onPress: () => router.push('/(tabs)/activity') }, map];
      default:
        return [map, activity];
    }
  })();

  const latest = events[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.brand700 }}>
      {/* מפת רקע פול-סקרין (ממורכזת על המשתמש). נופלת חיננית לרקע מותג ב-Expo Go */}
      <MapBoundary fallback={<View style={[StyleSheet.absoluteFill, { backgroundColor: colors.brand700 }]} />}>
        <OffersMap offers={offers} variant="fullscreen" />
      </MapBoundary>

      {/* ── כרטיס סטטוס צף עליון ── */}
      <SafeAreaView edges={['top']} style={styles.topWrap} pointerEvents="box-none">
        <View style={styles.statusCard}>
          <View style={styles.avatar}>
            <Txt weight="extrabold" color={colors.white} variant="h2">
              {profile?.full_name?.trim()?.charAt(0) ?? '👋'}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt weight="bold">שלום {profile?.full_name?.split(' ')[0] ?? ''} 👋</Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Txt variant="caption" color={colors.textMuted}>{role ? ROLE_LABELS[role] : ''}</Txt>
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

          {/* שורת כפתורי פקודה (סגנון טסלה) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cmdRow}
          >
            {commands.map((c) => (
              <Pressable key={c.key} onPress={c.onPress} style={({ pressed }) => [styles.cmd, pressed && { opacity: 0.85 }]}>
                <View style={[styles.cmdIcon, c.primary && { backgroundColor: colors.secondary }]}>
                  <Ionicons name={c.icon} size={24} color={c.primary ? colors.white : colors.brand700} />
                </View>
                <Txt variant="caption" weight="medium" center numberOfLines={1} style={{ maxWidth: 74 }}>
                  {c.label}
                </Txt>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
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
  cmdRow: { paddingHorizontal: spacing.lg, gap: spacing.lg, alignItems: 'flex-start' },
  cmd: { alignItems: 'center', gap: 6, width: 76 },
  cmdIcon: {
    width: 60, height: 60, borderRadius: 22,
    backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center',
  },
});
