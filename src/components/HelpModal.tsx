import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Pressable, ScrollView, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './ui';
import { colors, radius, spacing } from '../theme/tokens';
import { ROLE_LABELS, type UserRole } from '../lib/domain';

type HelpItem = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

/** תוכן עזרה מותאם לכל סוג משתמש — קצר וברור, לפי הזרימה הפשוטה. */
const HELP: Record<UserRole, HelpItem[]> = {
  donor: [
    { icon: 'gift', title: 'פרסמו תרומה', body: 'לחצו "פרסם תרומה", בחרו מה יש לכם, כמות ומאיפה אוספים — הכל במסך אחד.' },
    { icon: 'megaphone', title: 'או ענו לבקשה', body: 'עברו על הבקשות במפה והתחייבו לבקשה שמתאימה לכם.' },
    { icon: 'call', title: 'מתחברים בטלפון', body: 'לאחר התאמה מקבלים את הטלפון של הצד השני ומתאמים איסוף ומסירה.' },
  ],
  recipient: [
    { icon: 'heart', title: 'בקשו תרומה', body: 'לחצו "בקש תרומה", כתבו מה חסר, כמה ובאיזה אזור — הבקשה תוצג לתורמים.' },
    { icon: 'map', title: 'או בחרו מהמפה', body: 'עברו על התרומות הזמינות במפה ובחרו את מה שמתאים לכם.' },
    { icon: 'checkmark-done', title: 'אשרו קבלה', body: 'כשהמזון מגיע — אשרו קבלה באפליקציה. זהו, סיימתם.' },
  ],
  courier: [
    { icon: 'car', title: 'משלוחים פתוחים', body: 'ב"הפעילות שלי" מופיעים משלוחים פתוחים באזורכם. לחצו "אני לוקח את המשלוח".' },
    { icon: 'call', title: 'תיאום בטלפון', body: 'הציגו את פרטי הקשר, אספו מהתורם ומסרו למבקש.' },
    { icon: 'checkmark-done', title: 'עדכנו סטטוס', body: '"אספתי" ← "בדרך" ← "מסרתי". המבקש יאשר קבלה בסוף.' },
  ],
  coordinator: [
    { icon: 'car', title: 'משלוחים פתוחים', body: 'ב"הפעילות שלי" מופיעים משלוחים פתוחים באזורכם. לחצו "אני לוקח את המשלוח".' },
    { icon: 'call', title: 'תיאום בטלפון', body: 'הציגו את פרטי הקשר, אספו מהתורם ומסרו למבקש.' },
    { icon: 'checkmark-done', title: 'עדכנו סטטוס', body: '"אספתי" ← "בדרך" ← "מסרתי". המבקש יאשר קבלה בסוף.' },
  ],
  org_member: [
    { icon: 'business', title: 'ניהול עמותה', body: 'נהלו את הבקשות והתרומות של העמותה במקום אחד.' },
    { icon: 'megaphone', title: 'פרסום בקשות', body: 'פרסמו בקשות בשם העמותה כדי שתורמים יוכלו לסייע.' },
  ],
  admin: [
    { icon: 'shield', title: 'ניהול מערכת', body: 'גישה ללוח הבקרה, אישור משתמשים וניהול תוכן המערכת.' },
    { icon: 'people', title: 'ניהול משתמשים', body: 'אשרו מקבלים ונהלו תפקידים.' },
  ],
};

/** עזרה כללית כשאין תפקיד (אורח) */
const GENERAL: HelpItem[] = [
  { icon: 'heart-circle', title: 'ברוכים הבאים ל‑Time2Give', body: 'הפלטפורמה שמחברת בין תורמים ליחידות צבאיות.' },
  { icon: 'person-circle', title: 'בוחרים תפקיד', body: 'תורם, מבקש או נהג מתנדב. בוחרים פעם אחת ומתחילים.' },
  { icon: 'call', title: 'מתחברים בטלפון', body: 'אחרי התאמה מתאמים ישירות בטלפון — בלי מתווכים.' },
];

const SCREEN_H = Dimensions.get('window').height;

export function HelpModal({ visible, onClose, role }: { visible: boolean; onClose: () => void; role?: UserRole }) {
  const items = (role && HELP[role]) || GENERAL;
  const roleLabel = role ? ROLE_LABELS[role] : 'איך זה עובד';

  // אנימציית כניסה: רקע דוהה פנימה (opacity) + גיליון עולה מלמטה (translateY).
  const [mounted, setMounted] = useState(visible);
  const anim = useRef(new Animated.Value(0)).current; // 0 = סגור, 1 = פתוח

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const backdropOpacity = anim; // 0 → 1
  const sheetTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H * 0.35, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* רקע כהה שדוהה פנימה */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,31,51,0.5)', opacity: backdropOpacity }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* גיליון תחתון שעולה */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '82%',
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            transform: [{ translateY: sheetTranslate }],
          }}
        >
          <SafeAreaView edges={['bottom']}>
            {/* ידית + כותרת */}
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
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="help-buoy" size={22} color={colors.brand700} />
                </View>
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
                  {/* מספר שלב + אייקון */}
                  <View style={{ alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={it.icon} size={20} color={colors.brand700} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" weight="bold" style={{ marginBottom: 2 }}>{it.title}</Txt>
                    <Txt variant="small" color={colors.textMuted}>{it.body}</Txt>
                  </View>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
