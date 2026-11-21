// På egen hand eller tillsammans (Körning 14). Ren logik utan databas, testas i togetherLogic.test.ts.
//
// place_status.together_group är tomt när platsen besöktes på egen hand och gruppens id när den
// besöktes tillsammans med gruppen. Var och en skriver bara sina egna rader. Har minst en medlem en
// besökt rad med gruppens id räknas platsen som besökt tillsammans för hela gruppen.
import { higher, isStatus, mergeStatuses, VISITED, type PlaceStatus, type StatusMap } from './statusLogic';

/** Statusar där man väljer sällskap. För vill åka och planerad är together_group alltid tomt. */
export const TOGETHER_STATUSES: PlaceStatus[] = ['besokt', 'bor', 'bott', 'mellan'];

export const allowsTogether = (s: PlaceStatus | null | undefined): boolean => Boolean(s && TOGETHER_STATUSES.includes(s));

/**
 * Värdet som sparas i together_group för en status. Vill åka, planerad och ingen status ger tomt.
 * group undefined betyder att det tidigare valet (current) ligger kvar.
 */
export function togetherFor(status: PlaceStatus | null, group: string | null | undefined, current: string | null = null): string | null {
  if (!allowsTogether(status)) return null;
  return group === undefined ? current : group;
}

/** En rad i place_status, som appen läser den. */
export interface StatusRow {
  user_id: string;
  place_id: string;
  status: PlaceStatus;
  together_group: string | null;
  updated_at?: string | null;
}

/** Gör om rader från databasen. Okända statusar hoppas över. */
export function toRows(data: { user_id: string; place_id: string; status: string; together_group?: string | null; updated_at?: string | null }[]): StatusRow[] {
  const out: StatusRow[] = [];
  for (const r of data)
    if (isStatus(r.status))
      out.push({ user_id: r.user_id, place_id: r.place_id, status: r.status, together_group: r.together_group ?? null, updated_at: r.updated_at ?? null });
  return out;
}

const isVisited = (s: PlaceStatus) => VISITED.includes(s);

/**
 * Platser som gruppen har besökt tillsammans: minst en medlem har en besökt rad (bor, har bott, besökt)
 * med together_group lika med gruppens id. En medlem räcker. Mellanlandat räknas inte som besökt.
 * memberIds begränsar till gruppens nuvarande medlemmar.
 */
export function togetherPlaces(rows: StatusRow[], groupId: string, memberIds?: string[]): Set<string> {
  const members = memberIds ? new Set(memberIds) : null;
  const out = new Set<string>();
  if (!groupId) return out;
  for (const r of rows) if (r.together_group === groupId && isVisited(r.status) && (!members || members.has(r.user_id))) out.add(r.place_id);
  return out;
}

// ---------- Kartan ----------

/** Färgerna för besökta platser på Vår karta, i ordningen a till d. */
export type OurKey = 'tillsammans' | 'bada' | 'bara-jag' | 'bara-annan';
export const OUR_KEYS: OurKey[] = ['tillsammans', 'bada', 'bara-jag', 'bara-annan'];

/** Det som bestämmer en plats färg: en status, eller en av färgerna för besökt i sällskap. */
export type MapKey = PlaceStatus | OurKey;

export interface OurPlace {
  key: OurKey;
  /** Medlemmar (utom den som tittar) som har besökt platsen, för namnen i platsens ruta. */
  others: string[];
}

/**
 * Vår karta: besökta platser i fyra färger, och när flera stämmer gäller den första:
 * a. tillsammans: minst en medlem har markerat tillsammans med gruppen
 * b. bada: alla medlemmar har besökt platsen (gruppen har minst två medlemmar)
 * c. bara-jag: bara den som tittar har besökt platsen
 * d. bara-annan: någon annan har besökt platsen (i en grupp med fler än två: en gemensam färg)
 */
