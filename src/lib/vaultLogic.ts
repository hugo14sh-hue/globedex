// Ren logik för Valvet: posttyper och fält, ålder, passets giltighet, packförslag ur hälsa och
// regler för en viss ålder. Allt räknas ut i webbläsaren och bara när Valvet är upplåst.
// Ingenting här skickas till Supabase, sparas i localStorage eller loggas. Testas i vaultLogic.test.ts.

export const VAULT_KINDS = ['pass', 'forsakring', 'nodkontakt', 'halsa', 'fodelsedatum', 'annat'] as const;
export type VaultKind = (typeof VAULT_KINDS)[number];

export const isVaultKind = (k: string): k is VaultKind => (VAULT_KINDS as readonly string[]).includes(k);

export type FieldType = 'text' | 'date' | 'tel' | 'area';

/** Fälten per typ. Rubrikerna finns i valv.falt.<id>. */
export const VAULT_FIELDS: Record<VaultKind, { id: string; type: FieldType }[]> = {
  pass: [
    { id: 'passnummer', type: 'text' },
    { id: 'giltigt-till', type: 'date' },
  ],
  forsakring: [
    { id: 'bolag', type: 'text' },
    { id: 'forsakringsnummer', type: 'text' },
    { id: 'larmnummer', type: 'tel' },
  ],
  nodkontakt: [
    { id: 'namn', type: 'text' },
    { id: 'telefon', type: 'tel' },
    { id: 'relation', type: 'text' },
  ],
  halsa: [
    { id: 'allergier', type: 'area' },
    { id: 'mediciner', type: 'area' },
    { id: 'ovrigt', type: 'area' },
  ],
  fodelsedatum: [{ id: 'fodelsedatum', type: 'date' }],
  annat: [
    { id: 'rubrik', type: 'text' },
    { id: 'text', type: 'area' },
  ],
};

/** Det som ligger krypterat i en post. */
export interface VaultContent {
  /** Fältens värden, nyckel = fältets id. */
  f: Record<string, string>;
  /** Hälsa: visa medicinerna som förslag i packlistan (bara för mig, bara när Valvet är upplåst). */
  pack?: boolean;
  /** Hälsa: avbockade rader per resa (resans id -> radernas text). */
  packed?: Record<string, string[]>;
}

export interface VaultEntry {
  id: string;
  kind: VaultKind;
  content: VaultContent;
  updated_at: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Ålder i hela år på ett visst datum (ÅÅÅÅ-MM-DD). null om födelsedatumet saknas eller är fel. */
export function ageOn(birth: string | null | undefined, date: string): number | null {
  if (!birth || !ISO.test(birth) || !ISO.test(date) || birth > date) return null;
  const [by, bm, bd] = birth.split('-').map(Number);
  const [y, m, d] = date.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** Födelsedatumet ur Valvet, om det finns. */
export const birthDate = (entries: VaultEntry[]) => entries.find((e) => e.kind === 'fodelsedatum')?.content.f.fodelsedatum || null;

function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/** Varna så här många månader innan passet går ut, och så här länge efter en resas sista dag. */
export const PASS_WARN_MONTHS = 6;

/**
 * Passets sista giltighetsdag om passet bör förnyas: det går ut inom sex månader, eller inom sex
 * månader efter en kommande resas sista dag (många länder kräver att passet gäller en tid efter hemresan).
 */
export function passExpiryWarning(entries: VaultEntry[], today: string, tripEnds: (string | null)[] = []): string | null {
  const dates = entries
    .filter((e) => e.kind === 'pass')
    .map((e) => e.content.f['giltigt-till'])
    .filter((x): x is string => Boolean(x && ISO.test(x)));
  if (!dates.length) return null;
  const latest = [...dates].sort().pop()!;
  const ends = tripEnds.filter((x): x is string => Boolean(x && ISO.test(x) && x >= today));
  const limit = [today, ...ends].map((d) => addMonths(d, PASS_WARN_MONTHS)).sort().pop()!;
  return latest < limit ? latest : null;
}

/** Medicinerna ur Hälsa som rader för packlistan (en per rad, komma eller semikolon). */
export function medicineLines(entries: VaultEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (e.kind !== 'halsa' || !e.content.pack) continue;
    for (const x of (e.content.f.mediciner ?? '').split(/[\n,;]+/)) {
      const s = x.trim();
      if (s && !out.some((o) => o.toLocaleLowerCase('sv') === s.toLocaleLowerCase('sv'))) out.push(s);
    }
  }
  return out;
}

/** Hälsoposten som håller avbockningarna för packlistan. */
export const healthEntry = (entries: VaultEntry[]) => entries.find((e) => e.kind === 'halsa' && e.content.pack) ?? null;

/** Regler med åldersgräns som gäller för den här åldern, det vill säga där åldern är under gränsen. */
export function rulesForAge<T extends { is_rule: boolean; min_age: number | null }>(facts: T[], age: number): T[] {
  return facts.filter((f) => f.is_rule && f.min_age != null && age < f.min_age).sort((a, b) => (b.min_age ?? 0) - (a.min_age ?? 0));
}

/** Kort undertext för en post i listan, ur dess egna fält. */
export function entrySummary(e: VaultEntry): string {
  const f = e.content.f;
  switch (e.kind) {
    case 'pass':
      return f['giltigt-till'] ?? '';
    case 'forsakring':
      return f.bolag ?? '';
    case 'nodkontakt':
      return f.namn ?? '';
    case 'fodelsedatum':
      return f.fodelsedatum ?? '';
    case 'annat':
      return f.rubrik ?? '';
    default:
      return '';
  }
}
