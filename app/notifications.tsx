import React, { useEffect } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, EmptyState, Button } from '../src/components/ui';
import { safeBack } from '../src/lib/nav';
import { useNotifications } from '../src/context/NotificationsContext';
import { colors, spacing } from '../src/theme/tokens';

export default function NotificationsScreen() {
  const router = useRouter();
  const { items, markAllRead, refresh } = useNotifications();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="התראות" onBack={() => safeBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {items.length > 0 ? (
          <Button title="סמן הכל כנקרא" variant="secondary" icon="checkmark-done" onPress={markAllRead} style={{ marginBottom: spacing.lg }} />
        ) : null}

        {items.length === 0 ? (
          <EmptyState icon="notifications-outline" title="אין התראות" subtitle="עדכונים על בקשות ושיבוצים יופיעו כאן" />
        ) : (
          items.map((n) => {
            const unread = !n.read_at;
            const aId = n.data?.assignment_id;
            const inner = (
              <Card
                key={n.id}
                style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: unread ? colors.brand50 : colors.card }}
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={20} color={colors.brand700} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt weight="bold" variant="small">
                    {n.title}
                  </Txt>
                  {n.body ? (
                    <Txt variant="caption" color={colors.textMuted}>
                      {n.body}
                    </Txt>
                  ) : null}
                  <Txt variant="caption" color={colors.textMuted}>
                    {new Date(n.created_at).toLocaleString('he-IL')}
                  </Txt>
                </View>
                {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand700 }} /> : null}
              </Card>
            );
            return aId ? (
              <Pressable key={n.id} onPress={() => router.push(`/assignment/${aId}`)}>
                {inner}
              </Pressable>
            ) : (
              inner
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
