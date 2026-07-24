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
