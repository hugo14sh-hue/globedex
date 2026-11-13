// Valvet i appen: nyckeln och det upplåsta innehållet finns bara i minnet medan Valvet är öppet.
// Ingenting sparas i localStorage, och ingenting loggas. Valvet låses när appen läggs i bakgrunden,
// efter några minuters inaktivitet och vid utloggning.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useFeedback } from '../components/Feedback';
import { useSession } from './session';
import { supabase } from './supabase';
import { t } from './texter';
import type { VaultContent, VaultEntry, VaultKind } from './vaultLogic';
import * as store from './vaultStore';
import type { VaultDb, VaultRowIn } from './vaultStore';

/** Valvet låses efter så här lång tid utan tryck eller tangent. */
export const VAULT_IDLE_MS = 5 * 60_000;

const db: VaultDb = {
  select: (userId, withSalt) =>
    supabase
      .from('vault_items')
      .select(withSalt ? 'id, kind, ciphertext, iv, salt, updated_at' : 'id, kind, ciphertext, iv, updated_at')
      .eq('user_id', userId)
      .then((r) => ({ data: r.data as unknown as VaultRowIn[] | null, error: r.error })),
  insert: (row) =>
    supabase
      .from('vault_items')
      .insert(row)
      .select('id, kind, ciphertext, iv, updated_at')
      .single()
      .then((r) => ({ data: r.data as VaultRowIn | null, error: r.error })),
  update: (id, row) =>
    supabase
      .from('vault_items')
      .update(row)
      .eq('id', id)
      .select('id, kind, ciphertext, iv, updated_at')
      .single()
      .then((r) => ({ data: r.data as VaultRowIn | null, error: r.error })),
  upsert: (rows) =>
    supabase
      .from('vault_items')
      .upsert(rows, { onConflict: 'id' })
      .select('id, kind, ciphertext, iv, updated_at')
      .then((r) => ({ data: r.data as VaultRowIn[] | null, error: r.error })),
  remove: (id) =>
    supabase
      .from('vault_items')
      .delete()
      .eq('id', id)
      .then((r) => ({ data: null, error: r.error })),
};

export type VaultState = 'laddar' | 'fel' | 'ny' | 'last' | 'oppen';

interface VaultCtx {
  state: VaultState;
  /** Upplåst innehåll. Tomt när Valvet är låst. */
  entries: VaultEntry[];
  /** Antal poster, även när Valvet är låst (bara kind läses). */
  count: number;
  create: (code: string) => Promise<void>;
  /** Svarar falskt vid fel kod. */
  unlock: (code: string) => Promise<boolean>;
  lock: () => void;
  save: (entry: { id?: string; kind: VaultKind; content: VaultContent }) => Promise<VaultEntry>;
  remove: (id: string) => Promise<void>;
  changeCode: (code: string) => Promise<void>;
  reload: () => void;
}

const Ctx = createContext<VaultCtx | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const { toast } = useFeedback();
  const userId = session?.user.id ?? null;
  const [state, setState] = useState<VaultState>('laddar');
  const [rows, setRows] = useState<VaultRowIn[]>([]);
  const [hasSalt, setHasSalt] = useState(true);
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  // Nyckeln ligger bara här, i minnet, och kan inte exporteras.
  const opened = useRef<{ key: CryptoKey; salt: string | null } | null>(null);
  const [n, setN] = useState(0);

  const lock = useCallback(() => {
    opened.current = null;
    setEntries([]);
    setState((s) => (s === 'oppen' ? 'last' : s));
  }, []);

  useEffect(() => {
    lock();
    if (!userId) return;
    let alive = true;
    setState('laddar');
    store
      .loadRows(db, userId)
      .then((r) => {
        if (!alive) return;
        setRows(r.rows);
        setHasSalt(r.hasSalt);
        setState(store.hasVault(r.rows) ? 'last' : 'ny');
      })
      .catch(() => alive && setState('fel'));
    return () => {
      alive = false;
    };
  }, [userId, n, lock]);

  // Lås när appen läggs i bakgrunden.
  useEffect(() => {
    if (state !== 'oppen') return;
    const onHide = () => {
      if (document.visibilityState === 'hidden') lock();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', lock);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', lock);
    };
  }, [state, lock]);

  // Lås efter några minuter utan aktivitet.
  useEffect(() => {
    if (state !== 'oppen') return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        lock();
        toast(t('valv.last-auto'));
      }, VAULT_IDLE_MS);
    };
    arm();
    const events = ['pointerdown', 'keydown', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [state, lock, toast]);

  const create = useCallback(
    async (code: string) => {
      if (!userId) throw new Error('Inte inloggad');
      const o = await store.createVault(db, userId, code, hasSalt);
      opened.current = { key: o.key, salt: o.salt };
      const r = await store.loadRows(db, userId);
      setRows(r.rows);
      setEntries([]);
      setState('oppen');
    },
    [userId, hasSalt],
  );

  const unlock = useCallback(
    async (code: string) => {
      if (!userId) return false;
      const r = await store.loadRows(db, userId);
      setRows(r.rows);
      const o = await store.unlockVault(userId, code, r.rows);
      if (!o) return false;
      opened.current = { key: o.key, salt: o.salt };
      setEntries(o.entries);
      setState('oppen');
      return true;
    },
    [userId],
  );

  const save = useCallback<VaultCtx['save']>(
    async (entry) => {
      if (!userId || !opened.current) throw new Error('Valvet är låst');
      const saved = await store.saveEntry(db, userId, opened.current, entry);
      setEntries((l) => (l.some((x) => x.id === saved.id) ? l.map((x) => (x.id === saved.id ? saved : x)) : [...l, saved]));
      setRows((l) => (l.some((x) => x.id === saved.id) ? l : [...l, { id: saved.id, kind: saved.kind, ciphertext: '', iv: '', updated_at: saved.updated_at }]));
      return saved;
    },
    [userId],
  );

  const remove = useCallback(async (id: string) => {
    await store.deleteEntry(db, id);
    setEntries((l) => l.filter((x) => x.id !== id));
    setRows((l) => l.filter((x) => x.id !== id));
  }, []);

  const changeCode = useCallback(
    async (code: string) => {
      if (!userId || !opened.current) throw new Error('Valvet är låst');
      const r = await store.loadRows(db, userId);
      const o = await store.changeCode(db, userId, r.rows, entries, code, r.hasSalt);
      opened.current = { key: o.key, salt: o.salt };
      setRows((await store.loadRows(db, userId)).rows);
    },
    [userId, entries],
  );

  const reload = useCallback(() => setN((x) => x + 1), []);

  const value = useMemo<VaultCtx>(
    () => ({ state, entries, count: store.entryCount(rows), create, unlock, lock, save, remove, changeCode, reload }),
    [state, entries, rows, create, unlock, lock, save, remove, changeCode, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVault(): VaultCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useVault används utanför VaultProvider');
  return c;
}
