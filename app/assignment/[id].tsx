import React, { useCallback, useState } from 'react';
import { View, ScrollView, Alert, Linking, Pressable, Image } from 'react-native';
import { appAlert } from '../../src/components/AppAlert';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Txt, Card, Button, StatusBadge, Divider } from '../../src/components/ui';
import { safeBack } from '../../src/lib/nav';
import { useAuth } from '../../src/context/AuthContext';
import { supabase } from '../../src/lib/supabase';
import { revealPhone, advanceAssignment, submitRating, claimDelivery, releaseDelivery } from '../../src/lib/api';
import { statusUI, LEVEL_META, type AssignmentStatus, type ReputationLevel } from '../../src/lib/domain';
import { regionLabel, type Region } from '../../src/lib/regions';
import { colors, spacing, radius } from '../../src/theme/tokens';

type Assignment = {
  id: string;
  status: AssignmentStatus;
  general_destination: Region;
  self_transport: boolean;
  donor_id: string;
  courier_id: string | null;
  recipient: { user_id: string } | null;
  need: { food_type: string; quantity: number; unit_label: string } | null;
  offer: { food_type: string; quantity: number; unit_label: string; origin_city: string | null } | null;
};
type Ev = { id: number; type: string; created_at: string; payload: any };
type Contact = { role: string; name: string; phone: string };
type Donor = { id: string; full_name: string | null; photo_url: string | null; reputation_level: ReputationLevel; rating_avg: number; rating_count: number; total_donations: number };

const EVENT_LABEL: Record<string, string> = {
  need_created: 'הבקשה פורסמה',
  offer_published: 'התרומה פורסמה',
  offer_claimed: 'התרומה נבחרה',
  committed: 'התקבלה התחייבות',
  transport_requested: 'נדרש שינוע',
  courier_assigned: 'נהג מתנדב לקח את המשלוח',
  picked_up: 'נאסף מהתורם',
  on_the_way: 'בדרך ליעד',
  delivered: 'נמסר',
  confirmed: 'אושרה קבלה',
  rated: 'דורג',
  cancelled: 'בוטל',
};

const ROLE_LABEL: Record<string, string> = { donor: 'תורם', courier: 'נהג מתנדב', recipient: 'מקבל' };

type NextAction = {
  status: AssignmentStatus;
  label: string;
  icon: string;
  hint: string;
  confirm?: { title: string; message: string };
};
const NEXT: Partial<Record<AssignmentStatus, NextAction>> = {
  committed: {
    status: 'picked_up', label: 'אספתי את המזון – יוצא לדרך', icon: 'cube',
    hint: 'לחצו כשאספתם את המזון ואתם בדרך למקבל.',
  },
  courier_assigned: {
    status: 'picked_up', label: 'כן, אני לוקח את המשלוח', icon: 'checkmark-circle',
    hint: 'אתם מתחייבים לאסוף מהתורם ולמסור ליחידה. את הכתובת המדויקת תקבלו בטלפון.',
    confirm: { title: 'לקחת את המשלוח?', message: 'אתם מאשרים שתאספו את המזון מהתורם ותמסרו אותו לכתובת המקבל?' },
  },
  picked_up: {
    status: 'on_the_way', label: 'יצאתי לדרך למסירה', icon: 'navigate',
    hint: 'לחצו כשאתם בדרך לכתובת המסירה.',
  },
  on_the_way: {
    status: 'delivered', label: 'מסרתי את המזון ליעד', icon: 'checkmark-done',
    hint: 'לחצו כשהמזון נמסר ליחידה.',
  },
  delivered: {
    status: 'confirmed', label: 'כן, קיבלנו את המזון', icon: 'shield-checkmark',
    hint: 'אישור קבלה על ידי המקבל.',
  },
};