export function ourVisited(rows: StatusRow[], me: string, memberIds: string[], groupId: string): Record<string, OurPlace> {
  const members = new Set(memberIds.length ? memberIds : [me]);
  const together = togetherPlaces(rows, groupId, [...members]);
  const visitors: Record<string, Set<string>> = {};
  for (const r of rows) if (members.has(r.user_id) && isVisited(r.status)) (visitors[r.place_id] ??= new Set()).add(r.user_id);
  const out: Record<string, OurPlace> = {};
  for (const [place, who] of Object.entries(visitors)) {
    const others = [...who].filter((u) => u !== me).sort();
    let key: OurKey;
    if (together.has(place)) key = 'tillsammans';
    else if (members.size > 1 && [...members].every((u) => who.has(u))) key = 'bada';
    else if (who.has(me) && !others.length) key = 'bara-jag';
    else key = 'bara-annan';
    out[place] = { key, others };
  }
  return out;
}

/**
 * Färgnyckeln per plats på Vår karta. Besökta platser får en av de fyra färgerna. Övriga platser
 * (vill åka, planerad, mellanlandat) får som förut den högsta status någon i gruppen har satt.
 */
export function ourMap(rows: StatusRow[], me: string, memberIds: string[], groupId: string): Record<string, MapKey> {
  const members = new Set(memberIds.length ? memberIds : [me]);
  const byUser: Record<string, StatusMap> = {};
  for (const r of rows) if (members.has(r.user_id)) (byUser[r.user_id] ??= {})[r.place_id] = r.status;
  const out: Record<string, MapKey> = { ...mergeStatuses(Object.values(byUser)) };
  for (const [place, p] of Object.entries(ourVisited(rows, me, memberIds, groupId))) out[place] = p.key;
  return out;
}

/**
 * Min karta. Bara de egna raderna. Med sällskap (användaren är med i en par- eller gruppgrupp) får
 * besökta platser med together_group färgen tillsammans, och besökt på egen hand behåller färgen för besökt.
 * Utan sällskap ser kartan ut som förut.
 */
export function myMap(statuses: StatusMap, together: Record<string, string | null>, withCompany: boolean): Record<string, MapKey> {
  const out: Record<string, MapKey> = {};
  for (const [place, s] of Object.entries(statuses)) out[place] = withCompany && isVisited(s) && together[place] ? 'tillsammans' : s;
  return out;
}

// ---------- Siffrorna på fliken Vi ----------

/** Läget för siffrorna: tillsammans, någon av oss, jag eller en annan medlems user_id. */
export type ViView = 'tillsammans' | 'nagon' | 'jag' | string;

export type ViStatus = { place_id: string; status: PlaceStatus; updated_at: string | null };

const earliest = (a: string | null | undefined, b: string | null | undefined) => (!a ? (b ?? null) : !b ? a : a < b ? a : b);

/** Är läget en persons (jag eller en annan medlem)? Tillsammans och Någon av oss är gruppens. */
export const isPersonView = (view: ViView): boolean => view !== 'tillsammans' && view !== 'nagon';

/**
 * En persons platser (Körning 22): personens egna rader, plus andra medlemmars rader där together_group
 * är gruppens id och statusen kan vara tillsammans (TOGETHER_STATUSES). En sådan rad räknas för personen
 * med samma status. Har personen flera rader för samma plats gäller den högsta statusen. Vill åka och
 * planerad följer aldrig med från någon annan. memberIds begränsar till gruppens nuvarande medlemmar.
 */
export function personStatuses(person: string, rows: StatusRow[], memberIds: string[], groupId: string): ViStatus[] {
  const members = new Set(memberIds);
  members.add(person);
  const out: Record<string, ViStatus> = {};
  for (const r of rows) {
    if (!members.has(r.user_id)) continue;
    const mine = r.user_id === person;
    if (!mine && !(groupId && r.together_group === groupId && allowsTogether(r.status))) continue;
    const cur = out[r.place_id];
    const status = higher(cur?.status, r.status)!;
    const updated_at =
      !cur || cur.status !== status ? (r.updated_at ?? null) : r.status === status ? earliest(cur.updated_at, r.updated_at) : cur.updated_at;
    out[r.place_id] = { place_id: r.place_id, status, updated_at };
  }
  return Object.values(out);
}

