import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  type ViewStyle,
  type TextStyle,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, font, fontSize, shadow } from '../theme/tokens';

/* ── Text ── */
type TxtProps = {
  children?: React.ReactNode;
  variant?: 'display' | 'h1' | 'h2' | 'body' | 'small' | 'caption';
  weight?: 'regular' | 'medium' | 'bold' | 'extrabold';
  color?: string;
  center?: boolean;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
};
export function Txt({ children, variant = 'body', weight, color, center, style, numberOfLines }: TxtProps) {
  const size = fontSize[variant === 'display' ? 'display' : variant];
  const defaultWeight =
    variant === 'display' ? 'extrabold' : variant === 'h1' || variant === 'h2' ? 'bold' : 'regular';
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: font[weight ?? defaultWeight], fontSize: size, color: color ?? colors.text, textAlign: center ? 'center' : 'auto', writingDirection: 'rtl' },
        style as TextStyle,
      ]}
    >
      {children}
    </Text>
  );
}

/* ── Screen ── */
export function Screen({ children, scroll, style }: { children: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const inner = <View style={[{ flex: 1, padding: spacing.lg }, style]}>{children}</View>;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['bottom']}>
      {scroll ? (
        // keyboardShouldPersistTaps="handled" — לחיצה על כפתור כשהמקלדת פתוחה נקלטת מיד (בלי לחיצה כפולה)
        // automaticallyAdjustKeyboardInsets — המקלדת דוחפת את התוכן למעלה במקום להסתיר שדות (למשל "הערות")
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentInsetAdjustmentBehavior="always"
        >
          {children}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/* ── Header — כותרת גדולה בסגנון iOS (Large Title) ── */
export function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', height: 40, paddingHorizontal: spacing.sm }}>
          <Ionicons name="chevron-forward" size={26} color={colors.brand700} />
          <Txt variant="body" color={colors.brand700} style={{ marginRight: -2 }}>חזרה</Txt>
        </Pressable>
      ) : (
        <View style={{ height: spacing.sm }} />
      )}
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: onBack ? 0 : spacing.xs }}>
        <Txt variant="display" weight="extrabold">{title}</Txt>
        {subtitle ? <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{subtitle}</Txt> : null}
      </View>
    </SafeAreaView>
  );
}

/* ── Button ── */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  color,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  /** דריסת צבע הרקע לכפתור primary (למשל צבע השכבה) */
  color?: string;
}) {
  const bg =
    color && variant === 'primary'
      ? color
      : variant === 'primary' ? colors.brand700 : variant === 'danger' ? colors.danger : variant === 'secondary' ? colors.brand50 : 'transparent';
  const fg = variant === 'secondary' ? colors.brand700 : variant === 'ghost' ? colors.brand700 : colors.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, borderWidth: variant === 'ghost' ? 1 : 0, borderColor: colors.brand700 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* האייקון אחרי הטקסט → ב-RTL הוא בצד שמאל הפיזי של המילה (בכל הכפתורים) */}
          <Txt weight="bold" color={fg}>
            {title}
          </Txt>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/* ── Card ── */
// accent נשמר לתאימות אחורה אך לא מוצג (הפס הצבעוני היה "וובי"). כרטיס בסגנון iOS grouped.
export function Card({ children, style, onPress, accent }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; accent?: string }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, shadow.card, pressed && { opacity: 0.6 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, shadow.card, style]}>{children}</View>;
}

/* ── Pill (filter tab) ── */
export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, { backgroundColor: active ? colors.brand900 : colors.brand50 }]}>
      <Txt variant="small" weight="bold" color={active ? colors.white : colors.brand700}>
        {label}
      </Txt>
    </Pressable>
  );
}

/* ── StatusBadge (עיגול צבוע + אייקון) ── */
export function StatusBadge({ color, tint, icon, size = 40 }: { color: string; tint: string; icon: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={size * 0.5} color={color} />
    </View>
  );
}

/* ── StatBlock (מספר גדול + תווית) ── */
export function StatBlock({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Txt variant="display" weight="extrabold" color={colors.brand700} center>
        {value}
      </Txt>
      <Txt variant="caption" color={colors.textMuted} center>
        {label}
      </Txt>
    </View>
  );
}

/* ── Field ── */
export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="small" weight="medium" color={colors.textMuted} style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[styles.input, props.multiline ? { height: 96, textAlignVertical: 'top' } : null]}
      />
    </View>
  );
}

/* ── EmptyState ── */
export function EmptyState({ icon = 'sparkles-outline', title, subtitle }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
      <Ionicons name={icon} size={42} color={colors.border} />
      <Txt variant="h2" color={colors.textMuted} center>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="small" color={colors.textMuted} center>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

/* ── Stepper (מחוון שלבים ממוספר) ── */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <View style={{ alignItems: 'center', width: 80 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: done || active ? colors.brand700 : colors.brand50 }}>
                {done ? (
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                ) : (
                  <Txt variant="small" weight="bold" color={active ? colors.white : colors.textMuted}>{i + 1}</Txt>
                )}
              </View>
              <Txt variant="caption" weight={active ? 'bold' : 'regular'} color={active ? colors.brand700 : colors.textMuted} center style={{ marginTop: 4 }}>
                {label}
              </Txt>
            </View>
            {i < steps.length - 1 ? (
              <View style={{ flex: 1, height: 2, backgroundColor: i < current ? colors.brand700 : colors.border, marginBottom: 18 }} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  btn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg },
  accent: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 5 },
  pill: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.pill },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 52,
    fontFamily: font.regular,
    fontSize: fontSize.body,
    color: colors.text,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
