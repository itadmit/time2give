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

  // Neutrals
  bg: '#FFFFFF',
  surface: '#F8FAFC', // רקע העמוד (Background)
  card: '#FFFFFF', // רקע כרטיס (Surface)
  text: '#1F2937',
  textMuted: '#6B7280',
  border: '#E5E7EB',

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
  sm: 10,
  md: 14,
  lg: 20, // כרטיסים
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

export const shadow = {
  card: {
    shadowColor: '#0B1F33',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;
