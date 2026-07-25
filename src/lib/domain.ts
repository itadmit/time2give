/**
 * טיפוסי דומיין + מיפוי סטטוס→ניראות (אפיון §14.5, ARCHITECTURE §4/§7).
 */
import { colors, statusTint } from '../theme/tokens';

export type UserRole = 'donor' | 'recipient' | 'coordinator' | 'courier' | 'org_member' | 'admin';

export const ROLE_LABELS: Record<UserRole, string> = {
  donor: 'תורם',
  recipient: 'מקבל מורשה',
  coordinator: 'נהג מתנדב',
  courier: 'נהג מתנדב',
  org_member: 'עמותה',
  admin: 'אדמין',
};

export type RecipientType =
  | 'military_unit'
  | 'hospital'
  | 'elderly'
  | 'family'
  | 'ngo'
  | 'rescue'
  | 'evacuee'
  | 'emergency';

export const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  military_unit: 'יחידה צבאית',
  hospital: 'בית חולים',
  elderly: 'קשישים',
  family: 'משפחה נזקקת',
  ngo: 'עמותה',
  rescue: 'כוחות הצלה',
  evacuee: 'מפונים',
  emergency: 'חירום',
};

export type ReputationLevel =
  | 'verified'
  | 'trusted'
  | 'elite'
  | 'community_leader'
  | 'national_volunteer';

export const LEVEL_META: Record<ReputationLevel, { n: number; label: string }> = {
  verified: { n: 1, label: 'מאומת' },
  trusted: { n: 2, label: 'מהימן' },
  elite: { n: 3, label: 'מצטיין' },
  community_leader: { n: 4, label: 'מוביל קהילה' },
  national_volunteer: { n: 5, label: 'מתנדב לאומי' },
};

export type AssignmentStatus =
  | 'committed'
  | 'waiting_courier'
  | 'courier_assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'confirmed'
  | 'rated'
  | 'closed'
  | 'cancelled';

type StatusUI = { label: string; color: string; tint: string; icon: string };

/** מיפוי מצב → צבע + תווית + אייקון (Ionicons) */
export const STATUS_UI: Record<AssignmentStatus, StatusUI> = {
  committed: { label: 'התקבלה התחייבות', color: colors.info, tint: statusTint.info, icon: 'checkmark-circle' },
  waiting_courier: { label: 'ממתין לשינוע', color: colors.warning, tint: statusTint.warning, icon: 'car' },
  courier_assigned: { label: 'נהג מתנדב בדרך', color: colors.info, tint: statusTint.info, icon: 'navigate' },
  picked_up: { label: 'נאסף', color: colors.info, tint: statusTint.info, icon: 'cube' },
  on_the_way: { label: 'בדרך', color: colors.info, tint: statusTint.info, icon: 'navigate' },
  delivered: { label: 'נמסר', color: colors.success, tint: statusTint.success, icon: 'checkmark-done' },
  confirmed: { label: 'אושרה קבלה', color: colors.success, tint: statusTint.success, icon: 'shield-checkmark' },
  rated: { label: 'דורג', color: colors.success, tint: statusTint.success, icon: 'star' },
  closed: { label: 'סגור', color: colors.textMuted, tint: statusTint.neutral, icon: 'archive' },
  cancelled: { label: 'בוטל', color: colors.danger, tint: statusTint.danger, icon: 'close-circle' },
};

export const statusUI = (s: AssignmentStatus): StatusUI =>
  STATUS_UI[s] ?? { label: s, color: colors.textMuted, tint: statusTint.neutral, icon: 'ellipse' };
