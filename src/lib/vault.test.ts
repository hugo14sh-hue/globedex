import { describe, expect, it } from 'vitest';
import { CHECK_KIND, deriveKey, newSalt, open, seal } from './vaultCrypto';
import type { VaultContent } from './vaultLogic';
import { changeCode, createVault, loadRows, saveEntry, unlockVault, type VaultDb, type VaultRowIn } from './vaultStore';

// Färre varv i testerna så att de går snabbt. Appen använder PBKDF2_ITERATIONS.
const FAST = 1000;

describe('kryptering', () => {
  it('krypterar och dekrypterar', async () => {
    const salt = newSalt();
    const key = await deriveKey('rätt-kod-123', salt, FAST);
    const s = await seal(key, { f: { passnummer: 'AB1234567' } });
    expect(s.ciphertext).not.toContain('AB1234567');
    expect(await open(key, s)).toEqual({ f: { passnummer: 'AB1234567' } });
  });

  it('nytt iv varje gång', async () => {
    const key = await deriveKey('kod-kod-kod', newSalt(), FAST);
    const a = await seal(key, 'samma');
    const b = await seal(key, 'samma');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('fel kod ger fel', async () => {
    const salt = newSalt();
    const right = await deriveKey('rätt-kod-123', salt, FAST);
    const wrong = await deriveKey('fel-kod-1234', salt, FAST);
    const s = await seal(right, { f: { telefon: '0701234567' } });
    await expect(open(wrong, s)).rejects.toThrow();
  });

  it('samma kod med annat salt ger fel', async () => {
    const a = await deriveKey('rätt-kod-123', newSalt(), FAST);
    const b = await deriveKey('rätt-kod-123', newSalt(), FAST);
    await expect(open(b, await seal(a, 'x'))).rejects.toThrow();
  });
});

/** Låtsasdatabas som sparar allt som skulle ha skickats till Supabase. */
function fakeDb() {
  const sent: unknown[] = [];
  const rows: VaultRowIn[] = [];
  let n = 0;
  const now = '2026-11-13T12:00:00Z';
  const db: VaultDb = {
    async select(_u, withSalt) {
      return { data: rows.map((r) => (withSalt ? { ...r } : { ...r, salt: undefined })), error: null };
    },
    async insert(row) {
      sent.push(row);
      const r = { ...row, id: `id${++n}`, updated_at: now } as VaultRowIn;
      rows.push(r);
      return { data: r, error: null };
    },
    async update(id, row) {
      sent.push(row);
      const r = rows.find((x) => x.id === id)!;
      Object.assign(r, row);
      return { data: r, error: null };
    },
    async upsert(list) {
      sent.push(list);
      for (const row of list) Object.assign(rows.find((x) => x.id === row.id)!, row);
      return { data: rows, error: null };
    },
    async remove() {
      return { data: null, error: null };
    },
  };
  return { db, sent, rows };
}

// Mockar inte PBKDF2: deriveKey körs med appens riktiga varvtal i de här testerna.
describe('Valvet mot databasen', () => {
  const user = 'user-1';
  const secrets: VaultContent[] = [
    { f: { passnummer: 'AB1234567', 'giltigt-till': '2027-03-01' } },
    { f: { allergier: 'Jordnötter', mediciner: 'Insulin\nAstmaspray', ovrigt: 'Diabetes typ 1' }, pack: true },
    { f: { fodelsedatum: '2001-04-17' } },
  ];
  const kinds = ['pass', 'halsa', 'fodelsedatum'] as const;
  const code = 'hemlig-kod-42';

  it('klartext ingår aldrig i det som skickas', async () => {
    const { db, sent } = fakeDb();
    const o = await createVault(db, user, code, true);
    for (let i = 0; i < secrets.length; i++) await saveEntry(db, user, o, { kind: kinds[i], content: secrets[i] });
    const { rows } = await loadRows(db, user);
    await changeCode(db, user, rows, (await unlockVault(user, code, rows))!.entries, 'ny-kod-9876', true);

    const all = JSON.stringify(sent);
    const plain = [
      code,
      'ny-kod-9876',
      'AB1234567',
      '2027-03-01',
      'Jordnötter',
      'Insulin',
      'Astmaspray',
      'Diabetes',
      '2001-04-17',
      // Inte heller vilka fält en post har.
      'passnummer',
      'giltigt-till',
      'allergier',
      'mediciner',
      '"fodelsedatum":',
    ];
    for (const p of plain) expect(all).not.toContain(p);
    // Bara de här nycklarna skickas.
    const flat = sent.flatMap((x) => (Array.isArray(x) ? x : [x])) as Record<string, unknown>[];
    for (const r of flat) for (const k of Object.keys(r)) expect(['id', 'user_id', 'kind', 'ciphertext', 'iv', 'salt']).toContain(k);
  }, 30_000);

  it('låser upp med rätt kod, inte med fel, och efter byte bara med den nya', async () => {
    const { db } = fakeDb();
    const o = await createVault(db, user, code, true);
    await saveEntry(db, user, o, { kind: 'pass', content: secrets[0] });
    let { rows } = await loadRows(db, user);
    expect(await unlockVault(user, 'fel-kod-0000', rows)).toBeNull();
    const opened = await unlockVault(user, code, rows);
    expect(opened?.entries.map((e) => e.content)).toEqual([secrets[0]]);
    expect(rows.find((r) => r.kind === CHECK_KIND)).toBeTruthy();

    await changeCode(db, user, rows, opened!.entries, 'ny-kod-9876', true);
    ({ rows } = await loadRows(db, user));
    expect(await unlockVault(user, code, rows)).toBeNull();
    expect((await unlockVault(user, 'ny-kod-9876', rows))?.entries[0].content).toEqual(secrets[0]);
  }, 30_000);

  it('fungerar utan kolumnen salt (SQL-blocket inte kört)', async () => {
    const { db, sent } = fakeDb();
    const o = await createVault(db, user, code, false);
    expect(o.salt).toBeNull();
    await saveEntry(db, user, o, { kind: 'fodelsedatum', content: secrets[2] });
    expect(JSON.stringify(sent)).not.toContain('"salt"');
    const { rows } = await loadRows(db, user);
    expect((await unlockVault(user, code, rows))?.entries[0].content).toEqual(secrets[2]);
    expect(await unlockVault('annan-anvandare', code, rows)).toBeNull();
  }, 30_000);
});
