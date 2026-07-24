import React from 'react';
import { Modal, View, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './ui';
import { colors, radius, spacing } from '../theme/tokens';
import { ROLE_LABELS, type UserRole } from '../lib/domain';

type HelpItem = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

/** תוכן עזרה מותאם לכל סוג משתמש */
const HELP: Record<UserRole, HelpItem[]> = {
  donor: [
    { icon: 'gift', title: 'פרסום תרומה מוכנה', body: 'לחצו על "פרסם תרומה מוכנה" כדי להציע מזון או מוצרים. הוסיפו כמות, תיאור ונקודת איסוף.' },
    { icon: 'megaphone', title: 'בקשות פתוחות באזורכם', body: 'עברו על בקשות של מקבלים מורשים בקרבתכם והתאימו תרומה שמתאימה לכם.' },
    { icon: 'car', title: 'שינוע ומסירה', body: 'לאחר התאמה, רכז ומשנע מתנדב יתאמו את האיסוף. תקבלו עדכון בכל שלב.' },
    { icon: 'ribbon', title: 'מוניטין', body: 'כל תרומה שהושלמה מעלה את רמת המוניטין שלכם בקהילה.' },
  ],
  recipient: [
    { icon: 'megaphone', title: 'פרסום בקשה', body: 'לחצו "פרסם בקשת תרומה חדשה" ופרטו מה חסר, כמות ואזור. הבקשה תוצג לתורמים.' },
    { icon: 'shield-checkmark', title: 'מקבל מורשה', body: 'כמקבל מאומת, הבקשות שלכם מקבלות עדיפות ואמון גבוה יותר בקהילה.' },
    { icon: 'notifications', title: 'התאמות', body: 'כשתורם מתאים את הבקשה שלכם, תקבלו התראה ותוכלו לעקוב עד המסירה.' },
  ],
  coordinator: [
    { icon: 'git-network', title: 'תיאום שינוע', body: 'צפו בתרומות הממתינות לשינוע ושבצו משנעים מתנדבים לכל מסירה.' },
    { icon: 'people', title: 'החוליה המקשרת', body: 'אתם מחברים בין תורם, משנע ומקבל - ודאו שכל מסירה מגיעה ליעד.' },
    { icon: 'time', title: 'מעקב סטטוס', body: 'עקבו אחר מצב כל שינוע בזמן אמת דרך מסך הפעילות.' },
  ],
  courier: [
    { icon: 'car', title: 'המשלוחים שלי', body: 'צפו במשלוחים ששובצתם אליהם, אספו מנקודת המוצא ומסרו ליעד.' },
    { icon: 'navigate', title: 'ניווט', body: 'לחצו על משלוח כדי לקבל מסלול לנקודת האיסוף ולנקודת המסירה.' },
    { icon: 'checkmark-done', title: 'אישור מסירה', body: 'בסיום המסירה, אשרו בתוך האפליקציה כדי לסגור את המשלוח.' },
  ],
  org_member: [
    { icon: 'business', title: 'ניהול עמותה', body: 'נהלו את הבקשות והתרומות של העמותה במקום אחד.' },
    { icon: 'megaphone', title: 'פרסום בקשות', body: 'פרסמו בקשות בשם העמותה כדי שתורמים יוכלו לסייע.' },
  ],
  admin: [
    { icon: 'shield', title: 'ניהול מערכת', body: 'גישה ללוח הבקרה, אישור משתמשים וניהול תוכן המערכת.' },
    { icon: 'people', title: 'ניהול משתמשים', body: 'אשרו מקבלים מורשים ונהלו תפקידים.' },
  ],
};

/** עזרה כללית כשאין תפקיד */
const GENERAL: HelpItem[] = [
  { icon: 'heart-circle', title: 'ברוכים הבאים ל-Time2Give', body: 'הפלטפורמה מחברת בין תורמים, מקבלים ומתנדבים לשינוע - בבטחה.' },
  { icon: 'person-circle', title: 'בחירת תפקיד', body: 'עדכנו את הפרופיל שלכם כדי לקבל עזרה מותאמת לתפקידכם.' },
];

export function HelpModal({ visible, onClose, role }: { visible: boolean; onClose: () => void; role?: UserRole }) {
  const items = (role && HELP[role]) || GENERAL;
  const roleLabel = role ? ROLE_LABELS[role] : 'עזרה כללית';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' }} onPress={onClose}>
        <View style={{ flex: 1 }} />
        <Pressable
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: '82%',
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <SafeAreaView edges={['bottom']}>
            {/* Grabber + header */}
            <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
              <View style={{ width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.lg,
                paddingBottom: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="help-buoy" size={26} color={colors.brand700} />
                <View>
                  <Txt variant="h1" weight="extrabold">איך זה עובד</Txt>
                  <Txt variant="caption" color={colors.textMuted}>{roleLabel}</Txt>
                </View>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close-circle" size={30} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md }}>
              {items.map((it, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    gap: 14,
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: spacing.lg,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.brand50,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={it.icon} size={20} color={colors.brand700} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" weight="bold" style={{ marginBottom: 2 }}>{it.title}</Txt>
                    <Txt variant="small" color={colors.textMuted}>{it.body}</Txt>
                  </View>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
