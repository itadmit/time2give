/**
 * Design tokens - Time4Giving
 * שפה עיצובית: כחול כהה כ-Primary, ירוק כ-Secondary/אקסנט.
 * צבע = סטטוס (המצב במכונת המצבים). ראה אפיון §14.5.
 */

export const colors = {
  // Brand - כחול כהה (Primary): אמון וביטחון
  brand900: '#143A5E', // Primary Hover
  brand700: '#1D4E7C', // PRIMARY
  brand600: '#2461A0',
  brand500: '#3B7BC4',
  brand100: '#DCE8F5',
  brand50: '#EEF4FB',

  // Secondary - ירוק: נתינה, פעולה, הצלחה
  secondary: '#35B172', // Secondary / CTA
  secondaryHover: '#14794A', // Secondary Hover
  accent: '#22C55E', // אקסנט חי (הדגשות)

  // Status (אקסנטים בלבד)
  success: '#56C596',
  info: '#1D4E7C', // = brand
  warning: '#F59E0B',
  danger: '#DC2626',

  // Neutrals — פלטת iOS מערכתית (native feel)
  bg: '#FFFFFF',
  surface: '#F2F2F7', // systemGroupedBackground — רקע עמוד אפור עדין
  card: '#FFFFFF', // secondarySystemGroupedBackground — רקע שורה/כרטיס
  text: '#1C1C1E', // label
  textMuted: '#8E8E93', // secondaryLabel
  border: '#E5E5EA', // separator (opaque)
  separator: '#C6C6C8', // hairline מפריד בין שורות

  white: '#FFFFFF',
  black: '#000000',
} as const;

/** גרדיאנט מותג - כחול→ירוק (hero / CTA) */
export const gradient = {
  brand: ['#1D4E7C', '#35B172'] as const,
  brandTri: ['#1D4E7C', '#2C7DA0', '#35B172'] as const, // 0% / 45% / 100%
};

/** צבעי כפתורי CTA */
export const cta = {
  primaryBg: '#35B172',
  primaryText: '#FFFFFF',
  primaryHover: '#14794A',
  secondaryBorder: '#1D4E7C',
  secondaryText: '#1D4E7C',
  secondaryBg: 'transparent',
} as const;

/** Dark mode */
export const darkColors = {
  bg: '#0F172A',
  card: '#1E293B',
  primary: '#2C7DA0',
  secondary: '#35B172',
  text: '#F8FAFC',
  textMuted: '#CBD5E1',
} as const;

/** גוון רקע רך (12%) עבור באדג' סטטוס */
export const statusTint: Record<string, string> = {
  success: '#E6F7EF',
  info: '#E4EDF6',
  warning: '#FEF3E2',
  danger: '#FBE3E3',
  neutral: '#EEF1F4',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 14, // כרטיסים (iOS grouped ~10-14)
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const font = {
  // משפחת Heebo (נטענת ב-root layout)
  regular: 'Heebo_400Regular',
  medium: 'Heebo_500Medium',
  bold: 'Heebo_700Bold',
  extrabold: 'Heebo_800ExtraBold',
} as const;

export const fontSize = {
  display: 30,
  h1: 22,
  h2: 18,
  body: 16,
  small: 14,
  caption: 13,
} as const;

// צל עדין מאוד — iOS grouped lists כמעט ללא צל (ההפרדה נעשית ע"י רקע אפור + hairline)
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;
