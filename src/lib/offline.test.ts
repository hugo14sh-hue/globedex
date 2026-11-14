import { describe, expect, it, vi } from 'vitest';
import { createOfflineFetch, isDataWrite, markBlocked, OfflineWriteError, wasBlockedRecently } from './offline';

const URL_REST = 'https://x.supabase.co/rest/v1/trips?id=eq.1';

describe('isDataWrite', () => {
  it('skrivningar mot databasen och filerna, inte läsningar och inte inloggningen', () => {
    expect(isDataWrite('POST', URL_REST)).toBe(true);
    expect(isDataWrite('PATCH', URL_REST)).toBe(true);
    expect(isDataWrite('DELETE', URL_REST)).toBe(true);
    expect(isDataWrite('POST', 'https://x.supabase.co/storage/v1/object/bokningar/a/b.pdf')).toBe(true);
    expect(isDataWrite('GET', URL_REST)).toBe(false);
    expect(isDataWrite(undefined, URL_REST)).toBe(false);
    expect(isDataWrite('HEAD', URL_REST)).toBe(false);
    expect(isDataWrite('POST', 'https://x.supabase.co/auth/v1/token')).toBe(false);
    expect(isDataWrite('POST', 'inte en adress')).toBe(false);
  });
});

describe('createOfflineFetch', () => {
  it('stoppar skrivningar utan uppkoppling innan de skickas, och inget köas', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const f = createOfflineFetch(base as unknown as typeof fetch, () => false);
    await expect(f(URL_REST, { method: 'POST', body: '{}' })).rejects.toBeInstanceOf(OfflineWriteError);
    expect(base).not.toHaveBeenCalled();
    expect(wasBlockedRecently()).toBe(true);
  });

  it('läsningar går vidare utan uppkoppling (service workern svarar ur cachen)', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const f = createOfflineFetch(base as unknown as typeof fetch, () => false);
    await f(URL_REST);
    expect(base).toHaveBeenCalledTimes(1);
  });

  it('skrivningar med uppkoppling skickas som vanligt', async () => {
    const base = vi.fn(async () => new Response('ok'));
    const f = createOfflineFetch(base as unknown as typeof fetch, () => true);
    await f(URL_REST, { method: 'PATCH' });
    expect(base).toHaveBeenCalledTimes(1);
  });
});

describe('wasBlockedRecently', () => {
  it('gäller en kort stund efter en stoppad skrivning', () => {
    markBlocked(1000);
    expect(wasBlockedRecently(1500)).toBe(true);
    expect(wasBlockedRecently(4000)).toBe(false);
  });
});
