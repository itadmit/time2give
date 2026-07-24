import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Txt } from './ui';
import { colors, spacing, radius } from '../theme/tokens';

/**
 * כפתור פעולה צף תלוי-תפקיד ("הנעה לפעולה"):
 *  - אורח       → "הצטרפו · בקשו או תרמו"  → התחברות
 *  - תורם        → "פרסם תרומה"            → יצירת תרומה
 *  - חייל (מקבל) → "בקש תרומה"             → יצירת בקשה
 *  - רכז/נהג     → אין כפתור (מקבלים פוש / פועלים דרך שיבוצים)
 */
export function FloatingCTA() {
  const { profile, session } = useAuth();
  const router = useRouter();
  const roles = profile?.roles ?? [];

  let label: string;
  let icon: keyof typeof Ionicons.glyphMap;
  let onPress: () => void;

  if (!session || !profile) {
    label = 'הצטרפו · בקשו או תרמו';
    icon = 'person-add';
    onPress = () => router.push('/(auth)/phone');
  } else if (roles.includes('donor')) {
    label = 'פרסם תרומה';
    icon = 'add';
    onPress = () => router.push('/offer/new');
  } else if (roles.includes('recipient')) {
    label = 'בקש תרומה';
    icon = 'add';
    onPress = () => router.push('/need/new');
  } else {
    return null;
  }

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, { opacity: pressed ? 0.9 : 1 }]}>
        <Ionicons name={icon} size={22} color={colors.white} />
        <Txt weight="bold" color={colors.white}>
          {label}
        </Txt>
      </Pressable>
    </View>
  );
}

const styles = {
  wrap: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: spacing.lg,
    alignItems: 'center' as const,
  },
  fab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: colors.brand700,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
};
