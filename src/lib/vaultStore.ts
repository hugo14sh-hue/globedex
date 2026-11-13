// Valvet mot databasen (vault_items). Allt krypteras innan det lämnar den här modulen, och bara
// kind, ciphertext, iv och salt skickas. Databasen nås via ett litet gränssnitt (VaultDb), så att
// testet kan fånga exakt det som skulle skickas till Supabase.
import {
  CHECK_KIND,
  checkKey,
  deriveKey,
  fallbackSalt,
  newSalt,
  open,
  sealCheck,
  sealRow,
  type VaultRowOut,
} from './vaultCrypto';
import { isVaultKind, type VaultContent, type VaultEntry, type VaultKind } from './vaultLogic';

export interface VaultRowIn {
  id: string;
  kind: string;
  ciphertext: string;
  iv: string;
  salt?: string | null;
  updated_at: string;
}

type Res<T> = PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>;

export interface VaultDb {
  select(userId: string, withSalt: boolean): Res<VaultRowIn[]>;
  insert(row: VaultRowOut & { user_id: string }): Res<VaultRowIn>;
  update(id: string, row: VaultRowOut): Res<VaultRowIn>;
  upsert(rows: (VaultRowOut & { id: string; user_id: string })[]): Res<VaultRowIn[]>;
  remove(id: string): Res<null>;
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

/** Felkoder när kolumnen salt saknas (SQL-blocket inte kört). */
const NO_COLUMN = new Set(['42703', 'PGRST204']);

export interface VaultRows {
  rows: VaultRowIn[];
  /** Sant om databasen har kolumnen salt. */
  hasSalt: boolean;
}

/** Hämtar användarens rader (bara chiffertext). Saknas kolumnen salt hämtas raderna utan den. */
export async function loadRows(db: VaultDb, userId: string): Promise<VaultRows> {
  const r = await db.select(userId, true);
  if (r.error && NO_COLUMN.has(r.error.code ?? '')) return { rows: must(await db.select(userId, false)), hasSalt: false };
  return { rows: must(r), hasSalt: true };
}

/** Antal poster i Valvet (utan kontrollraden). Kräver ingen kod: bara kind läses. */
export const entryCount = (rows: Pick<VaultRowIn, 'kind'>[]) => rows.filter((r) => r.kind !== CHECK_KIND).length;

export const hasVault = (rows: VaultRowIn[]) => rows.some((r) => r.kind === CHECK_KIND);

export interface Opened {
  key: CryptoKey;
  /** Saltet som sparas med nya rader, eller null när databasen saknar kolumnen. */
  salt: string | null;
  entries: VaultEntry[];
}

/** Skapar Valvet med en ny kod: bara kontrollraden sparas. */
export async function createVault(db: VaultDb, userId: string, code: string, hasSalt: boolean): Promise<Opened> {
  const salt = hasSalt ? newSalt() : null;
  const key = await deriveKey(code, salt ?? (await fallbackSalt(userId)));
  const check = await sealCheck(key);
  must(await db.insert({ user_id: userId, kind: CHECK_KIND, ...check, ...(salt ? { salt } : {}) }));
  return { key, salt, entries: [] };
}

async function decryptAll(key: CryptoKey, rows: VaultRowIn[]): Promise<VaultEntry[]> {
  const out: VaultEntry[] = [];
  for (const r of rows) {
    if (r.kind === CHECK_KIND || !isVaultKind(r.kind)) continue;
    try {
      const content = await open<VaultContent>(key, r);
      out.push({ id: r.id, kind: r.kind, content: { ...content, f: content.f ?? {} }, updated_at: r.updated_at });
    } catch {
      // En rad som inte går att öppna (till exempel skadad) hoppas över. Den ligger kvar i databasen.
    }
  }
  return out;
}

/** Låser upp med koden. Fel kod ger null. */
export async function unlockVault(userId: string, code: string, rows: VaultRowIn[]): Promise<Opened | null> {
  const check = rows.find((r) => r.kind === CHECK_KIND);
  if (!check) return null;
  const salt = check.salt ?? null;
  const key = await deriveKey(code, salt ?? (await fallbackSalt(userId)));
  if (!(await checkKey(key, check))) return null;
  return { key, salt, entries: await decryptAll(key, rows) };
}

/** Sparar en ny eller ändrad post. Svarar med posten som den ligger i databasen. */
export async function saveEntry(
  db: VaultDb,
  userId: string,
  o: Pick<Opened, 'key' | 'salt'>,
  entry: { id?: string; kind: VaultKind; content: VaultContent },
): Promise<VaultEntry> {
  const row = await sealRow(o.key, entry.kind, entry.content, o.salt);
  const saved = entry.id ? must(await db.update(entry.id, row)) : must(await db.insert({ ...row, user_id: userId }));
  return { id: saved.id, kind: entry.kind, content: entry.content, updated_at: saved.updated_at };
}

export async function deleteEntry(db: VaultDb, id: string): Promise<void> {
  must(await db.remove(id));
}

/**
 * Byter kod: allt krypteras om med en ny nyckel och ett nytt salt och sparas i ett enda anrop,
 * så att posterna aldrig blir hälften gamla och hälften nya.
 */
export async function changeCode(
  db: VaultDb,
  userId: string,
  rows: VaultRowIn[],
  entries: VaultEntry[],
  newCode: string,
  hasSalt: boolean,
): Promise<Opened> {
  const check = rows.find((r) => r.kind === CHECK_KIND);
  if (!check) throw new Error('Valvet finns inte');
  const salt = hasSalt ? newSalt() : null;
  const key = await deriveKey(newCode, salt ?? (await fallbackSalt(userId)));
  const out: (VaultRowOut & { id: string; user_id: string })[] = [
    { id: check.id, user_id: userId, kind: CHECK_KIND, ...(await sealCheck(key)), ...(salt ? { salt } : {}) },
  ];
  for (const e of entries) out.push({ id: e.id, user_id: userId, ...(await sealRow(key, e.kind, e.content, salt)) });
  must(await db.upsert(out));
  return { key, salt, entries };
}
