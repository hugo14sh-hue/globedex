// Ren logik för platsstatus, utan databas. Testas i statusLogic.test.ts.

export type PlaceStatus = 'bor' | 'bott' | 'besokt' | 'planerad' | 'vill' | 'mellan';

/** Ordningen i listan och i väljaren. Det är också rangordningen när gruppens kartor slås ihop. */
export const STATUSES: PlaceStatus[] = ['bor', 'bott', 'besokt', 'planerad', 'vill', 'mellan'];

/** Textnyckel för varje status i content/_texter.json. */
export const STATUS_KEY: Record<PlaceStatus | 'ej', string> = {
  bor: 'karta.status.bor',
  bott: 'karta.status.har-bott',
  besokt: 'karta.status.besokt',
  planerad: 'karta.status.planerad',
  vill: 'karta.status.vill-aka',
  mellan: 'karta.status.mellanlandat',
  ej: 'karta.status.ej-satt',
};

/** Statusar som räknas som besökt. Mellanlandat räknas inte. */
export const VISITED: PlaceStatus[] = ['bor', 'bott', 'besokt'];

export const isStatus = (v: unknown): v is PlaceStatus => STATUSES.includes(v as PlaceStatus);

/** Grupperar platser efter status i listans ordning. Tomma grupper tas bort. */
export function groupByStatus<T extends { status: PlaceStatus }>(rows: T[]): { status: PlaceStatus; rows: T[] }[] {
  return STATUSES.map((status) => ({ status, rows: rows.filter((r) => r.status === status) })).filter((g) => g.rows.length);
}

/** Den högsta av två statusar (bor före har bott före besökt och så vidare). */
export function higher(a: PlaceStatus | undefined, b: PlaceStatus | undefined): PlaceStatus | undefined {
  if (!a) return b;
  if (!b) return a;
  return STATUSES.indexOf(a) <= STATUSES.indexOf(b) ? a : b;
}

export type StatusMap = Record<string, PlaceStatus>;

/** Vår karta: varje plats får den högsta status som någon i gruppen har satt. */
export function mergeStatuses(maps: StatusMap[]): StatusMap {
  const out: StatusMap = {};
  for (const m of maps) {
    for (const [id, s] of Object.entries(m)) {
      if (!isStatus(s)) continue;
      const h = higher(out[id], s);
      if (h) out[id] = h;
    }
  }
  return out;
}

/** Vilken karta som visas: min, vår eller en enskild medlems (user_id). */
export type MapWho = 'min' | 'var' | string;

/** Statusarna för vald karta. Okänd medlem ger en tom karta. */
export function statusesFor(who: MapWho, mine: StatusMap, others: Record<string, StatusMap>): StatusMap {
  if (who === 'min') return mine;
  if (who === 'var') return mergeStatuses([mine, ...Object.values(others)]);
  return others[who] ?? {};
}

/** Landets id för en plats-id ('SE-vastergotland' ger 'SE'). */
export const countryIdFor = (placeId: string) => placeId.slice(0, 2);

/**
 * Ska landet bli planerat när en resa skapas? Bara om status saknas eller är vill åka,
 * så att besökt, bor och liknande aldrig skrivs över. Gäller planeraren och Gör om till resa i Idag.
 */
export const shouldMarkPlanned = (current: PlaceStatus | undefined) => !current || current === 'vill';
