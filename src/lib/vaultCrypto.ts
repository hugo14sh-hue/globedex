// Valvets kryptering. Allt sker i webbläsaren med Web Crypto: nyckeln härleds ur användarens kod med
// PBKDF2 (SHA-256) och ett salt per användare, och innehållet krypteras med AES-GCM.
// Koden och nyckeln lämnar aldrig den här modulen i klartext: nyckeln går inte att exportera,
// och ingenting här loggas eller sparas lokalt.

/** PBKDF2-varv. Tar under en sekund på en vanlig mobil, och gör det dyrt att gissa koden. */
export const PBKDF2_ITERATIONS = 600_000;

/** Kortaste kod (textnyckeln valv.kort-kod). */
export const MIN_CODE = 6;

/** Raden som bara finns för att kontrollera koden. Innehållet är okänt utan rätt nyckel. */
export const CHECK_KIND = 'kontroll';
const CHECK_VALUE = 'ok';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

/** Nytt slumpat salt (16 byte, base64). */
export const newSalt = () => toB64(randomBytes(16));

/**
 * Salt för konton där databasen saknar kolumnen salt (SQL-blocket inte kört). Det är unikt per
 * användare men inte slumpat. Ett salt behöver inte vara hemligt, bara unikt.
 */
export async function fallbackSalt(userId: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`valv-salt:${userId}`)));
  return toB64(h.slice(0, 16));
}

/** AES-GCM-nyckel ur koden. Nyckeln kan inte exporteras ur webbläsaren. */
export async function deriveKey(code: string, saltB64: string, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface Sealed {
  ciphertext: string;
  iv: string;
}

/** Krypterar ett värde (som JSON) med ett nytt iv. */
export async function seal(key: CryptoKey, value: unknown): Promise<Sealed> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { ciphertext: toB64(new Uint8Array(data)), iv: toB64(iv) };
}

/** Dekrypterar. Fel nyckel eller ändrad chiffertext ger ett fel (AES-GCM kontrollerar äktheten). */
export async function open<T>(key: CryptoKey, s: Sealed): Promise<T> {
  const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv) }, key, fromB64(s.ciphertext));
  return JSON.parse(dec.decode(data)) as T;
}

/** Kontrollraden: krypterad med nyckeln, så att fel kod upptäcks även när valvet är tomt. */
export const sealCheck = (key: CryptoKey) => seal(key, CHECK_VALUE);

/** Sant om nyckeln öppnar kontrollraden. */
export async function checkKey(key: CryptoKey, s: Sealed): Promise<boolean> {
  try {
    return (await open<string>(key, s)) === CHECK_VALUE;
  } catch {
    return false;
  }
}

/** Det enda som skickas till Supabase för en post: typ, chiffertext, iv och salt. */
export interface VaultRowOut {
  kind: string;
  ciphertext: string;
  iv: string;
  salt?: string;
}

/**
 * Bygger raden som sparas. kind är det enda i klartext. Alla fält, även vilka fält posten har,
 * ligger i chiffertexten. salt tas med bara när databasen har kolumnen.
 */
export async function sealRow(key: CryptoKey, kind: string, content: unknown, salt: string | null): Promise<VaultRowOut> {
  const s = await seal(key, content);
  return salt ? { kind, ...s, salt } : { kind, ...s };
}
