import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTabBar } from '../../src/components/AppTabBar';
import { Txt } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { colors, spacing, radius } from '../../src/theme/tokens';

export default function TabsLayout() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const isGuest = !session || !profile;
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState(false);

  const go = (path: string) => {
    setSheet(false);
    router.push((isGuest ? '/(auth)/phone' : path) as any);
  };

  return (
    <>
      <Tabs
        tabBar={(props) => <AppTabBar {...props} onAdd={() => setSheet(true)} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="activity" />
        <Tabs.Screen name="saved" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="needs" options={{ href: null }} />
        <Tabs.Screen name="map" options={{ href: null }} />
      </Tabs>

      {/* גיליון פעולת ה-"+" (גלובלי מכל טאב) */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }} onPress={() => setSheet(false)}>
          <Pressable
            style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: 'center', marginBottom: spacing.md }}>
              <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
            </View>
            <Txt variant="h2" weight="extrabold" center style={{ marginBottom: spacing.lg }}>מה תרצו לעשות?</Txt>
            <Pressable onPress={() => go('/offer/new')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.brand50, borderRadius: radius.lg, padding: spacing.lg }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brand700, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="gift" size={22} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Txt weight="bold">פרסם תרומה</Txt>
                <Txt variant="caption" color={colors.textMuted}>יש לי מזון לתרום</Txt>
              </View>
              <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => go('/need/new')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: '#E7F6EE', borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="megaphone" size={22} color={colors.white} /></View>
              <View style={{ flex: 1 }}>
                <Txt weight="bold">בקש תרומה</Txt>
                <Txt variant="caption" color={colors.textMuted}>אני צריך תרומה עבור היחידה</Txt>
              </View>
              <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
