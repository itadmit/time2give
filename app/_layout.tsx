import React, { useEffect, useState } from 'react';
import { I18nManager, View, ActivityIndicator, Text, ScrollView } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_700Bold,
  Heebo_800ExtraBold,
} from '@expo-google-fonts/heebo';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { NotificationsProvider } from '../src/context/NotificationsContext';
import { LocationPrompt } from '../src/components/LocationPrompt';
import { RoleWizard } from '../src/components/RoleWizard';
import { useOTAUpdates } from '../src/lib/useOTAUpdates';
import { colors } from '../src/theme/tokens';

// RTL - קוראים רק אם עוד לא פעיל, כדי לא לייצר "שינוי RTL ממתין" בכל reload (שתוקע את הטעינה)
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

// נתפס ע"י expo-router: אם קומפוננטה קורסת בזמן render, מציגים את השגיאה במקום מסך תקוע
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.brand900, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: colors.white, fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>
        קרתה שגיאה באפליקציה
      </Text>
      <ScrollView style={{ maxHeight: 320 }}>
        <Text style={{ color: '#FFD2D2', fontSize: 14 }}>{error?.message}</Text>
        {error?.stack ? (
          <Text style={{ color: colors.brand100, fontSize: 11, marginTop: 12 }}>{error.stack}</Text>
        ) : null}
      </ScrollView>
      <Text onPress={() => retry()} style={{ color: colors.white, marginTop: 20, fontWeight: 'bold' }}>
        ↻ נסה שוב
      </Text>
    </View>
  );
}

function AuthGate() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const seg = segments as string[];
    const inAuth = seg[0] === '(auth)';
    // מסך ה-root (index) - seg ריק. משם צריך לנתב מחובר+מאושר ל-feed
    const atRoot = seg.length === 0;
    const onboarded = !!profile?.onboarded;

    if (!session) {
      // אורח: פתיחה ישירות לגלישה חופשית, בלי לכפות התחברות.
      // התחברות נדרשת רק בעת פעולה (בקשה/אישור/פרסום) — המסכים מפנים ל-phone לפי הצורך.
      if (atRoot) router.replace('/(tabs)/feed');
    } else if (!onboarded) {
      if (seg[1] !== 'onboarding') router.replace('/(auth)/onboarding');
    } else if (inAuth || atRoot) {
      router.replace('/(tabs)/feed');
    }
  }, [session, profile, loading, segments, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="need/new" />
        <Stack.Screen name="offer/new" />
        <Stack.Screen name="assignment/[id]" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="admin" />
      </Stack>
      <LocationPrompt enabled={!loading && !!session && !!profile?.onboarded} />
      <RoleWizard enabled={!loading && !session} />
    </>
  );
}

export default function RootLayout() {
  // OTA — תבנית QuickCRM: בודק, מוריד, ומציג Alert; reloadAsync רק בלחיצת משתמש
  useOTAUpdates();

  const [fontsLoaded, fontError] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_700Bold,
    Heebo_800ExtraBold,
  });

  // אם הגופנים לא נטענו תוך 3 שניות (או נכשלו) - ממשיכים בכל זאת, לא נחסום את האפליקציה
  const [fontsTimedOut, setFontsTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontsTimedOut(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const ready = fontsLoaded || !!fontError || fontsTimedOut;

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand700 }}>
        <ActivityIndicator color={colors.white} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* direction:'rtl' מבטיח פריסת ימין-לשמאל מיידית, גם אם forceRTL עוד לא נכנס לתוקף (dev) */}
      <View style={{ flex: 1, direction: 'rtl' }}>
        <AuthProvider>
          <NotificationsProvider>
            <AuthGate />
          </NotificationsProvider>
        </AuthProvider>
      </View>
    </SafeAreaProvider>
  );
}
