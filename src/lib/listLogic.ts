// Ren logik för Listor (samlingsbok, bucketlist, swipe och samlingar), utan databas. Testas i listLogic.test.ts.
import type { BucketCatalogItem, CompendiumItem, CostLevel } from './content';

// ---------- Samlingsbok ----------

export interface CategoryCount {
  category: string;
  found: number;
  total: number;
}

/** Antal hittade per kategori, i den ordning kategorierna först förekommer. */
export function countByCategory(items: Pick<CompendiumItem, 'id' | 'category'>[], found: (id: string) => boolean): CategoryCount[] {
  const out = new Map<string, CategoryCount>();
  for (const i of items) {
    const c = out.get(i.category) ?? { category: i.category, found: 0, total: 0 };
    c.total++;
    if (found(i.id)) c.found++;
    out.set(i.category, c);
  }
  return [...out.values()];
}

/** Procent som heltal mellan 0 och 100, och minst en synlig strimma när något finns. */
export function percent(part: number, whole: number): number {
  if (whole <= 0 || part <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((part / whole) * 100)));
}

// ---------- Bucketlist ----------

export interface BucketItem {
  id: string;
  group_id: string;
  catalog_id: string | null;
  title: string;
  category: string | null;
  done_on: string | null;
  note: string | null;
  place_id?: string | null;
  created_by: string | null;
  created_at: string;
}

/** Filtrerar katalogen på kategori och kostnad. null betyder alla. */
export function filterCatalog(list: BucketCatalogItem[], category: string | null, cost: CostLevel | null): BucketCatalogItem[] {
  return list.filter((b) => (!category || b.category === category) && (!cost || b.cost_level === cost));
}

/** Ligger katalogpunkten redan på gruppens lista? */
export const onList = (items: Pick<BucketItem, 'catalog_id'>[], catalogId: string) => items.some((i) => i.catalog_id === catalogId);

/** Ogjorda först (äldst först), sedan gjorda (senast gjorda först). */
export function sortBucket<T extends Pick<BucketItem, 'done_on' | 'created_at'>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!a.done_on !== !b.done_on) return a.done_on ? 1 : -1;
    if (a.done_on && b.done_on) return b.done_on.localeCompare(a.done_on);
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Platser som en bucketpunkt hör till: egen plats först, sedan katalogens. Utan dubbletter. */
export function bucketPlaces(item: Pick<BucketItem, 'place_id'>, catalog: Pick<BucketCatalogItem, 'place_ids'> | undefined): string[] {
  return [...new Set([item.place_id, ...(catalog?.place_ids ?? [])].filter((x): x is string => Boolean(x)))];
}

// ---------- Swipe ----------

export type CardKind = 'item' | 'bucket' | 'idea';
export interface CardRef {
  kind: CardKind;
  id: string;
}

/** Röster per användare: id -> ja (true) eller nej (false). */
export type Votes = Record<string, Record<string, boolean>>;

/**
 * Kortbunten: kort från listpunkter, bucketkatalogen och idéer som användaren inte har röstat på.
 * Källorna blandas varannan, så att bunten inte börjar med hundra listpunkter i rad.
 */
export function buildDeck(sources: CardRef[][], voted: Record<string, boolean>): CardRef[] {
  const left = sources.map((s) => s.filter((c) => !(c.id in voted)));
  const out: CardRef[] = [];
  for (let i = 0; left.some((s) => i < s.length); i++) for (const s of left) if (i < s.length) out.push(s[i]);
  return out;
}

/** Sant när alla i gruppen har sagt ja. En ensam medlem matchar med sig själv (solo). */
export function isMatch(id: string, votes: Votes, memberIds: string[]): boolean {
  return memberIds.length > 0 && memberIds.every((m) => votes[m]?.[id] === true);
}

/** Alla id som hela gruppen har sagt ja till. */
export function commonYes(votes: Votes, memberIds: string[]): string[] {
  const first = memberIds[0];
  if (!first) return [];
  return Object.keys(votes[first] ?? {}).filter((id) => isMatch(id, votes, memberIds));
}

/**
 * Vilka medlemmar en punkt väntar på: jag har sagt ja, ingen har sagt nej och någon har inte röstat.
 * Tom lista betyder att punkten inte väntar (match, eller att någon sagt nej, eller att jag inte sagt ja).
 */
export function waitingFor(id: string, votes: Votes, memberIds: string[], me: string): string[] {
  if (votes[me]?.[id] !== true) return [];
  if (memberIds.some((m) => votes[m]?.[id] === false)) return [];
  return memberIds.filter((m) => votes[m]?.[id] === undefined);
}

// ---------- Samlingar ----------

export interface Motif {
  gift: string;
  text: string;
}

const norm = (s: string) => s.trim().toLocaleLowerCase('sv');

/**
 * Motivförslag ur gift_tips.collection_motifs för användarens samlingar.
 * Samlingens namn matchas mot nyckeln utan hänsyn till stora och små bokstäver.
 */
export function motifsFor(
  gifts: { name: string; collection_motifs: Record<string, string> }[],
  collection: string,
): Motif[] {
  const n = norm(collection);
  const out: Motif[] = [];
  for (const g of gifts)
    for (const [k, v] of Object.entries(g.collection_motifs ?? {})) if (norm(k) === n && v) out.push({ gift: g.name, text: v });
  return out;
}
