import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, ScrollView } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { colors } from '../src/theme/tokens';

/** מסך התחלה - AuthGate (ב-_layout) מנתב אוטומטית לפי מצב ההתחברות.
 *  אם משהו נתקע יותר מ-3 שניות, מציגים אבחון על המסך כדי לדעת מה קרה. */
export default function Index() {
  const { loading, session, profile, initError } = useAuth();
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowDiag(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand700, padding: 24 }}>
      <ActivityIndicator color={colors.white} size="large" />
      {showDiag ? (
        <ScrollView style={{ maxHeight: 260, marginTop: 20 }} contentContainerStyle={{ alignItems: 'center' }}>
          <Text style={{ color: colors.white, fontWeight: 'bold', marginBottom: 8 }}>אבחון טעינה</Text>
          <Text style={{ color: colors.brand100 }}>loading: {String(loading)}</Text>
          <Text style={{ color: colors.brand100 }}>session: {session ? 'קיים' : 'אין'}</Text>
          <Text style={{ color: colors.brand100 }}>profile: {profile ? 'קיים' : 'אין'}</Text>
          <Text style={{ color: colors.brand100 }}>onboarded: {String(!!profile?.onboarded)}</Text>
          {initError ? (
            <Text style={{ color: '#FFD2D2', marginTop: 10, textAlign: 'center' }}>שגיאה: {initError}</Text>
          ) : null}
        </ScrollView>
      ) : null}
    </View>
  );
}
