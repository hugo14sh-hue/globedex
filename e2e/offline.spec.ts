// Offline: körs mot det byggda appen (vite preview) med service worker. En kommande resa med en bokning och
// en packrad skapas som testanvändaren, appen öppnas uppkopplad (som förvärmer kommande resor), och sedan
// läses bokningar och packlista utan uppkoppling. En skrivning utan uppkoppling ska stoppas med
// allmant.offline-skriv. Resan tas bort efteråt.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { credentials, hasTestAccount, testClient } from './env';

const TEXTER = (
  JSON.parse(readFileSync(join(process.cwd(), 'content/_texter.json'), 'utf8').replace(/^﻿/, '')) as {
    texter: Record<string, string | Record<string, string>>;
  }
).texter;
const variants = (key: string) => {
  const e = TEXTER[key];
  return typeof e === 'string' ? [e] : Object.values(e);
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.skip(!hasTestAccount, 'TEST_EMAIL och TEST_PASSWORD saknas i .env.local');

const TITLE = 'Röktest offline';
let tripId = '';

test.beforeAll(async () => {
  const { db, userId } = await testClient();
  const { data: p } = await db.from('profiles').select('active_group_id').eq('id', userId).single();
  const start = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  const { data: trip, error } = await db
    .from('trips')
    .insert({ group_id: p!.active_group_id, title: TITLE, place_id: 'NL', start_date: start, end_date: start, created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  tripId = trip.id;
  await db.from('bookings').insert({ trip_id: tripId, kind: 'boende', title: TITLE });
  await db.from('packing_items').insert({ trip_id: tripId, title: TITLE, grp: 'Övrigt' });
  await db.auth.signOut();
});

test.afterAll(async () => {
  if (!tripId) return;
  const { db } = await testClient();
  await db.from('trips').delete().eq('id', tripId);
  await db.auth.signOut();
});

test('kommande resa går att läsa utan uppkoppling, och skrivningar stoppas', async ({ page, context }) => {
  await page.goto('/login');
  await page.waitForSelector('input[name=email]');
  await page.evaluate(({ email, password }) => {
    const set = (el: HTMLInputElement | null, v: string) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
      el!.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(document.querySelector('input[name=email]'), email);
    set(document.querySelector('input[name=password]'), password);
  }, credentials());
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/karta/);

  // Service workern tar över efter första laddningen. Ladda om så att den styr sidan, och vänta på förvärmningen.
  await page.waitForFunction(() => navigator.serviceWorker?.ready.then(() => true), null, { timeout: 30_000 });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), null, { timeout: 30_000 });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const c = await caches.open('supabase-data');
          const keys = (await c.keys()).map((r) => r.url);
          return keys.some((u) => u.includes('/rest/v1/bookings')) && keys.some((u) => u.includes('/rest/v1/packing_items'));
        }),
      { timeout: 30_000 },
    )
    .toBe(true);

  await context.setOffline(true);
  await page.goto(`/resor/${tripId}/bokningar`);
  await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 20_000 });
  await page.goto(`/resor/${tripId}/pack`);
  const row = page.getByRole('button', { name: TITLE, exact: true });
  await expect(row).toBeVisible({ timeout: 20_000 });

  // Skrivning utan uppkoppling: stoppas med beskedet allmant.offline-skriv, och inget skickas.
  await row.click();
  await expect(page.locator('.toast').filter({ hasText: new RegExp(variants('allmant.offline-skriv').map(esc).join('|')) })).toBeVisible();
  await context.setOffline(false);
});
