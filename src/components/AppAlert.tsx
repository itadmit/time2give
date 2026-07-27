import React, { useEffect, useState } from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './ui';
import { colors, spacing, radius, shadow } from '../theme/tokens';

export type AlertButton = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
type AlertConfig = { title: string; message?: string; buttons?: AlertButton[] };

let showFn: ((cfg: AlertConfig) => void) | null = null;

/**
 * דרופ-אין במקום Alert.alert — מציג מודל מעוצב בסגנון האפליקציה.
 * חתימה זהה ל-Alert.alert: appAlert(title, message?, buttons?).
 */
export function appAlert(title: string, message?: string, buttons?: AlertButton[]) {
  showFn?.({ title, message, buttons });
}

// אייקון+צבע לפי תוכן הכותרת/הודעה (בלי לשנות את מקומות הקריאה)
function pickIcon(text: string): { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  if (/שגיא|נכשל|שגוי|לא תקין|לא ניתן|חסר|בחר|קצר|אין הרשאה/.test(text))
    return { icon: 'alert-circle', color: colors.warning, bg: '#FBF0DA' };
  if (/✓|אושר|פורסמ|נשמר|הצלח|בוצע|מוכן|🎉|🙏/.test(text))
    return { icon: 'checkmark-circle', color: colors.secondary, bg: '#E7F6EE' };
  return { icon: 'information-circle', color: colors.brand700, bg: colors.brand50 };
}

export function AppAlertHost() {
  const [cfg, setCfg] = useState<AlertConfig | null>(null);
  useEffect(() => {
    showFn = (c) => setCfg(c);
    return () => { showFn = null; };
  }, []);

  const close = () => setCfg(null);
  const buttons: AlertButton[] = cfg?.buttons?.length ? cfg.buttons : [{ text: 'הבנתי', style: 'default' }];
  const stacked = buttons.length > 2;
  const meta = pickIcon(`${cfg?.title ?? ''} ${cfg?.message ?? ''}`);

  const press = (b: AlertButton) => {
    setCfg(null);
    b.onPress?.();
  };

  const btnStyle = (b: AlertButton) => {
    if (b.style === 'destructive') return { bg: '#FDECEC', fg: colors.danger, border: 'transparent' };
    if (b.style === 'cancel') return { bg: colors.surface, fg: colors.textMuted, border: colors.border };
    return { bg: colors.brand700, fg: colors.white, border: 'transparent' };
  };

  return (
    <Modal visible={!!cfg} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: cfg?.message ? spacing.sm : spacing.md }}>
            <View style={[styles.iconCircle, { backgroundColor: meta.bg }]}>
              <Ionicons name={meta.icon} size={26} color={meta.color} />
            </View>
            <Txt variant="h2" weight="extrabold" style={{ flex: 1 }}>{cfg?.title}</Txt>
          </View>
          {cfg?.message ? (
            <Txt variant="body" color={colors.textMuted} style={{ marginBottom: spacing.lg }}>{cfg.message}</Txt>
          ) : null}

          <View style={{ flexDirection: stacked ? 'column' : 'row', gap: 10 }}>
            {buttons.map((b, i) => {
              const s = btnStyle(b);
              return (
                <Pressable
                  key={i}
                  onPress={() => press(b)}
                  style={[styles.btn, { backgroundColor: s.bg, borderColor: s.border, borderWidth: s.border === 'transparent' ? 0 : 1, flex: stacked ? undefined : 1 }]}
                >
                  <Txt weight="bold" color={s.fg}>{b.text}</Txt>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,31,51,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: 24, padding: spacing.xl, ...shadow.card },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 13, paddingHorizontal: spacing.lg, borderRadius: radius.md },
});
