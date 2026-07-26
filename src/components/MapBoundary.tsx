import React from 'react';
import { MAPS_AVAILABLE } from '../lib/maps';

/**
 * ErrorBoundary + שער זמינות למפה.
 * - react-native-maps דורש מודול נייטיב (dev/prod build); ב-Expo Go הוא חסר.
 * - באנדרואיד ללא מפתח Google Maps ה-MapView הנייטיב קורס (קריסה נייטיב שלא
 *   נתפסת ב-ErrorBoundary) → אם MAPS_AVAILABLE=false מציגים fallback מיד.
 */
export class MapBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    /* נבלע - ה-fallback כבר מוצג */
  }
  render() {
    if (!MAPS_AVAILABLE) return this.props.fallback;
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
