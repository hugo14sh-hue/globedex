// Offline. Service workern (vite.config.ts) sparar svaren på läsningar från Supabase, så att senast hämtade
// data går att läsa utan uppkoppling. Skrivningar köas aldrig: utan uppkoppling stoppas de här, innan de
// skickas, och nästa besked i appen blir allmant.offline-skriv i stället för ett allmänt fel.
// Cachen töms när man loggar ut. Valvet finns bara som chiffertext i cachen, aldrig i klartext.
// Testas i offline.test.ts.

/** Cachen med Supabase-svar. Samma namn som i vite.config.ts. */
export const DATA_CACHE = 'supabase-data';

/** Hur länge efter en stoppad skrivning nästa besked byts mot allmant.offline-skriv. */
const WINDOW_MS = 2000;

let blockedAt = 0;

export class OfflineWriteError extends Error {
  constructor() {
    super('Ingen uppkoppling: skrivningen skickades inte');
    this.name = 'OfflineWriteError';
  }
}

/** Sant för anrop som ändrar data i databasen eller bland filerna. Inloggningen räknas inte. */
export function isDataWrite(method: string | undefined, url: string): boolean {
  const m = (method ?? 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD') return false;
  try {
    const p = new URL(url).pathname;
    return p.startsWith('/rest/v1/') || p.startsWith('/storage/v1/');
  } catch {
    return false;
  }
}

/** Sant om en skrivning nyss stoppades. */
export const wasBlockedRecently = (now = Date.now()) => blockedAt > 0 && now - blockedAt < WINDOW_MS;

export function markBlocked(now = Date.now()) {
  blockedAt = now;
}

const requestUrl = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
const requestMethod = (input: RequestInfo | URL, init?: RequestInit) => init?.method ?? (input instanceof Request ? input.method : 'GET');

/**
 * fetch för Supabase-klienten. Skrivningar utan uppkoppling stoppas innan de skickas. Misslyckas en
 * skrivning för att nätet försvann på vägen märks den på samma sätt.
 */
export function createOfflineFetch(base: typeof fetch, online: () => boolean = () => navigator.onLine): typeof fetch {
  return async (input, init) => {
    const write = isDataWrite(requestMethod(input, init), requestUrl(input));
    if (write && !online()) {
      markBlocked();
      throw new OfflineWriteError();
    }
    try {
      return await base(input, init);
    } catch (e) {
      if (write && !online()) markBlocked();
      throw e;
    }
  };
}

/** Tömmer sparade svar, till exempel vid utloggning, så att nästa användare på enheten inte ser dem. */
export async function clearOfflineData(): Promise<void> {
  try {
    if ('caches' in window) await caches.delete(DATA_CACHE);
  } catch {
    // Ingen cache att tömma.
  }
}
