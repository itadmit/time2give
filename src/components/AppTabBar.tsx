import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './ui';
import { colors, shadow } from '../theme/tokens';

type Meta = { icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap; label: string };
const TAB_META: Record<string, Meta> = {
  feed: { icon: 'home-outline', active: 'home', label: 'בית' },
  activity: { icon: 'time-outline', active: 'time', label: 'הפעילות' },
  saved: { icon: 'heart-outline', active: 'heart', label: 'שמורים' },
  profile: { icon: 'person-outline', active: 'person', label: 'פרופיל' },
};

/** סרגל תחתון בסגנון iOS + כפתור "+" מוגבה במרכז (כמו לינקדאין). */
export function AppTabBar({ state, navigation, onAdd }: { state: any; navigation: any; onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  const byName: Record<string, { key: string; index: number }> = {};
  state.routes.forEach((r: any, i: number) => { byName[r.name] = { key: r.key, index: i }; });

  const renderTab = (name: string) => {
    const entry = byName[name];
    const meta = TAB_META[name];
    if (!entry || !meta) return <View key={name} style={styles.item} />;
    const focused = state.index === entry.index;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: entry.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(name as never);
    };
    const color = focused ? colors.brand700 : colors.textMuted;
    return (
      <Pressable key={name} onPress={onPress} style={styles.item} hitSlop={6}>
        <Ionicons name={focused ? meta.active : meta.icon} size={25} color={color} />
        <Txt weight={focused ? 'bold' : 'regular'} color={color} style={{ fontSize: 10, marginTop: 3 }}>{meta.label}</Txt>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, height: 54 + insets.bottom }]}>
      {renderTab('feed')}
      {renderTab('activity')}
      <View style={styles.item}>
        <Pressable onPress={onAdd} style={styles.plus} hitSlop={8}>
          <Ionicons name="add" size={32} color={colors.white} />
        </Pressable>
      </View>
      {renderTab('saved')}
      {renderTab('profile')}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator, alignItems: 'flex-start' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 7 },
  plus: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brand700,
    alignItems: 'center', justifyContent: 'center', marginTop: -16,
    ...shadow.card, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
});