/**
 * Raderna som länder, kontinenter, landskap och delstater räknas från i valt läge.
 * - tillsammans: bara platser besökta tillsammans med gruppen (en medlem räcker)
 * - nagon: allt som minst en medlem har markerat, tillsammans eller var för sig (högsta status per plats)
 * - jag: mina platser (personStatuses)
 * - en medlems user_id: den personens platser (personStatuses)
 */
export function viewStatuses(view: ViView, rows: StatusRow[], me: string, memberIds: string[], groupId: string): ViStatus[] {
  const members = new Set(memberIds.length ? memberIds : [me]);
  members.add(me);
  if (view === 'jag') return personStatuses(me, rows, [...members], groupId);
  if (view === 'tillsammans') {
    const places = togetherPlaces(rows, groupId, [...members]);
    const out: Record<string, ViStatus> = {};
    for (const r of rows)
      if (places.has(r.place_id) && r.together_group === groupId && isVisited(r.status) && members.has(r.user_id))
        out[r.place_id] = { place_id: r.place_id, status: 'besokt', updated_at: earliest(out[r.place_id]?.updated_at, r.updated_at) };
    return Object.values(out);
  }
  if (view === 'nagon') {
    const out: Record<string, ViStatus> = {};
    for (const r of rows) {
      if (!members.has(r.user_id)) continue;
      const cur = out[r.place_id];
      const status = higher(cur?.status, r.status)!;
      out[r.place_id] = { place_id: r.place_id, status, updated_at: earliest(cur?.updated_at, r.updated_at) };
    }
    return Object.values(out);
  }
  return members.has(view) ? personStatuses(view, rows, [...members], groupId) : [];
}

// ---------- Resor ----------

/** Filtret i listan över resor: alla, soloresor eller en par- eller gruppgrupps id. */
export type TripFilter = 'alla' | 'solo' | string;

interface GroupLike {
  id: string;
  kind: 'solo' | 'par' | 'grupp';
}

/** Par- och gruppgrupper (inte sologrupper), i den ordning de kom. */
export const companyGroups = <G extends GroupLike>(groups: G[]): G[] => groups.filter((g) => g.kind !== 'solo');

/** Visas filtret? När användaren har resor i mer än en grupp eller är med i en par- eller gruppgrupp. */
export function showTripFilter(trips: { group_id: string }[], groups: GroupLike[]): boolean {
  return new Set(trips.map((t) => t.group_id)).size > 1 || companyGroups(groups).length > 0;
}

/** Är resan en soloresa (gruppen är en sologrupp)? */
export const isSoloTrip = (trip: { group_id: string }, groups: GroupLike[]) => groups.find((g) => g.id === trip.group_id)?.kind === 'solo';

/** Resorna som filtret släpper igenom. Ett okänt filter (till exempel en grupp man har lämnat) visar alla. */
export function filterTrips<T extends { group_id: string }>(trips: T[], filter: TripFilter, groups: GroupLike[]): T[] {
  if (filter === 'alla') return trips;
  if (filter === 'solo') return trips.filter((t) => isSoloTrip(t, groups));
  if (!groups.some((g) => g.id === filter)) return trips;
  return trips.filter((t) => t.group_id === filter);
}

/**
 * Förvalet för Vem reser? när en resa skapas: den grupp som är vald i appen, om den finns bland valen,
 * annars användarens sologrupp.
 */
export function defaultTripGroup(activeGroupId: string | null, soloGroupId: string | null, options: string[]): string | null {
  if (activeGroupId && options.includes(activeGroupId)) return activeGroupId;
  return soloGroupId ?? options[0] ?? null;
}
