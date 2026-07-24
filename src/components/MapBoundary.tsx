import React from 'react';

/**
 * ErrorBoundary - react-native-maps דורש מודול נייטיב (dev build).
 * ב-Expo Go המודול חסר וה-render נכשל → מציגים fallback במקום קריסה.
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
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
