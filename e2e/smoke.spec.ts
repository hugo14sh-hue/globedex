// Röktest: loggar in med testkontot i en 390 px bred mobilvy och går igenom appens viktigaste flöden.
// Hoppas över om TEST_EMAIL och TEST_PASSWORD saknas i .env.local. Städar efter sig (e2e/cleanup.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { restore, snapshot, type Snapshot } from './cleanup';
import { credentials, hasTestAccount, testClient } from './env';

type Entry = string | Record<string, string>;
const TEXTER = (
  JSON.parse(readFileSync(join(process.cwd(), 'content/_texter.json'), 'utf8').replace(/^﻿/, '')) as { texter: Record<string, Entry> }
).texter;

/** Texten i neutral stil, som i appen. */
const tx = (key: string): string => {
  const e = TEXTER[key];
  if (e === undefined) throw new Error(`Text saknas: ${key}`);
  return typeof e === 'string' ? e : e.neutral;
};
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Alla språkstilar för en nyckel, med {värden} som jokertecken. */
const anyTone = (key: string): RegExp => {
  const e = TEXTER[key];
  const all = typeof e === 'string' ? [e] : Object.values(e);
  return new RegExp(all.map((s) => esc(s).replace(/\\\{\w+\\\}/g, '.*')).join('|'));
};

// En listpunkt i Nederländerna som hör till ett kort i samlingsboken.
const NL = JSON.parse(readFileSync(join(process.cwd(), 'content/NL.json'), 'utf8').replace(/^﻿/, '')) as {
  items: { id: string; name: string; compendium_id?: string }[];
  compendium: { id: string; name: string }[];
};

test.describe.configure({ mode: 'serial' });
test.skip(!hasTestAccount, 'TEST_EMAIL och TEST_PASSWORD saknas i .env.local');

let snap: Snapshot | null = null;

test.beforeAll(async () => {
  const { db, userId } = await testClient();
  snap = await snapshot(db, userId);
  await db.auth.signOut();
});

test.afterAll(async () => {
  if (!snap) return;
  const { db, userId } = await testClient();
  const done = await restore(db, userId, snap);
  console.log(`Städat: ${done.length ? done.join(', ') : 'inget att ta bort'}`);
  await db.auth.signOut();
});

/** Fyller e-post och lösenord utan att värdena hamnar i testets steg eller loggar. */
async function login(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: tx('login.knapp-logga-in') })).toBeVisible();
  await page.evaluate(({ email, password }) => {
    const set = (el: HTMLInputElement | null, v: string) => {
      if (!el) throw new Error('Fältet saknas');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(document.querySelector('input[name=email]'), email);
    set(document.querySelector('input[name=password]'), password);
  }, credentials());
  await page.getByRole('button', { name: tx('login.knapp-logga-in') }).click();
  await expect(page).toHaveURL(/\/karta/);
}

