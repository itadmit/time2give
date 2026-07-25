import React, { useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { radius } from '../theme/tokens';

export type MapOffer = {
  id: string;
  food_type: string;
  quantity: number;
  unit_label: string;
  origin_lat: number | null;
  origin_lng: number | null;
};

// מרכז ישראל - נקודת פתיחה עד שמאתרים את המיקום של המשתמש
const INITIAL = { latitude: 31.5, longitude: 34.9, latitudeDelta: 3.2, longitudeDelta: 2.2 };

// דלתא הזום כשממרכזים על המשתמש. 'card' = מסך "תרומות זמינות" ברמת זום ~12 (360/2^12≈0.088,
// לא קרוב מדי ולא רחוק). 'fullscreen' = רקע מסך הבית (רחוק יותר).
const USER_DELTA = { card: 0.088, fullscreen: 0.28 } as const;

type Props = {
  offers: MapOffer[];
  onSelect?: (id: string) => void;
  /** 'card' = מפה קטנה בכרטיס (ברירת מחדל). 'fullscreen' = ממלאת את ההורה, זום קצת רחוק, ללא כפתורים */
  variant?: 'card' | 'fullscreen';
  /** 'standard' = צבעוני (ברירת מחדל). 'mutedStandard' = מעומעם/שחור-לבן (Apple Maps) */
  mapType?: 'standard' | 'mutedStandard';
  /** false = מפת רקע לא-אינטראקטיבית (ללא גלילה/זום, מעבירה מגע להורה) */
  interactive?: boolean;
  /** צבע הסמנים (למשל צבע השכבה) */
  pinColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function OffersMap({ offers, onSelect, variant = 'card', mapType = 'standard', interactive = true, pinColor, style }: Props) {
  const mapRef = useRef<MapView>(null);
  const withCoords = offers.filter((o) => o.origin_lat != null && o.origin_lng != null);
  const isFull = variant === 'fullscreen';

  // בעלייה - אם כבר יש הרשאת מיקום (אושרה במודל הכניסה), ממרכזים את המפה על המשתמש.
  // לא מבקשים כאן הרשאה כדי לא לפתוח דיאלוג פעמיים - הבקשה מטופלת ב-LocationPrompt.
  useEffect(() => {
    let cancelled = false;
    const delta = USER_DELTA[variant];
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        mapRef.current?.animateToRegion(
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: delta, longitudeDelta: delta },
          700,
        );
      } catch {
        // נשארים על אזור הפתיחה
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant]);

  return (
    <MapView
      ref={mapRef}
      style={[isFull ? StyleSheet.absoluteFill : styles.card, style]}
      initialRegion={INITIAL}
      mapType={mapType}
      showsUserLocation
      showsMyLocationButton={interactive}
      toolbarEnabled={interactive}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={interactive}
      pitchEnabled={interactive}
      pointerEvents={interactive ? 'auto' : 'none'}
    >
      {withCoords.map((o) => (
        <Marker
          key={o.id}
          coordinate={{ latitude: o.origin_lat as number, longitude: o.origin_lng as number }}
          title={`${o.quantity} ${o.unit_label}`}
          description={o.food_type}
          pinColor={pinColor}
          onPress={() => onSelect?.(o.id)}
          onCalloutPress={() => onSelect?.(o.id)}
        />
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  card: { height: 220, borderRadius: radius.lg },
});
