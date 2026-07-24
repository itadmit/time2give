import React, { useCallback, useState } from 'react';
import { View, ScrollView, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Txt, Card, Button, StatBlock, EmptyState } from '../../src/components/ui';
import { HelpModal } from '../../src/components/HelpModal';
import { useAuth } from '../../src/context/AuthContext';
import { useNotifications } from '../../src/context/NotificationsContext';
import { supabase } from '../../src/lib/supabase';
import { ROLE_LABELS } from '../../src/lib/domain';
import { colors, spacing } from '../../src/theme/tokens';

type FeedEvent = { id: number; type: string; payload: any; created_at: string };

export default function Feed() {
  const { profile } = useAuth();
  const { unread } = useNotifications();
  const router = useRouter();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [totals, setTotals] = useState({ donations: 0, units: 0 });
  const [refreshing, setRefreshing] = useState(false);
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
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const role = profile?.roles?.[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.brand700 }}>
        <View style={[styles.hero, { flexDirection: 'row', alignItems: 'center' }]}>
          <View style={{ flex: 1 }}>
            <Txt variant="caption" color={colors.brand100}>
              שלום {profile?.full_name?.split(' ')[0] ?? ''} 👋
            </Txt>
            <Txt variant="h1" weight="extrabold" color={colors.white}>
              Time2Give
            </Txt>
            <Txt variant="caption" color={colors.brand100}>
              {role ? ROLE_LABELS[role] : ''}
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Pressable onPress={() => setHelpOpen(true)} hitSlop={12}>
              <Ionicons name="help-circle-outline" size={27} color={colors.white} />
            </Pressable>
            <Pressable onPress={() => router.push('/notifications')} hitSlop={12}>
              <Ionicons name="notifications" size={26} color={colors.white} />
              {unread > 0 ? (
                <View style={styles.badge}>
                  <Txt variant="caption" weight="bold" color={colors.white} style={{ fontSize: 10 }}>
                    {unread > 9 ? '9+' : unread}
                  </Txt>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} role={role} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} />}
      >
        <Card style={{ marginTop: spacing.md, flexDirection: 'row', paddingVertical: spacing.xl }}>
          <StatBlock value={totals.units.toLocaleString()} label="מנות שחולקו" />
          <View style={{ width: 1, backgroundColor: colors.border }} />
          <StatBlock value={totals.donations.toLocaleString()} label="תרומות" />
        </Card>

        <View style={{ height: spacing.lg }} />

        {/* Role CTAs */}
        {role === 'recipient' && (
          <Button title="פרסם בקשת תרומה חדשה" icon="megaphone" onPress={() => router.push('/need/new')} />
        )}
        {role === 'donor' && (
          <View style={{ gap: 10 }}>
            <Button title="פרסם תרומה מוכנה" icon="gift" onPress={() => router.push('/offer/new')} />
            <Button title="בקשות פתוחות באזורך" variant="secondary" icon="megaphone" onPress={() => router.push('/(tabs)/needs')} />
          </View>
        )}
        {role === 'coordinator' && (
          <Button title="תרומות הממתינות לשינוע" icon="git-network" onPress={() => router.push('/(tabs)/activity')} />
        )}
        {role === 'courier' && (
          <Button title="המשלוחים שלי" icon="car" onPress={() => router.push('/(tabs)/activity')} />
        )}

        <View style={{ height: spacing.xl }} />
        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          מה קורה בקהילה
        </Txt>

        {events.length === 0 ? (
          <EmptyState icon="people-outline" title="עדיין שקט כאן" subtitle="פעולות בקהילה יופיעו כאן" />
        ) : (
          events.map((e) => (
            <Card key={e.id} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="ribbon" size={24} color={colors.success} />
              <Txt variant="small">{e.payload?.text ?? e.type}</Txt>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = {
  hero: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.lg, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  badge: {
    position: 'absolute' as const,
    top: -6,
    left: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
};