test('röktest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await test.step('inloggning', () => login(page));

  await test.step('kartan laddas och status sätts på ett land', async () => {
    await expect(page.locator('.topbar')).toBeVisible();
    const canvas = page.locator('.map canvas');
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const box = (await canvas.boundingBox())!;
    const sheet = page.getByRole('dialog');
    // Prova några punkter mitt i Europa tills ett land träffas.
    for (const [fx, fy] of [
      [0.55, 0.62],
      [0.5, 0.55],
      [0.6, 0.5],
      [0.45, 0.7],
      [0.65, 0.7],
      [0.4, 0.45],
    ]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      if (await sheet.isVisible().catch(() => false)) break;
      await page.waitForTimeout(300);
    }
    await expect(sheet).toBeVisible();
    const besokt = sheet.getByRole('button', {
      name: tx('karta.status.besokt'),
      exact: true,
    });
    if ((await besokt.getAttribute('aria-pressed')) === 'true')
      await sheet.getByRole('button', { name: tx('karta.status.planerad'), exact: true }).click();
    else await besokt.click();
    await expect(sheet.locator('[aria-pressed=true]').first()).toBeVisible();
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
    await expect(sheet).toBeHidden();
  });

  const item = NL.items.find((i) => i.compendium_id && !snap!.checks.includes(i.id) && !snap!.finds.includes(i.compendium_id))!;
  const card = NL.compendium.find((c) => c.id === item.compendium_id)!;

  await test.step('landssidan för Nederländerna öppnas och en listpunkt bockas av', async () => {
    await page.goto('/karta/NL?vy=lista');
    const box = page.getByRole('button', { name: item.name, exact: true });
    await expect(box).toBeVisible({ timeout: 20_000 });
    // Knappen visar bocken direkt. Vänta på att avbockningen och fyndet är sparade innan sidan byts.
    const saved = Promise.all([
      page.waitForResponse((r) => r.url().includes('/rest/v1/item_checks') && r.request().method() === 'POST'),
      page.waitForResponse((r) => r.url().includes('/rest/v1/finds') && r.request().method() === 'POST'),
    ]);
    await box.click();
    await expect(box).toHaveAttribute('aria-pressed', 'true');
    for (const r of await saved) expect(r.ok()).toBe(true);
  });

  await test.step('fyndet syns i samlingsboken', async () => {
    await page.goto('/listor?vy=samlingsbok&del=kort');
    await expect(page.getByRole('button', { name: new RegExp(`^${esc(card.name)} `) })).toBeVisible({ timeout: 20_000 });
  });

  await test.step('samlingsboken: markera flera kort och bocka av och ta bort ett kort i bottenarket', async () => {
    await page.goto('/listor?vy=samlingsbok&del=kort');
    await page.getByRole('button', { name: tx('samling.markera-flera') }).click();
    // Två kort som inte är hittade (de har aria-pressed i läget Markera flera och är inte avstängda).
    const unfound = page.locator('.bok button[aria-pressed]:not([disabled])');
    await expect(unfound.first()).toBeVisible();
    await unfound.nth(0).click();
    await unfound.nth(1).click();
    await expect(page.locator('.pickbar')).toContainText(anyTone('samling.valda'));
    // Utan SQL-blocket för fynd utan datum stoppas första anropet, och appen sparar då med dagens datum.
    // Testet väntar därför på det anrop som lyckas.
    const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/finds') && r.request().method() === 'POST' && r.ok());
    await page.getByRole('button', { name: tx('samling.lagg-till-valda') }).click();
    await saved;
    await expect(page.getByText(anyTone('samling.flera-klart'))).toBeVisible();
    await expect(page.locator('.pickbar')).toBeHidden();

    // Ett kort till bockas av i bottenarket, och tas sedan bort igen.
    const next = page.locator('.bok button:not(.on)').first();
    await next.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByLabel(tx('samling.nar'))).toBeVisible();
    await expect(sheet.getByLabel(tx('samling.var'))).toBeVisible();
    await sheet.getByRole('button', { name: tx('samling.hittad-knapp') }).click();
    await expect(sheet).toBeHidden();
    await page.locator('.bok button.on').first().click();
    await page.getByRole('dialog').getByRole('button', { name: tx('samling.ta-bort-fynd') }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: tx('samling.hittad-knapp') })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: tx('knapp.stang') }).click();
  });

  await test.step('en punkt läggs till ur bucketkatalogen', async () => {
    await page.goto('/listor?vy=bucketlist');
    await page.getByRole('button', { name: tx('bucket.katalog') }).click();
    const sheet = page.getByRole('dialog');
    const add = sheet
      .getByRole('button', {
        name: new RegExp(`^${esc(tx('knapp.lagg-till'))}: `),
      })
      .first();
    const name = (await add.getAttribute('aria-label'))!.split(': ').slice(1).join(': ');
    await add.click();
    await expect(sheet.getByRole('img', { name: tx('bucket.tillagd') }).first()).toBeVisible();
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
    await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
  });

  let tripUrl = '';
  await test.step('en resa skapas i planeraren och en utgift läggs in', async () => {
    await page.goto('/resor/planera');
    await page.getByLabel(tx('resor.steg.vart')).selectOption('NL');
    await page.getByLabel(tx('falt.titel')).fill('Röktest');
    await page.getByRole('button', { name: tx('knapp.spara'), exact: true }).click();
    await expect(page).toHaveURL(/\/resor\/[0-9a-f-]{36}$/, {
      timeout: 20_000,
    });
    tripUrl = new URL(page.url()).pathname;
    await page.goto(`${tripUrl}/kassa`);
    await page.getByRole('button', { name: tx('kassa.ny') }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel(tx('kassa.falt.vad')).fill('Röktest');
    await sheet.getByLabel(tx('kassa.falt.belopp')).fill('120');
    await sheet.getByRole('button', { name: tx('knapp.spara'), exact: true }).click();
    await expect(sheet).toBeHidden();
    await page
      .getByRole('button', { name: tx('kassa.vy.budget') })
      .click()
      .catch(() => undefined);
    await expect(page.getByText('Röktest').first()).toBeVisible();
  });

  await test.step('Idag slumpar en idé hemma och visar budget', async () => {
    await page.goto('/idag');
    await expect(page.locator('.chip.primary')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: tx('idag.vy.slumpa'), exact: true }).click();
    const hero = page.locator('button.hero.idea');
    await expect(hero).toBeVisible();
    // Idéer utan cost_level visar ingen budget: slumpa tills en med budget kommer.
    for (let i = 0; i < 25 && !(await hero.locator('.budget').isVisible()); i++) {
      await page.getByRole('button', { name: tx('idag.slumpa-igen') }).click();
    }
    await expect(hero.locator('.budget')).toContainText(tx('idag.budget.rubrik'));
  });

  await test.step('Valvet skapas, en post sparas, Valvet låses och låses upp', async () => {
    // Har testkontot redan ett valv hoppas bara det här steget över: ett befintligt valv rörs aldrig.
    if (!snap!.vaultEmpty) {
      test.info().annotations.push({ type: 'hoppade över', description: 'Valvet: testkontot har redan ett valv' });
      console.log('Valvet hoppades över: testkontot har redan ett valv.');
      return;
    }
    const code = `rt-${Math.random().toString(36).slice(2, 12)}`;
    await page.goto('/vi/valvet');
    await page.getByLabel(tx('valv.skapa-kod')).fill(code);
    await page.getByLabel(tx('valv.upprepa-kod')).fill(code);
    await page.getByRole('button', { name: tx('knapp.bekrafta') }).click();
    await page.getByRole('button', { name: tx('valv.ny') }).click({ timeout: 30_000 });
    await page
      .getByRole('dialog')
      .getByRole('button', { name: tx('valv.typ.annat') })
      .click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel(tx('valv.falt.rubrik')).fill('Röktest');
    await sheet.getByLabel(tx('valv.falt.text')).fill('Röktest');
    await sheet.getByRole('button', { name: tx('knapp.spara'), exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: new RegExp(esc(tx('valv.typ.annat'))) })).toBeVisible();
    await page.getByRole('button', { name: tx('valv.las'), exact: true }).click();
    await page.getByLabel(tx('valv.kod')).fill(code);
    await page.getByRole('button', { name: tx('valv.lasupp') }).click();
    await expect(page.getByRole('button', { name: new RegExp(esc(tx('valv.typ.annat'))) })).toBeVisible({ timeout: 30_000 });
  });

  await test.step('en undersida öppnas långt ned i en lista och bakåt hamnar på samma ställe', async () => {
    await page.goto('/listor?vy=samlingsbok&del=kort');
    const cards = page.locator('ul.bok button');
    await expect(cards.first()).toBeVisible({ timeout: 20_000 });
    const n = await cards.count();
    expect(n).toBeGreaterThan(30);
    // Ett kort långt ned som har en plats (raden i bottenarket leder till landssidan).
    let opened = false;
    for (let i = n - 1; i > n - 40 && !opened; i--) {
      // Mitt i bild, så att kortet inte ligger under den fasta navigeringen längst ned.
      await cards.nth(i).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await cards.nth(i).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      const link = page.getByRole('dialog').locator('a.li[href^="/karta/"]');
      if (await link.isVisible().catch(() => false)) {
        opened = true;
        break;
      }
      await page
        .getByRole('dialog')
        .getByRole('button', { name: tx('knapp.stang') })
        .click();
    }
    expect(opened).toBe(true);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(800);
    const listUrl = page.url();

    // Webbläsarens bakåtknapp.
    await page.getByRole('dialog').locator('a.li[href^="/karta/"]').click();
    await expect(page).toHaveURL(/\/karta\/[A-Z]{2}/);
    await page.goBack();
    await expect(page).toHaveURL(listUrl);
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeGreaterThan(before - 40);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(before + 40);
    await expect(page.getByRole('dialog')).toBeVisible();

    // Appens egen tillbakaknapp.
    await page.getByRole('dialog').locator('a.li[href^="/karta/"]').click();
    await expect(page).toHaveURL(/\/karta\/[A-Z]{2}/);
    // Ny navigering framåt börjar högst upp (när undersidans fil har laddats och sidan har ritats).
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeLessThan(50);
    await page.locator('a.back').first().click();
    await expect(page).toHaveURL(listUrl);
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeGreaterThan(before - 40);
  });

  expect(errors, 'Fel i sidan').toEqual([]);
});
