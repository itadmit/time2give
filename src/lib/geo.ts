/** מרחק אווירי (haversine) בקילומטרים בין שתי נקודות. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** מרחק לתצוגה: פחות מ-1 ק״מ → מטרים, אחרת ק״מ. null → '—'. */
export function formatKm(km: number | null): string {
  if (km == null) return '—';
  if (km < 1) return `${Math.round(km * 1000)} מ׳`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} ק״מ`;
}
