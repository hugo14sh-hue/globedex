// Sökning bland platser (sökfältet för land och plats). Ren logik, testas i search.test.ts.
// Matchar början av varje ord, utan hänsyn till versaler och accenter. Å, ä och ö räknas ändå som
// egna bokstäver (å skiljer sig från a, ö från o), som i svenskan.

const KEEP: Record<string, string> = { å: '\u0001', ä: '\u0002', ö: '\u0003' };
const BACK: Record<string, string> = { '\u0001': 'å', '\u0002': 'ä', '\u0003': 'ö' };

/** Gemener utan accenter, men med å, ä och ö kvar. "Curaçao" -> "curacao", "Malmö" -> "malmö". */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[åäö]/g, (c) => KEEP[c])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\u0001-\u0003]/g, (c) => BACK[c]);
}

/** Orden i en text: allt mellan blanksteg, bindestreck, snedstreck, parenteser, punkter och kommatecken. */
export const words = (s: string): string[] => fold(s).split(/[\s\-–/().,'’]+/).filter(Boolean);

/**
 * Sant när varje ord i frågan är början på något ord i namnet. "mon" hittar "Monaco" och
 * "Monte Carlo", "new y" hittar "New York", "sto" hittar inte "Gustavsberg". Tom fråga matchar allt.
 */
export function matches(name: string, query: string): boolean {
  const q = words(query);
  if (!q.length) return true;
  const w = words(name);
  return q.every((part) => w.some((x) => x.startsWith(part)));
}

/**
 * Filtrerar och sorterar: namn som börjar med frågan först, sedan övriga träffar. Inom varje del
 * behålls ordningen i listan (som redan är sorterad efter namn).
 */
export function search<T>(list: T[], query: string, name: (x: T) => string): T[] {
  const q = fold(query.trim());
  const hits = list.filter((x) => matches(name(x), query));
  if (!q) return hits;
  const first = hits.filter((x) => fold(name(x)).startsWith(q));
  return [...first, ...hits.filter((x) => !first.includes(x))];
}
