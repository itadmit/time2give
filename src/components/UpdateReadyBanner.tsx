import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { colors, shadow } from '../theme/tokens';

/**
 * חיווי פשוט: כשעדכון OTA ירד והוכן (isUpdatePending) — מציג באנר קטן בראש המסך
 * שמודיע שהעדכון מוכן וייכנס בפתיחה הבאה. לא קורא ל-reloadAsync (מקריס עם המפה) —
 * ההחלה קורית במסך הפתיחה אחרי סגירה+פתיחה. ניתן להקיש כדי לסגור את החיווי.
 */
export function UpdateReadyBanner() {
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);

  const enabled = !__DEV__ && Updates.isEnabled;
  if (!enabled || !isUpdatePending || dismissed) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="box-none">
      <Pressable style={styles.pill} onPress={() => setDismissed(true)}>
        <Ionicons name="cloud-done" size={18} color={colors.white} />
        <Text style={styles.text}>עדכון חדש מוכן — סגור ופתח את האפליקציה</Text>
        <Ionicons name="close" size={16} color={colors.white} style={{ opacity: 0.8 }} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.secondary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    ...shadow.card,
    shadowOpacity: 0.18,
    maxWidth: '92%',
  },
  text: { color: colors.white, fontSize: 13, fontWeight: '700', flexShrink: 1 },
});
