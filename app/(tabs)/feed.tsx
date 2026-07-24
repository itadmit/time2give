import React, { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet, Modal } from 'react-native';
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
type Intent = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };

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
  const [offers, setOffers] = useState<MapOffer[]>([]);
  const [totals, setTotals] = useState({ donations: 0, units: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const isGuest = !session || !profile;

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

  // "במה אתה מעוניין?" — בורר כוונה. אורח → הרשמה/התחברות; מחובר → מסך הפעולה המתאים.
  const go = (loggedInPath: string) => () => router.push(isGuest ? '/(auth)/phone' : (loggedInPath as any));
  const intents: Intent[] = [
    { key: 'seek', label: 'אני מחפש תרומה', icon: 'search', onPress: go('/need/new') },
    { key: 'donate', label: 'אני רוצה לתרום', icon: 'gift', onPress: go('/offer/new') },
    { key: 'transport', label: 'אני רוצה לשנע את התרומה', icon: 'car', onPress: go('/(tabs)/activity') },
    { key: 'coordinator', label: 'רוצה להצטרף כרכז', icon: 'git-network', onPress: go('/(tabs)/activity') },
  ];

  const latest = events[0];

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
                {isGuest ? 'גלישה חופשית · התחבר לפעולות' : role ? ROLE_LABELS[role] : ''}
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
      <Modal visible={mapOpen} animationType="slide" onRequestClose={() => setMapOpen(false)} presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: colors.brand700 }}>
          <MapBoundary fallback={<View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Txt color={colors.white}>מפה זמינה ב-Dev Build</Txt></View>}>
            <OffersMap offers={offers} variant="fullscreen" mapType="standard" interactive />
          </MapBoundary>
          <SafeAreaView edges={['top']} style={styles.modalTop} pointerEvents="box-none">
            <Pressable onPress={() => setMapOpen(false)} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.modalTitle}>
              <Ionicons name="gift" size={16} color={colors.brand700} />
              <Txt weight="bold" color={colors.brand700}>תרומות זמינות</Txt>
            </View>
          </SafeAreaView>
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
});
