// Tillbaka till samma ställe. Scrollpositionen sparas per historikpost (location.key) och läggs tillbaka
// när man går bakåt eller framåt i historiken (POP). Ny navigering framåt (PUSH) börjar högst upp.
// Byte av vy eller filter på samma sida (REPLACE med samma sökväg) behåller positionen.
// Vyer och filter ligger i adressen (useUrlState), så att de också kommer tillbaka. Testas i navMemory.test.ts.
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';

export type NavType = 'POP' | 'PUSH' | 'REPLACE';

/** Vart sidan ska scrollas efter en navigering: en position, eller 'keep' för att låta den stå. */
export function scrollTarget(type: NavType, samePath: boolean, saved: number | undefined): number | 'keep' {
  if (type === 'POP') return saved ?? 0;
  if (type === 'REPLACE' && samePath) return 'keep';
  return 0;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORE_KEY = 'globedex.scroll';
const MAX_ENTRIES = 60;

/** Positioner per historikpost i sessionStorage (bara siffror, inget innehåll). De äldsta tas bort. */
export function createScrollStore(storage: KeyValueStorage | null) {
  let map: Record<string, number> = {};
  try {
    map = JSON.parse(storage?.getItem(STORE_KEY) ?? '{}') as Record<string, number>;
  } catch {
    map = {};
  }
  return {
    get: (key: string): number | undefined => map[key],
    set(key: string, y: number) {
      delete map[key];
      map[key] = Math.max(0, Math.round(y));
      const keys = Object.keys(map);
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete map[k];
      try {
        storage?.setItem(STORE_KEY, JSON.stringify(map));
      } catch {
        // Fullt eller avstängt: positionen finns kvar i minnet.
      }
    },
  };
}

/** Ny URLSearchParams med name satt, eller borttagen när värdet är standardvärdet (adressen hålls kort). */
export function withParam(params: URLSearchParams, name: string, value: string | null, fallback: string | null = null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value == null || value === '' || value === fallback) next.delete(name);
  else next.set(name, value);
  return next;
}

const safeSession = (): KeyValueStorage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/** Läggs en gång högt upp i appen. */
export function useScrollMemory() {
  const loc = useLocation();
  const type = useNavigationType() as NavType;
  const store = useRef<ReturnType<typeof createScrollStore> | null>(null);
  const current = useRef<string>(loc.key);
  const lastPath = useRef<string>(loc.pathname);
  const restoring = useRef(false);

  store.current ??= createScrollStore(safeSession());

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!restoring.current) store.current!.set(current.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useLayoutEffect(() => {
    current.current = loc.key;
    const samePath = lastPath.current === loc.pathname;
    lastPath.current = loc.pathname;
    const target = scrollTarget(type, samePath, store.current!.get(loc.key));
    // replace ger historikposten en ny nyckel: positionen sparas under den direkt, inte först vid nästa scroll.
    if (target === 'keep') {
      if (!restoring.current) store.current!.set(loc.key, window.scrollY);
      return;
    }
    if (target === 0) {
      restoring.current = false;
      window.scrollTo(0, 0);
      return;
    }
    // Innehållet laddas ofta efter navigeringen: försök tills sidan är lång nog, högst 4 sekunder,
    // och sluta direkt om användaren själv börjar scrolla.
    restoring.current = true;
    const until = performance.now() + 4000;
    let frame = 0;
    const stop = () => {
      restoring.current = false;
      cancelAnimationFrame(frame);
      for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.removeEventListener(e, stop);
    };
    for (const e of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) window.addEventListener(e, stop, { passive: true });
    const tick = () => {
      window.scrollTo(0, target);
      if (Math.abs(window.scrollY - target) < 2 || performance.now() > until) {
        stop();
        store.current!.set(loc.key, window.scrollY);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return stop;
  }, [loc.key, loc.pathname, type]);
}

/**
 * Ett värde i adressen (?name=), till exempel vald vy eller filter. Ändras med replace, så att det inte
 * blir nya steg i historiken, men följer med när man går tillbaka till sidan.
 */
export function useUrlState<T extends string>(name: string, fallback: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(name);
  const value = raw != null && (!allowed || allowed.includes(raw as T)) ? (raw as T) : fallback;
  const set = useCallback((v: T) => setParams((p) => withParam(p, name, v, fallback), { replace: true }), [name, fallback, setParams]);
  return [value, set];
}

/** Som useUrlState, men utan standardvärde: null när parametern saknas (till exempel ett öppet bottenark). */
export function useUrlParam(name: string): [string | null, (v: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const set = useCallback((v: string | null) => setParams((p) => withParam(p, name, v), { replace: true }), [name, setParams]);
  return [params.get(name), set];
}

/** Sant om föregående historikpost hör till appen (react-router räknar idx från 0 i varje flik). */
export function canGoBack(): boolean {
  const s = window.history.state as { idx?: number } | null;
  return typeof s?.idx === 'number' && s.idx > 0;
}
