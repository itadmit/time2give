import React, { useEffect, useRef } from 'react';
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

export function OffersMap({ offers, onSelect }: { offers: MapOffer[]; onSelect?: (id: string) => void }) {
  const mapRef = useRef<MapView>(null);
  const withCoords = offers.filter((o) => o.origin_lat != null && o.origin_lng != null);

  // בעלייה - אם כבר יש הרשאת מיקום (אושרה במודל הכניסה), ממרכזים את המפה קרוב למשתמש.
  // לא מבקשים כאן הרשאה כדי לא לפתוח דיאלוג פעמיים - הבקשה מטופלת ב-LocationPrompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        mapRef.current?.animateToRegion(
          { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 },
          700,
        );
      } catch {
        // נשארים על אזור הפתיחה
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MapView
      ref={mapRef}
      style={{ height: 220, borderRadius: radius.lg }}
      initialRegion={INITIAL}
      showsUserLocation
      showsMyLocationButton
    >
      {withCoords.map((o) => (
        <Marker
          key={o.id}
          coordinate={{ latitude: o.origin_lat as number, longitude: o.origin_lng as number }}
          title={`${o.quantity} ${o.unit_label}`}
          description={o.food_type}
          onCalloutPress={() => onSelect?.(o.id)}
        />
      ))}
    </MapView>
  );
}