export default function AssignmentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [a, setA] = useState<Assignment | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [donor, setDonor] = useState<Donor | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('assignments')
      .select('*, recipient:recipient_id(user_id), need:need_id(food_type,quantity,unit_label), offer:offer_id(food_type,quantity,unit_label,origin_city)')
      .eq('id', id)
      .maybeSingle();
    setA(data as Assignment);
    const { data: ev } = await supabase.from('events').select('id,type,created_at,payload').eq('assignment_id', id).order('created_at');
    setEvents((ev as Ev[]) ?? []);
    // פרטי התורם (view ציבורי — שם, תמונה, מוניטין, דירוג)
    const donorId = (data as Assignment | null)?.donor_id;
    if (donorId) {
      const { data: dp } = await supabase
        .from('profiles_public')
        .select('id,full_name,photo_url,reputation_level,rating_avg,rating_count,total_donations')
        .eq('id', donorId)
        .maybeSingle();
      setDonor((dp as Donor) ?? null);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const doReveal = async () => {
    const { data, error } = await revealPhone(id!);
    if (error) return appAlert('שגיאה', error.message);
    setContacts((data as Contact[]) ?? []);
  };

  const advance = async (status: AssignmentStatus) => {
    const { error } = await advanceAssignment(id!, status);
    if (error) return appAlert('שגיאה', error.message);
    await load();
  };

  // נהג מתנדב תופס משלוח פתוח — עם אימות לפני שינוי הסטטוס
  const takeDelivery = () => {
    appAlert('לקחת את המשלוח?', 'אתם מתחייבים לאסוף מהתורם ולמסור למבקש. את הכתובת המדויקת תתאמו בטלפון.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'כן, אני לוקח',
        onPress: async () => {
          const { error } = await claimDelivery(id!);
          if (error) return appAlert('שגיאה', error.message);
          await load();
        },
      },
    ]);
  };

  // נהג מבטל את המשלוח שלקח → חוזר ל"ממתין לשינוע" ונהג אחר יוכל לקחת
  const doRelease = () => {
    appAlert('ביטול המשלוח', 'המשלוח יחזור להמתנה לשינוע ונהג אחר יוכל לקחת אותו. להמשיך?', [
      { text: 'לא', style: 'cancel' },
      {
        text: 'כן, בטל',
        style: 'destructive',
        onPress: async () => {
          const { error } = await releaseDelivery(id!);
          if (error) return appAlert('שגיאה', error.message);
          await load();
        },
      },
    ]);
  };

  // אימות תמיד לפני שינוי סטטוס
  const onNext = (action: NextAction) => {
    appAlert(
      action.confirm?.title ?? 'לאשר את הפעולה?',
      action.confirm?.message ?? `${action.label} — האם אתם בטוחים?`,
      [
        { text: 'לא עכשיו', style: 'cancel' },
        { text: 'כן, בטוח', onPress: () => advance(action.status) },
      ],
    );
  };

  const rate = () => {
    if (!a) return;
    const rateeId = a.donor_id === profile?.id ? a.recipient?.user_id : a.donor_id;
    if (!rateeId) return;
    appAlert('דרג את הצד השני', 'כמה כוכבים?', [
      ...[5, 4, 3, 2, 1].map((s) => ({
        text: '⭐'.repeat(s),
        onPress: async () => {
          const { error } = await submitRating({ assignment_id: id!, ratee_id: rateeId, score: s });
          if (error) return appAlert('שגיאה', error.message);
          await load();
        },
      })),
      { text: 'ביטול', style: 'cancel' as const },
    ]);
  };

  if (!a) {
    return (
      <>
        <Header title="שיבוץ" onBack={() => safeBack()} />
        <View style={{ flex: 1, backgroundColor: colors.surface }} />
      </>
    );
  }

  const ui = statusUI(a.status);
  const it = a.need ?? a.offer;
  const next = NEXT[a.status];
  const canReveal = ['committed', 'courier_assigned', 'picked_up', 'on_the_way', 'delivered', 'confirmed', 'rated'].includes(a.status);
  const isDriver =
    profile?.roles?.includes('courier') ||
    profile?.roles?.includes('coordinator') ||
    profile?.roles?.includes('admin');
  const dLevel = donor?.reputation_level ? LEVEL_META[donor.reputation_level] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="פרטי שיבוץ" onBack={() => safeBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card accent={ui.color}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <StatusBadge color={ui.color} tint={ui.tint} icon={ui.icon} size={48} />
            <View style={{ flex: 1 }}>
              <Txt variant="h2" weight="bold">
                {it ? `${it.quantity} ${it.unit_label} · ${it.food_type}` : 'תרומה'}
              </Txt>
              <Txt variant="caption" color={ui.color} weight="bold">
                {ui.label} · אזור {regionLabel(a.general_destination)}
              </Txt>
            </View>
          </View>
        </Card>

        {/* כרטיס התורם (בסגנון גט — תמונה/ראשי-תיבות, שם, מוניטין, דירוג, נקודת איסוף) */}
        {donor ? (
          <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            {donor.photo_url ? (
              <Image source={{ uri: donor.photo_url }} style={{ width: 58, height: 58, borderRadius: 29 }} />
            ) : (
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                <Txt variant="h1" weight="extrabold" color={colors.brand700}>{donor.full_name?.trim()?.charAt(0) ?? '?'}</Txt>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Txt variant="caption" color={colors.textMuted}>התורם</Txt>
              <Txt variant="h2" weight="bold">{donor.full_name ?? 'תורם'}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                {dLevel ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.brand50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill }}>
                    <Ionicons name="shield-checkmark" size={11} color={colors.brand700} />
                    <Txt variant="caption" weight="bold" color={colors.brand700}>Level {dLevel.n} · {dLevel.label}</Txt>
                  </View>
                ) : null}
                {donor.rating_count > 0 ? (
                  <Txt variant="caption" weight="bold" color={colors.warning}>⭐ {donor.rating_avg} ({donor.rating_count})</Txt>
                ) : (
                  <Txt variant="caption" color={colors.textMuted}>תורם חדש</Txt>
                )}
              </View>
              {a.offer?.origin_city ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <Ionicons name="location" size={13} color={colors.secondary} />
                  <Txt variant="caption" color={colors.textMuted}>נקודת איסוף: {a.offer.origin_city}</Txt>
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        {/* Actions */}
        <View style={{ height: spacing.lg }} />
        {a.status === 'waiting_courier' ? (
          isDriver ? (
            <>
              <Button title="אני לוקח את המשלוח" icon="car" onPress={takeDelivery} />
              <Txt variant="caption" color={colors.textMuted} center style={{ marginTop: 6 }}>
                אתם מתחייבים לאסוף מהתורם ולמסור למבקש. את הכתובת המדויקת תתאמו בטלפון.
              </Txt>
            </>
          ) : (
            <Card style={{ backgroundColor: '#FBF0DA' }}>
              <Txt variant="small" weight="bold" color={colors.warning}>
                ממתין שנהג מתנדב ייקח את המשלוח
              </Txt>
            </Card>
          )
        ) : null}
        {next ? (
          <>
            <Button title={next.label} icon={next.icon as any} onPress={() => onNext(next)} />
            <Txt variant="caption" color={colors.textMuted} center style={{ marginTop: 6 }}>
              {next.hint}
            </Txt>
          </>
        ) : null}
        {/* נהג שלקח את המשלוח (לפני איסוף) יכול לבטל → המשלוח חוזר להמתנה לשינוע */}
        {a.status === 'courier_assigned' && a.courier_id === profile?.id ? (
          <Button title="בטל את המשלוח" variant="ghost" icon="close-circle" onPress={doRelease} style={{ marginTop: spacing.md }} />
        ) : null}
        {a.status === 'confirmed' ? <Button title="דרג את הצד השני" icon="star" onPress={rate} /> : null}

        {/* Reveal phone */}
        {canReveal ? (
          <>
            <View style={{ height: spacing.lg }} />
            {contacts.length === 0 ? (
              <Button title="הצג פרטי קשר" variant="secondary" icon="call" onPress={doReveal} />
            ) : (
              contacts.map((c, i) => (
                <Pressable key={i} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="call" size={20} color={colors.brand700} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt weight="bold">{c.name}</Txt>
                      <Txt variant="caption" color={colors.textMuted}>
                        {ROLE_LABEL[c.role] ?? c.role} · {c.phone}
                      </Txt>
                    </View>
                    <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
                  </Card>
                </Pressable>
              ))
            )}
            <Txt variant="caption" color={colors.textMuted} center style={{ marginTop: 4 }}>
              את נקודת המסירה המדויקת תאמו בטלפון
            </Txt>
          </>
        ) : null}

        {/* Timeline */}
        <Divider />
        <Txt variant="h2" weight="bold" style={{ marginBottom: spacing.md }}>
          ציר זמן
        </Txt>
        {events.map((e, idx) => (
          <View key={e.id} style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand700 }} />
              {idx < events.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: colors.border, minHeight: 24 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: spacing.md }}>
              <Txt variant="small" weight="medium">
                {e.type === 'transport_requested' && e.payload?.released ? 'המשלוח בוטל ע"י הנהג — חזר להמתנה לשינוע' : EVENT_LABEL[e.type] ?? e.type}
              </Txt>
              <Txt variant="caption" color={colors.textMuted}>
                {new Date(e.created_at).toLocaleString('he-IL')}
              </Txt>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
