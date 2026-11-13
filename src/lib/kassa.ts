// Resekassan: delning, avrundning och skulder. Ren logik utan databas, testas i kassa.test.ts.
// Allt räknas i hela ören (heltal), så att summorna alltid går jämnt ut.

export interface ExpenseLike {
  amount: number | string;
  rate_to_sek: number | string;
  paid_by: string | null;
  /** Tom lista betyder att utgiften delas lika på alla i gruppen. */
  split_between: string[] | null;
  category?: string | null;
}

export interface Transfer {
  from: string;
  to: string;
  /** Belopp i ören. */
  ore: number;
}

/** Utgiftens belopp i svenska ören, med kursen som sparades på raden. */
export const toOre = (e: Pick<ExpenseLike, 'amount' | 'rate_to_sek'>) => Math.round(Number(e.amount) * Number(e.rate_to_sek) * 100);

/**
 * Delar ett belopp i ören lika på personerna. Ören som blir över går en i taget till de första
 * i bokstavsordning efter id, så att samma utgift alltid delas på samma sätt.
 */
export function splitOre(total: number, people: string[]): Record<string, number> {
  const who = [...new Set(people)].sort();
  const out: Record<string, number> = {};
  if (!who.length) return out;
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(Math.round(total));
  const base = Math.floor(abs / who.length);
  let rest = abs - base * who.length;
  for (const p of who) {
    out[p] = sign * (base + (rest > 0 ? 1 : 0));
    if (rest > 0) rest--;
  }
  return out;
}

/** Vilka en utgift delas på: de valda, annars alla medlemmar. */
export const sharers = (e: Pick<ExpenseLike, 'split_between'>, members: string[]) =>
  e.split_between && e.split_between.length ? e.split_between : members;

/**
 * Saldo per person i ören. Plus betyder att personen ska få pengar, minus att personen är skyldig.
 * Utgifter utan betalare (till exempel om personen har lämnat gruppen) räknas inte in.
 */
export function balances(expenses: ExpenseLike[], members: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of members) out[m] = 0;
  for (const e of expenses) {
    if (!e.paid_by) continue;
    const who = sharers(e, members);
    if (!who.length) continue;
    const ore = toOre(e);
    out[e.paid_by] = (out[e.paid_by] ?? 0) + ore;
    for (const [p, share] of Object.entries(splitOre(ore, who))) out[p] = (out[p] ?? 0) - share;
  }
  return out;
}

/** Matchar största skulden mot största fordran inom en grupp vars saldon går jämnt ut. */
function greedy(entries: [string, number][]): Transfer[] {
  const pos = entries.filter(([, v]) => v > 0).map(([k, v]) => ({ k, v }));
  const neg = entries.filter(([, v]) => v < 0).map(([k, v]) => ({ k, v: -v }));
  const out: Transfer[] = [];
  const byAmount = (a: { k: string; v: number }, b: { k: string; v: number }) => b.v - a.v || a.k.localeCompare(b.k);
  while (pos.length && neg.length) {
    pos.sort(byAmount);
    neg.sort(byAmount);
    const c = pos[0];
    const d = neg[0];
    const ore = Math.min(c.v, d.v);
    out.push({ from: d.k, to: c.k, ore });
    c.v -= ore;
    d.v -= ore;
    if (!c.v) pos.shift();
    if (!d.v) neg.shift();
  }
  return out;
}

/** Över så här många personer med saldo används bara den snabba metoden. */
const EXACT_LIMIT = 14;

/**
 * Räknar ut vem som ska betala vem, med så få betalningar som möjligt.
 * Personerna delas först i så många grupper som möjligt där saldona går jämnt ut (då räcker
 * antal personer minus antal grupper betalningar), och inom varje grupp betalar största skulden
 * till största fordran.
 */
export function settle(bal: Record<string, number>): Transfer[] {
  const entries = Object.entries(bal)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  const n = entries.length;
  if (n === 0) return [];
  if (n > EXACT_LIMIT) return greedy(entries);

  const full = (1 << n) - 1;
  const sum = new Array<number>(full + 1).fill(0);
  for (let m = 1; m <= full; m++) {
    const low = m & -m;
    sum[m] = sum[m ^ low] + entries[31 - Math.clz32(low)][1];
  }
  // dp[m] = flest grupper med summan noll som m kan delas i (när sum[m] är noll).
  const dp = new Array<number>(full + 1).fill(0);
  for (let m = 1; m <= full; m++) {
    let best = 0;
    for (let i = 0; i < n; i++) if (m & (1 << i)) best = Math.max(best, dp[m ^ (1 << i)]);
    dp[m] = best + (sum[m] === 0 ? 1 : 0);
  }
  // Följ vägen tillbaka och dela upp i grupper.
  const groups: [string, number][][] = [];
  let current: [string, number][] = [];
  let m = full;
  while (m) {
    const want = dp[m] - (sum[m] === 0 ? 1 : 0);
    let pick = -1;
    for (let i = 0; i < n && pick < 0; i++) if (m & (1 << i) && dp[m ^ (1 << i)] === want) pick = i;
    current.push(entries[pick]);
    m ^= 1 << pick;
    if (sum[m] === 0) {
      groups.push(current);
      current = [];
    }
  }
  return groups.flatMap(greedy);
}

/** Summa i ören, totalt och per kategori (utan kategori: nyckeln ''). */
export function spent(expenses: ExpenseLike[]): { total: number; byCategory: Record<string, number> } {
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const e of expenses) {
    const ore = toOre(e);
    total += ore;
    const c = e.category ?? '';
    byCategory[c] = (byCategory[c] ?? 0) + ore;
  }
  return { total, byCategory };
}

/** Andel i procent (0–100) av en budget. */
export const share = (part: number, whole: number) => (whole > 0 ? Math.min(100, Math.max(0, Math.round((part / whole) * 100))) : 0);
