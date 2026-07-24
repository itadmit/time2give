/**
 * 14 האזורים - enum מבוקר, מפתח ההתאמה (אפיון §7.3).
 * ערכי ה-DB תואמים ל-enum `region` ב-Postgres (ARCHITECTURE §4).
 */

export type Region =
  | 'otef'
  | 'beer_sheva_negev_north'
  | 'negev_south'
  | 'arava_dead_sea'
  | 'carmel_haifa'
  | 'galil_west'
  | 'galil_upper'
  | 'golan'
  | 'sharon'
  | 'gush_dan'
  | 'jerusalem_hills'
  | 'judea_samaria'
  | 'jordan_valley';

export const REGION_LABELS: Record<Region, string> = {
  otef: 'עוטף',
  beer_sheva_negev_north: 'באר שבע ונגב צפוני',
  negev_south: 'נגב דרומי',
  arava_dead_sea: 'הערבה וים המלח',
  carmel_haifa: 'כרמל וחיפה',
  galil_west: 'גליל מערבי',
  galil_upper: 'גליל עליון',
  golan: 'רמת הגולן',
  sharon: 'השרון',
  gush_dan: 'גוש דן',
  jerusalem_hills: 'ירושלים והרי יהודה',
  judea_samaria: 'יהודה ושומרון',
  jordan_valley: 'בקעת הירדן',
};

export type RegionGroup = {
  title: string;
  regions: Region[];
};

/** מקובץ ל-UI (בורר אזורים) */
export const REGION_GROUPS: RegionGroup[] = [
  { title: 'דרום', regions: ['otef', 'beer_sheva_negev_north', 'negev_south', 'arava_dead_sea'] },
  { title: 'צפון', regions: ['carmel_haifa', 'galil_west', 'galil_upper', 'golan'] },
  { title: 'מרכז', regions: ['sharon', 'gush_dan'] },
  { title: 'ירושלים', regions: ['jerusalem_hills'] },
  { title: 'יו"ש ובקעה', regions: ['judea_samaria', 'jordan_valley'] },
];

export const ALL_REGIONS: Region[] = REGION_GROUPS.flatMap((g) => g.regions);

export const regionLabel = (r: Region): string => REGION_LABELS[r] ?? r;

/**
 * מרכז מקורב לכל אזור (רזולוציית אזור בלבד — תואם פרטיות: אין נקודה מדויקת).
 * משמש להצגת "בקשות לתרומה" על המפה (לבקשות אין קואורדינטות, רק אזור).
 */
export const REGION_CENTERS: Record<Region, { lat: number; lng: number }> = {
  otef: { lat: 31.45, lng: 34.55 },
  beer_sheva_negev_north: { lat: 31.25, lng: 34.79 },
  negev_south: { lat: 30.6, lng: 34.8 },
  arava_dead_sea: { lat: 30.9, lng: 35.2 },
  carmel_haifa: { lat: 32.79, lng: 34.99 },
  galil_west: { lat: 32.95, lng: 35.15 },
  galil_upper: { lat: 33.05, lng: 35.45 },
  golan: { lat: 32.95, lng: 35.7 },
  sharon: { lat: 32.3, lng: 34.87 },
  gush_dan: { lat: 32.08, lng: 34.8 },
  jerusalem_hills: { lat: 31.78, lng: 35.13 },
  judea_samaria: { lat: 32.1, lng: 35.3 },
  jordan_valley: { lat: 32.0, lng: 35.45 },
};
