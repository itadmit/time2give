import React, { useCallback, useState } from 'react';
import { View, ScrollView, Alert, RefreshControl, Pressable } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, EmptyState, Divider } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { adminListContent, adminDeleteOffer, adminDeleteNeed, adminDeleteAssignment } from '../../src/lib/api';
import { statusUI } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

type Offer = { id: string; food_type: string; quantity: number; unit_label: string; status: string; donor_name: string | null };
type Need = { id: string; food_type: string; quantity: number; unit_label: string; status: string; region: string; recipient: string | null };
type Assignment = { id: string; status: string; destination: string; donor_name: string | null; courier_name: string | null };
type Content = { offers: Offer[]; needs: Need[]; assignments: Assignment[] };

function Row({ title, subtitle, badge, badgeColor, onDelete }: { title: string; subtitle: string; badge: string; badgeColor: string; onDelete: () => void }) {
  return (
    <Card style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Txt weight="bold" numberOfLines={1}>{title}</Txt>
        <Txt variant="caption" color={colors.textMuted} numberOfLines={1}>{subtitle}</Txt>
      </View>
      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: badgeColor + '22' }}>
        <Txt variant="caption" weight="bold" color={badgeColor}>{badge}</Txt>
      </View>
      <Pressable onPress={onDelete} hitSlop={10} style={{ padding: 4 }}>
        <Ionicons name="trash" size={20} color={colors.danger} />
      </Pressable>
    </Card>
  );
}

export default function AdminContent() {
  const [content, setContent] = useState<Content | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await adminListContent();
    if (error) { setErr(error.message); return; }
    setErr(null);
    setContent(data as Content);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const confirmDelete = (label: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    appAlert('מחיקה', `למחוק ${label}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'מחק',
        style: 'destructive',
        onPress: async () => {
          const { error } = await fn();
          if (error) return appAlert('שגיאה', error.message);
          await load();
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="ניהול תוכן" subtitle="מחיקה פר-פריט" onBack={() => safeBack()} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand700} />}
      >
        {err ? (
          <Card style={{ backgroundColor: '#F9E4E4' }}>
            <Txt weight="bold" color={colors.danger}>שגיאה</Txt>
            <Txt variant="caption" color={colors.textMuted}>{err}</Txt>
          </Card>
        ) : null}

        {/* הצעות */}
        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          תרומות ({content?.offers.length ?? 0})
        </Txt>
        {content && content.offers.length === 0 ? <EmptyState icon="gift-outline" title="אין תרומות" /> : null}
        {content?.offers.map((o) => (
          <Row
            key={o.id}
            title={`${o.food_type} · ${o.quantity} ${o.unit_label}`}
            subtitle={`תורם: ${o.donor_name ?? '—'}`}
            badge={o.status}
            badgeColor={colors.brand700}
            onDelete={() => confirmDelete('תרומה זו', () => adminDeleteOffer(o.id))}
          />
        ))}
        <Divider />

        {/* בקשות */}
        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          בקשות ({content?.needs.length ?? 0})
        </Txt>
        {content && content.needs.length === 0 ? <EmptyState icon="megaphone-outline" title="אין בקשות" /> : null}
        {content?.needs.map((n) => (
          <Row
            key={n.id}
            title={`${n.food_type} · ${n.quantity} ${n.unit_label}`}
            subtitle={`${n.recipient ?? '—'} · ${regionLabel(n.region as Region)}`}
            badge={n.status}
            badgeColor={colors.warning}
            onDelete={() => confirmDelete('בקשה זו', () => adminDeleteNeed(n.id))}
          />
        ))}
        <Divider />

        {/* שיבוצים */}
        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          שיבוצים ({content?.assignments.length ?? 0})
        </Txt>
        {content && content.assignments.length === 0 ? <EmptyState icon="git-network-outline" title="אין שיבוצים" /> : null}
        {content?.assignments.map((a) => {
          const ui = statusUI(a.status as any);
          return (
            <Row
              key={a.id}
              title={`${a.donor_name ?? '—'} → ${a.courier_name ?? 'ללא משנע'}`}
              subtitle={`יעד: ${regionLabel(a.destination as Region)}`}
              badge={ui.label}
              badgeColor={ui.color}
              onDelete={() => confirmDelete('שיבוץ זה', () => adminDeleteAssignment(a.id))}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
