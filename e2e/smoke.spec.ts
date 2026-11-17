// Röktest: loggar in med testkontot i en 390 px bred mobilvy och går igenom appens viktigaste flöden.
// Hoppas över om TEST_EMAIL och TEST_PASSWORD saknas i .env.local. Städar efter sig (e2e/cleanup.ts).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { restore, snapshot, type Snapshot } from './cleanup';
import { credentials, hasTestAccount, testClient } from './env';
import { applyPatches, discoverRows } from '../scripts/lib/upptack.mjs';
import { COUNTRIES } from '../src/lib/countries';

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
// Engelska texterna (content/_texter.en.json), för steget som byter språk.
const TEXTER_EN = (
  JSON.parse(readFileSync(join(process.cwd(), 'content/_texter.en.json'), 'utf8').replace(/^\uFEFF/, '')) as { texter: Record<string, Entry> }
).texter;
const txEn = (key: string): string => {
  const e = TEXTER_EN[key];
  if (e === undefined) throw new Error(`Text saknas på engelska: ${key}`);
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

// Monaco (content/MC.json): månadens texter och händelser för Smart månad.
const MC = JSON.parse(readFileSync(join(process.cwd(), 'content/MC.json'), 'utf8').replace(/^﻿/, '')) as {
  places: { id: string; smart_months?: number[]; data: { month_notes?: string[]; events?: unknown[] } }[];
};
// Reykjavik (content/IS.json): säsonger i Smart månad.
const IS = JSON.parse(readFileSync(join(process.cwd(), 'content/IS.json'), 'utf8').replace(/^﻿/, '')) as {
  places: { id: string; data: { seasons?: unknown[] } }[];
};

const mc_june = () => MC.places.find((p) => p.id === 'MC-monaco')!.data.month_notes![5];

// USA:s delstater (content/US.json). Läggs in i svaret från places när Hugo inte har kört npm run import än.
const US_STATES = (
  JSON.parse(readFileSync(join(process.cwd(), 'content/US.json'), 'utf8').replace(/^\uFEFF/, '')) as {
    places: { id: string; layer?: string; name: string }[];
  }
).places.filter((p) => p.layer === 'delstat');

// Sveriges landskap (content/SE.json). Ritas som ytor i läget Regioner (public/geo/landskap.json).
const SE_LANDSKAP = new Set(
  (
    JSON.parse(readFileSync(join(process.cwd(), 'content/SE.json'), 'utf8').replace(/^﻿/, '')) as {
      places: { layer?: string; name: string }[];
    }
  ).places
    .filter((p) => p.layer === 'landskap')
    .map((p) => p.name),
);

/** Lägger till delstaterna i svaret från places om de saknas i databasen. */
async function injectStates(page: Page) {
  await page.route('**/rest/v1/places?*', async (route) => {
    const res = await route.fetch();
    const rows = (await res.json()) as { id: string }[];
    if (!Array.isArray(rows)) return route.fulfill({ response: res });
    const have = new Set(rows.map((r) => r.id));
    const add = US_STATES.filter((p) => !have.has(p.id)).map((p) => ({ iso2: null, airport: null, smart_months: null, data: {}, ...p }));
    await route.fulfill({ response: res, json: [...rows, ...add] });
  });
}

// Upptäck (content/_upptack.json). Läggs in i svaret från places när Hugo inte har kört npm run import än,
// med samma rader som importen skriver (scripts/lib/upptack.mjs).
const DISCOVER = (() => {
  const dir = join(process.cwd(), 'content');
  const read = (n: string) => JSON.parse(readFileSync(join(dir, n), 'utf8').replace(/^\uFEFF/, ''));
  const content = readdirSync(dir)
    .filter((f) => /^[A-Z]{2}\.json$/.test(f))
    .flatMap((f) => read(f).places as { id: string }[]);
  const names = new Intl.DisplayNames('sv-SE', { type: 'region' });
  const coords = (iso: string) => {
    const c = COUNTRIES.find(([x]) => x === iso);
    return c ? [c[1], c[2]] : null;
  };
  return discoverRows(read('_upptack.json'), content, (iso: string) => names.of(iso) ?? iso, coords) as {
    countries: { id: string }[];
    cities: { id: string; name: string }[];
    patches: Map<string, unknown>;
  };
})();

/** Lägger till Upptäcks platser och data i svaret från places om de saknas i databasen. */
async function injectDiscover(page: Page) {
  await page.route('**/rest/v1/places?*', async (route) => {
    const res = await route.fetch();
    const rows = (await res.json()) as { id: string }[];
    if (!Array.isArray(rows)) return route.fulfill({ response: res });
    const have = new Set(rows.map((r) => r.id));
    const add = [...DISCOVER.countries, ...DISCOVER.cities].filter((p) => !have.has(p.id));
    await route.fulfill({ response: res, json: [...applyPatches(rows, DISCOVER.patches), ...add] });
  });
}

test.describe.configure({ mode: 'serial' });
test.skip(!hasTestAccount, 'TEST_EMAIL och TEST_PASSWORD saknas i .env.local');

let snap: Snapshot | null = null;
/** Monaco (content/MC.json) finns i databasen först när Hugo har kört npm run import. */
let hasMonaco = false;
/** USA:s delstater (content/US.json) finns i databasen först när Hugo har kört npm run import. */
let hasStates = false;
/** Upptäcks lätta platser (content/_upptack.json) finns i databasen först när Hugo har kört npm run import. */
let hasDiscover = false;

test.beforeAll(async () => {
  const { db, userId } = await testClient();
  snap = await snapshot(db, userId);
  const { data } = await db.from('places').select('id, data').eq('id', 'MC-monaco').maybeSingle();
  hasMonaco = Boolean((data as { data?: { prices?: unknown } } | null)?.data?.prices);
  hasStates = Boolean((await db.from('places').select('id').eq('id', 'US-ca').maybeSingle()).data);
  const mc = await db.from('places').select('data').eq('id', 'MC-monaco').maybeSingle();
  hasDiscover =
    Boolean((await db.from('places').select('id').eq('id', 'BA-sarajevo').maybeSingle()).data) &&
    Boolean((mc.data as { data?: { alternatives?: unknown } } | null)?.data?.alternatives);
  // Röktestet går på svenska. Står testkontot på ett annat språk byts det här, och afterAll återställer det.
  const settings = (snap.settings ?? {}) as { theme?: Record<string, unknown> };
  if (settings.theme?.lang && settings.theme.lang !== 'sv')
    await db.from('profiles').update({ settings: { ...settings, theme: { ...settings.theme, lang: 'sv' } } }).eq('id', userId);
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
async function login(page: Page, button = tx('login.knapp-logga-in')) {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: button })).toBeVisible();
  await page.evaluate(({ email, password }) => {
    const set = (el: HTMLInputElement | null, v: string) => {
      if (!el) throw new Error('Fältet saknas');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set(document.querySelector('input[name=email]'), email);
    set(document.querySelector('input[name=password]'), password);
  }, credentials());
  await page.getByRole('button', { name: button }).click();
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

  await test.step('Monaco syns som flagga från zoomnivå 4 och öppnar landet', async () => {
    const flag = page.locator('button.map-flag[data-iso="MC"]');
    await expect(flag).toHaveCount(1, { timeout: 30_000 });
    await expect(flag.locator('img')).toHaveAttribute('src', '/flags/mc.svg');
    // Zooma in med tangentbordet tills punkterna visas.
    await page.locator('.map canvas').focus();
    for (let i = 0; i < 3 && !(await flag.isVisible()); i++) {
      await page.keyboard.press('+');
      await page.waitForTimeout(700);
    }
    await expect(flag).toBeVisible();
    // Punkten kan ligga utanför utsnittet, så klicket skickas direkt till knappen.
    await flag.dispatchEvent('click');
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('link', { name: tx('land.vy.oversikt') })).toHaveAttribute('href', '/karta/MC');
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
    await expect(sheet).toBeHidden();
  });

  const item =NL.items.find((i) => i.compendium_id && !snap!.checks.includes(i.id) && !snap!.finds.includes(i.compendium_id))!;
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
    // Par och grupp: Vår bok visar också det egna fyndet, med vem som hittade det. Solo har ingen växling.
    const ours = page.getByRole('button', { name: tx('samling.visa.var'), exact: true });
    if (await ours.count()) {
      await ours.click();
      await expect(page).toHaveURL(/bok=var/);
      const found = page.locator('.bok button.on', { has: page.locator('.bc-name', { hasText: new RegExp(`^${esc(card.name)}$`) }) });
      await expect(found.locator('.bc-by')).toBeVisible();
      await page.getByRole('button', { name: tx('samling.visa.min'), exact: true }).click();
      await expect(page).not.toHaveURL(/bok=/);
    }
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

    // Kort som inte är hittade visar ändå namn, sällsynthet och ledtråd, men ingen bock.
    const next = page.locator('.bok button:not(.on)').first();
    const nextName = (await next.locator('.bc-name').innerText()).trim();
    expect(nextName.length).toBeGreaterThan(1);
    expect(nextName).not.toBe('?');
    await expect(next.locator('.bc-found')).toHaveCount(0);
    await expect(next).toContainText(anyTone('samling.okant'));

    // Kortet bockas av i bottenarket, och tas sedan bort igen (samma kort, så att inget äldre fynd rörs).
    await next.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByLabel(tx('samling.nar'))).toBeVisible();
    await expect(sheet.getByLabel(tx('samling.var'))).toBeVisible();
    await expect(sheet.getByRole('heading', { name: nextName })).toBeVisible();
    await sheet.getByRole('button', { name: tx('samling.hittad-knapp') }).click();
    await expect(sheet).toBeHidden();
    const same = page.locator('.bok button.on', { has: page.locator('.bc-name', { hasText: new RegExp(`^${esc(nextName)}$`) }) });
    await expect(same.locator('.bc-found')).toHaveCount(1);
    await same.click();
    await page.getByRole('dialog').getByRole('button', { name: tx('samling.ta-bort-fynd') }).click();
    await expect(page.getByRole('dialog').getByRole('button', { name: tx('samling.hittad-knapp') })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: tx('knapp.stang') }).click();
  });

  await test.step('kompendium: en kategori fälls ut i listan, ett kort bockas av och tas bort, och ett kort öppnar bottenarket', async () => {
    await page.goto('/listor?vy=samlingsbok&del=kompendium');
    // En kategori där inte alla kort är hittade (räknaren visar 0 av något).
    const cats = page.locator('.komp > button[aria-expanded]');
    await expect(cats.first()).toBeVisible({ timeout: 20_000 });
    // Räknaren står i .cnt .mu: "{antal} av {totalt} hittade".
    const counter = new RegExp(`^${esc(tx('samling.raknare')).replace(/\\\{antal\\\}/, '(\\d+)').replace(/\\\{totalt\\\}/, '(\\d+)')}$`);
    let idx = -1;
    for (let i = 0; i < (await cats.count()) && idx < 0; i++) {
      const m = (await cats.nth(i).locator('.cnt .mu').innerText()).trim().match(counter);
      if (m && Number(m[1]) < Number(m[2])) idx = i;
    }
    expect(idx).toBeGreaterThanOrEqual(0);
    const cat = cats.nth(idx);
    await expect(cat).toHaveAttribute('aria-expanded', 'false');
    await cat.click();
    // Kategorin fälls ut på plats, utan att hoppa till Kort.
    await expect(cat).toHaveAttribute('aria-expanded', 'true');
    await expect(page).toHaveURL(/del=kompendium/);
    const list = page.locator('.komp-list');
    await expect(list).toBeVisible();
    const box = list.locator('button.box[aria-pressed=false]').first();
    const name = (await box.getAttribute('aria-label'))!;
    expect(name.length).toBeGreaterThan(1);
    const row = list.getByRole('button', { name, exact: true });
    const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/finds') && r.request().method() === 'POST' && r.ok());
    await row.click();
    await saved;
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    const removed = page.waitForResponse((r) => r.url().includes('/rest/v1/finds') && r.request().method() === 'DELETE' && r.ok());
    await row.click();
    await removed;
    await expect(row).toHaveAttribute('aria-pressed', 'false');
    // Ett tryck på kortets namn öppnar samma bottenark som i Kort.
    const first = list.locator('button.t').first();
    const firstName = (await first.locator('b').innerText()).trim();
    await first.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('heading', { name: firstName })).toBeVisible();
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
    await expect(sheet).toBeHidden();
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
    // Sökfältet med förslag: "mon" ger Monaco bland länderna (med flagga) och väljs.
    const vart = page.getByRole('combobox', { name: tx('resor.steg.vart') });
    await expect(vart).toHaveAttribute('placeholder', tx('resa.vart.sok'));
    await vart.fill('mon');
    const list = page.getByRole('listbox');
    await expect(list.getByRole('group', { name: tx('resa.vart.lander') })).toBeVisible();
    const monaco = list.getByRole('group', { name: tx('resa.vart.lander') }).getByRole('option', { name: 'Monaco', exact: true });
    await expect(monaco.locator('img[src="/flags/mc.svg"]')).toHaveCount(1);
    await monaco.click();
    await expect(vart).toHaveValue('Monaco');
    await expect(list).toBeHidden();
    // Inga träffar.
    await vart.fill('qqzz');
    await expect(page.getByText(tx('resa.vart.inga'))).toBeVisible();
    await vart.press('Escape');
    await vart.press('Escape');
    await expect(vart).toHaveValue('Monaco');
    // Längden räknas i dagar.
    await expect(page.getByLabel(tx('resa.langd.dagar'))).toBeVisible();
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
    // Ingressen under rubriken, högst två rader och inte avklippt.
    const ingress = page.locator('p.ingress');
    await expect(ingress).toHaveText(anyTone('ingress.idag'));
    const fit = await ingress.evaluate((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return { lines: Math.round(el.clientHeight / lh), clipped: el.scrollHeight > el.clientHeight + 1 };
    });
    expect(fit.lines).toBeLessThanOrEqual(2);
    expect(fit.clipped).toBe(false);
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

  await test.step('Monaco: landssidan öppnas och stadssidan visar prisnivån', async () => {
    if (!hasMonaco) {
      test.info().annotations.push({ type: 'hoppat över', description: 'MC-monaco med prices saknas i databasen (kör npm run import)' });
      return;
    }
    await page.goto('/karta/MC');
    await expect(page.getByRole('heading', { level: 1, name: 'Monaco' })).toBeVisible();
    await page.goto('/karta/MC-monaco');
    await expect(page.getByRole('heading', { name: tx('pris.rubrik'), exact: true })).toBeVisible();
    await expect(page.getByText(tx('pris.rad.hotell-3'), { exact: true })).toBeVisible();
  });

  await test.step('Monaco: Smart månad visar juni med Formel 1 under Händer då', async () => {
    // Har Hugo inte kört npm run import än saknas month_notes och events i databasen. Då läggs de
    // in från content/MC.json i svaret, så att rutan går att prova ändå.
    if (!hasMonaco) {
      test.info().annotations.push({ type: 'hoppat över', description: 'MC-monaco saknas i databasen (kör npm run import)' });
      return;
    }
    await page.route('**/rest/v1/places?*', async (route) => {
      const res = await route.fetch();
      const rows = (await res.json()) as { id: string; data: Record<string, unknown> }[];
      const mc = MC.places.find((p) => p.id === 'MC-monaco')!;
      const out = Array.isArray(rows)
        ? rows.map((r) =>
            r.id === 'MC-monaco' && !r.data?.month_notes
              ? { ...r, smart_months: mc.smart_months, data: { ...r.data, month_notes: mc.data.month_notes, events: mc.data.events } }
              : r,
          )
        : rows;
      await route.fulfill({ response: res, json: out });
    });
    await page.goto('/karta/MC-monaco?vy=manad');
    await expect(page.getByText(tx('smart.tryck'))).toBeVisible({ timeout: 20_000 });
    // Innevarande månad är förvald.
    await expect(page.locator('.bars.pick button[aria-pressed=true]')).toHaveCount(1);
    const juni = page.getByRole('button', { name: new RegExp(`^${esc(tx('smart.manad.betyg')).replace('\\{manad\\}', 'Juni').replace('\\{betyg\\}', '\\d')}(, .*)?$`) });
    await juni.focus();
    await page.keyboard.press('Enter');
    await expect(juni).toHaveAttribute('aria-pressed', 'true');
    const box = page.locator('.smart-month');
    await expect(box.getByRole('heading', { name: new RegExp(`^Juni`) })).toBeVisible();
    await expect(box.getByText(mc_june())).toBeVisible();
    await expect(box.getByRole('heading', { name: tx('smart.handelser.rubrik') })).toBeVisible();
    // Listan med händelser, inte säsongerna (MC-monaco har Formel 1 som säsong också).
    const events = box.locator('.smart-events:not(.smart-seasons)');
    await expect(events.getByText(/Formel 1/)).toBeVisible();
    await expect(events.getByRole('link', { name: 'autosport.com' })).toHaveAttribute('href', /autosport\.com/);
    await page.unroute('**/rest/v1/places?*');
  });

  await test.step('Island: Smart månad visar Lunnefåglar i juli och Norrsken men inte Lunnefåglar i december', async () => {
    // Har Hugo inte kört npm run import än saknas seasons i databasen. Då läggs de in från content/IS.json
    // i svaret (och hela platsen om den saknas), så att rutan går att prova ändå.
    const rey = IS.places.find((p) => p.id === 'IS-reykjavik')!;
    await page.route('**/rest/v1/places?*', async (route) => {
      const res = await route.fetch();
      const rows = (await res.json()) as { id: string; data: Record<string, unknown> }[];
      if (!Array.isArray(rows)) return route.fulfill({ response: res });
      const has = rows.some((r) => r.id === rey.id);
      const out = rows.map((r) => (r.id === rey.id && !r.data?.seasons ? { ...r, data: { ...r.data, seasons: rey.data.seasons } } : r));
      await route.fulfill({ response: res, json: has ? out : [...out, { iso2: null, airport: null, layer: null, smart_months: null, ...rey }] });
    });
    await page.goto('/karta/IS-reykjavik?vy=manad');
    await expect(page.locator('.bars.pick')).toBeVisible({ timeout: 20_000 });
    const month = (name: string) =>
      page.getByRole('button', { name: new RegExp(`^${esc(tx('smart.manad.betyg')).replace('\\{manad\\}', name).replace('\\{betyg\\}', '\\d')}`) });
    const box = page.locator('.smart-month');
    const seasons = box.locator('.smart-seasons');
    await month('Juli').click();
    await expect(month('Juli')).toHaveAttribute('aria-pressed', 'true');
    await expect(month('Juli')).toHaveAttribute('aria-label', new RegExp(esc(tx('smart.sasong.aria')).replace('\\{antal\\}', '\\d+')));
    await expect(box.getByRole('heading', { name: tx('smart.sasonger.rubrik') })).toBeVisible();
    await expect(seasons.getByText('Lunnefåglar', { exact: true })).toBeVisible();
    await expect(page.locator('.bars.pick .sdot.on')).toHaveCount(12);
    await month('December').click();
    await expect(month('December')).toHaveAttribute('aria-pressed', 'true');
    await expect(seasons.getByText('Norrsken', { exact: true })).toBeVisible();
    await expect(seasons.getByText('Lunnefåglar', { exact: true })).toHaveCount(0);
    await page.unroute('**/rest/v1/places?*');
  });

  await test.step('Regioner: läget visar tomt läge utzoomat och landskapen som ytor inzoomat', async () => {
    await page.goto('/karta?lage=regioner');
    await expect(page.getByRole('button', { name: tx('karta.lage.regioner'), exact: true })).toHaveAttribute('aria-pressed', 'true');
    const canvas = page.locator('.map canvas');
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    // Europa från start: för långt ut för regionerna.
    await expect(page.getByText(tx('karta.regioner.tom'))).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    // Punkten i Sverige (15° O, 62° N) på kartan, som har passats in på Europa (MAP_BOUNDS, 8 px marginal) i Mercator.
    // Punkten räknas relativt kartan: hjulet zoomar kring muspekaren, så platsen ligger kvar under den.
    // Sidan kan skrollas medan kartan laddar, så kartans läge mäts på nytt före varje hjulsteg och klick.
    const first = (await canvas.boundingBox())!;
    const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const [w, s, e, n] = [-12, 34, 35, 71];
    const scale = Math.min((first.width - 16) / (((e - w) * Math.PI) / 180), (first.height - 16) / (merc(n) - merc(s)));
    const rel = {
      x: first.width / 2 + ((15 - (w + e) / 2) * Math.PI * scale) / 180,
      y: first.height / 2 - (merc(62) - (merc(n) + merc(s)) / 2) * scale,
    };
    const at = async (dx = 0, dy = 0) => {
      await canvas.scrollIntoViewIfNeeded();
      const b = (await canvas.boundingBox())!;
      return { x: b.x + rel.x + dx, y: b.y + rel.y + dy };
    };
    for (let i = 0; i < 30 && (await page.getByText(tx('karta.regioner.tom')).count()); i++) {
      const p = await at();
      await page.mouse.move(p.x, p.y);
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1200);
    await expect(page.getByText(tx('karta.regioner.tom'))).toHaveCount(0);
    // Landskapen har ytor och visas inte längre som punkter.
    await expect(page.locator('button.map-region')).toHaveCount(0);
    const sheet = page.getByRole('dialog');
    let picked = '';
    for (const [dx, dy] of [[0, 0], [0, -30], [0, 30], [-30, 0], [30, 0]]) {
      const p = await at(dx, dy);
      await page.mouse.click(p.x, p.y);
      if (await sheet.isVisible().catch(() => false)) {
        picked = (await sheet.getByRole('heading').first().textContent()) ?? '';
        if (SE_LANDSKAP.has(picked)) break;
        await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
      }
      await page.waitForTimeout(300);
    }
    expect(SE_LANDSKAP.has(picked), `Inget landskap träffades (${picked})`).toBe(true);
    // Samma bottenark som en delstat.
    await expect(sheet.getByRole('button', { name: tx('karta.status.besokt'), exact: true })).toBeVisible();
    await expect(sheet.getByRole('link', { name: tx('land.vy.oversikt') })).toHaveAttribute('href', /^\/karta\/SE-[a-z]+$/);
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
    await expect(sheet).toBeHidden();
  });

  await test.step('Regioner: en delstat i USA går att trycka på i kartan och får status Besökt', async () => {
    if (!hasStates) await injectStates(page);
    await page.goto('/karta?lage=regioner&fokus=varlden');
    const canvas = page.locator('.map canvas');
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(tx('karta.regioner.tom'))).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    // Zooma med hjulet över västra USA (världen ryms på bredden, kartan är 358 × 340 px).
    const box = (await canvas.boundingBox())!;
    // Punkten ungefär över mitten av USA: världen fyller bredden (8 px marginal).
    const at = { x: box.x + 8 + (box.width - 16) * ((-100 + 170) / 360), y: box.y + box.height * 0.42 };
    await page.mouse.move(at.x, at.y);
    for (let i = 0; i < 30 && (await page.getByText(tx('karta.regioner.tom')).count()); i++) {
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1200);
    await expect(page.getByText(tx('karta.regioner.tom'))).toHaveCount(0);
    const sheet = page.getByRole('dialog');
    const names = new Set(US_STATES.map((p) => p.name));
    let picked = '';
    for (const [dx, dy] of [[0, 0], [0, -40], [0, -80], [0, -120], [-40, -60], [40, -60], [0, 40], [0, -160]]) {
      await page.mouse.click(at.x + dx, at.y + dy);
      if (await sheet.isVisible().catch(() => false)) {
        picked = (await sheet.getByRole('heading').first().textContent()) ?? '';
        if (names.has(picked)) break;
        await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
      }
      await page.waitForTimeout(300);
    }
    expect(names.has(picked), `Ingen delstat träffades (${picked})`).toBe(true);
    const besokt = sheet.getByRole('button', { name: tx('karta.status.besokt'), exact: true });
    if ((await besokt.getAttribute('aria-pressed')) !== 'true') await besokt.click();
    await expect(besokt).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.getByRole('link', { name: tx('land.vy.oversikt') })).toHaveAttribute('href', /^\/karta\/US-[a-z]+$/);
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
    await expect(sheet).toBeHidden();
  });

  await test.step('Regioner: Kalifornien bockas av på USA:s sida och räknaren ändras, landet ändras inte', async () => {
    await page.goto('/karta/US');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    const usStatus = await page.locator('.hero-sub').first().textContent();
    await expect(page.getByRole('heading', { name: tx('karta.regioner.i-landet').replace('{plats}', 'USA') })).toBeVisible();
    const row = page.getByRole('button', { name: new RegExp(`^${esc(tx('karta.regioner.delstat'))}`) });
    await row.click();
    const sheet = page.getByRole('dialog');
    const ca = sheet.getByRole('button', { name: 'Kalifornien', exact: true });
    const counter = sheet.locator('p.mu').first();
    const count = async () => Number(/^(\d+)/.exec((await counter.textContent()) ?? '')?.[1] ?? NaN);
    const before = await count();
    const wasOn = (await ca.getAttribute('aria-pressed')) === 'true';
    await ca.click();
    await expect(ca).toHaveAttribute('aria-pressed', wasOn ? 'false' : 'true');
    await expect.poll(count).toBe(wasOn ? before - 1 : before + 1);
    expect(await counter.textContent()).toMatch(/av 51 /);
    if (wasOn) await ca.click();
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
    // En besökt delstat gör inte landet besökt.
    await expect(page.locator('.hero-sub').first()).toHaveText(usStatus ?? '');
    if (!hasStates) await page.unroute('**/rest/v1/places?*');
  });

  await test.step('tillsammans: ett land besökt tillsammans får sin färg på Min karta och Vår karta och räknas i Vi', async () => {
    // Testkontot har ingen partner: testet skapar en egen pargrupp (bara testkontot som medlem) och gör den aktiv.
    // Gruppen tas bort och reseläget återställs i slutet av steget, och afterAll städar om något går fel.
    const { db, userId } = await testClient();
    const { data: gid, error } = await db.rpc('create_group', { group_name: 'E2E tillsammans', group_kind: 'par' });
    expect(error, error?.message).toBeNull();
    try {
      const upd = await db.from('profiles').update({ active_group_id: gid, travel_mode: 'par' }).eq('id', userId);
      expect(upd.error, upd.error?.message).toBeNull();

      // Italien på landssidan: Besökt, sedan Tillsammans med gruppen.
      await page.goto('/karta/IT');
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toBeVisible({ timeout: 20_000 });
      const name = (await h1.textContent()) ?? '';
      const besokt = page.getByRole('button', { name: tx('karta.status.besokt'), exact: true });
      if ((await besokt.getAttribute('aria-pressed')) !== 'true') await besokt.click();
      await expect(besokt).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('heading', { name: tx('karta.sallskap.rubrik') })).toBeVisible();
      await expect(page.getByText(tx('karta.sallskap.hjalp'))).toBeVisible();
      // Förvalt är Bara jag.
      await expect(page.getByRole('button', { name: tx('karta.sallskap.jag'), exact: true })).toHaveAttribute('aria-pressed', 'true');
      const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/place_status') && r.request().method() === 'POST' && r.ok());
      const together = page.getByRole('button', { name: tx('karta.sallskap.tillsammans').replace('{grupp}', 'E2E tillsammans'), exact: true });
      await together.click();
      await saved;
      await expect(together).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(new RegExp(`${esc(name)}: .*E2E tillsammans`))).toBeVisible();
      const stored = await db.from('place_status').select('status, together_group').eq('user_id', userId).eq('place_id', 'IT').single();
      expect(stored.data).toEqual({ status: 'besokt', together_group: gid });

      // Min karta: landet har färgen för tillsammans (ringen runt flaggan i listan har samma färg som kartan).
      await page.goto('/karta');
      const expected = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--st-tillsammans').trim().toUpperCase());
      expect(expected).toMatch(/^#[0-9A-F]{6}$/);
      const ring = async () =>
        ((await page.locator('a[href="/karta/IT"] .flag, a[href="/karta/IT"] .badge').first().getAttribute('style')) ?? '').toUpperCase();
      await expect.poll(ring, { timeout: 20_000 }).toContain(expected);
      await expect(page.getByRole('heading', { name: tx('karta.forklaring.rubrik') })).toBeVisible();
      await expect(page.locator('.lg').getByText(tx('karta.forklaring.tillsammans'), { exact: true })).toBeVisible();
      await expect(page.locator('.lg').getByText(tx('karta.forklaring.sjalv'), { exact: true })).toBeVisible();

      // Vår karta: samma färg, och förklaringen har de fyra färgerna.
      await page.getByRole('group', { name: tx('karta.vy.aria') }).getByRole('button', { name: tx('karta.visa.var'), exact: true }).click();
      await expect.poll(ring).toContain(expected);
      for (const k of ['karta.forklaring.tillsammans', 'karta.forklaring.bada', 'karta.forklaring.bara-jag'])
        await expect(page.locator('.lg').getByText(tx(k), { exact: true })).toBeVisible();

      // Knappen för landlistan intill lägesväljaren öppnar samma val som under Anpassning.
      await page.getByRole('button', { name: tx('karta.landlista.aria') }).click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByRole('radio')).toHaveCount(4);
      await sheet.getByRole('button', { name: tx('knapp.stang') }).click();

      // Vi i läget Tillsammans (förvalt): landet räknas.
      await page.goto('/vi');
      const views = page.getByRole('group', { name: tx('vi.vy.aria') });
      await expect(views.getByRole('button', { name: tx('vi.vy.tillsammans'), exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
      await expect(page.getByText(tx('vi.vy.hjalp.tillsammans'))).toBeVisible();
      await page.locator('button.card.stat', { hasText: tx('vi.siffror.lander') }).first().click();
      await expect(page.getByRole('dialog').getByText(name, { exact: true })).toBeVisible();
      await page.getByRole('dialog').getByRole('button', { name: tx('knapp.stang') }).click();
    } finally {
      await db.from('profiles').update({ active_group_id: snap!.groupId, travel_mode: snap!.travelMode }).eq('id', userId);
      await db.from('groups').delete().eq('id', gid);
      await db.auth.signOut();
    }
    // Tillbaka i testkontots vanliga grupp.
    await page.goto('/karta');
  });

  await test.step('Upptäck: billigast ger Sarajevo men inte Monaco, Sarajevo sparas som Vill åka, Monaco visar Menton', async () => {
    if (!hasDiscover) await injectDiscover(page);
    const { db, userId } = await testClient();
    // Har Sarajevo redan en status tas den bort under steget. afterAll lägger tillbaka den.
    await db.from('place_status').delete().eq('user_id', userId).eq('place_id', 'BA-sarajevo');
    try {
      await page.goto('/karta');
      const nav = page.locator('nav.nav');
      // Sex flikar och Upptäck direkt efter Karta. Raden får plats på 390 px utan att rulla i sidled.
      await expect(nav.getByRole('link')).toHaveCount(6);
      await expect(nav.getByRole('link').nth(1)).toHaveText(tx('flik.upptack'));
      expect(await nav.evaluate((n) => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
      await nav.getByRole('link', { name: tx('flik.upptack'), exact: true }).click();
      await expect(page).toHaveURL(/\/upptack$/);
      await expect(page.getByRole('heading', { level: 1, name: tx('flik.upptack') })).toBeVisible();
      await expect(page.getByText(tx('ingress.upptack'))).toBeVisible();

      const open = (name: string) => page.getByRole('link', { name: tx('upptack.kort.oppna').replace('{plats}', name), exact: true });
      await expect(open('Sarajevo')).toBeVisible({ timeout: 20_000 });
      await expect(open('Monaco')).toBeVisible();

      await page.getByRole('button', { name: tx('upptack.filter.rubrik'), exact: true }).click();
      await page.getByRole('button', { name: tx('upptack.pris.1'), exact: true }).click();
      await expect(page).toHaveURL(/[?&]pris=1(&|$)/);
      await expect(open('Sarajevo')).toBeVisible();
      await expect(open('Monaco')).toHaveCount(0);

      // Spara Sarajevo som Vill åka.
      const card = page.locator('article.disc-card', { has: open('Sarajevo') });
      const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/place_status') && r.request().method() === 'POST' && r.ok());
      await card.getByRole('button', { name: tx('upptack.kort.vill'), exact: true }).click();
      await saved;
      await expect(card.getByText(tx('upptack.kort.sparad'), { exact: true })).toBeVisible();
      const stored = await db.from('place_status').select('status').eq('user_id', userId).eq('place_id', 'BA-sarajevo').single();
      expect(stored.data).toEqual({ status: 'vill' });

      // Kortet öppnar platsen, och tillbaka står filtret kvar.
      await open('Sarajevo').click();
      await expect(page).toHaveURL(/\/karta\/BA-sarajevo$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Sarajevo' })).toBeVisible();
      await expect(page.getByRole('button', { name: tx('karta.status.vill-aka'), exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(tx('upptack.pris.1'), { exact: true })).toBeVisible();
      await page.getByRole('link', { name: tx('knapp.tillbaka') }).click();
      await expect(page).toHaveURL(/\/upptack\?pris=1$/);
      await expect(open('Sarajevo')).toBeVisible();
      await expect(open('Monaco')).toHaveCount(0);

      // Monaco: rutan med alternativ har Menton.
      await page.goto('/karta/MC-monaco');
      const box = page.locator('section.alt-box');
      await expect(box.getByRole('heading', { name: tx('upptack.alt.rubrik'), exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(box.getByRole('link', { name: /Menton/ })).toHaveAttribute('href', '/karta/FR-menton');
    } finally {
      // Städa: Sarajevo får ingen status kvar.
      await db.from('place_status').delete().eq('user_id', userId).eq('place_id', 'BA-sarajevo');
      await db.auth.signOut();
      if (!hasDiscover) await page.unroute('**/rest/v1/places?*');
    }
  });

  await test.step('Vi: rutan Kontinenter visar världsdelarnas namn, inte koder', async () => {
    await page.goto('/vi');
    const tile = page.locator('button.card.stat', { hasText: tx('vi.siffror.kontinenter') }).first();
    await expect(tile).toBeVisible({ timeout: 20_000 });
    if ((await tile.locator('.num').textContent())?.trim() === '0') return;
    await tile.click();
    const sheet = page.getByRole('dialog');
    const names = ['002', '142', '150', '003', '005', '009', '010'].map((c) => tx(`kontinent.${c}`));
    await expect(sheet.locator('.li b').first()).toBeVisible();
    const shown = await sheet.locator('.li b').allTextContents();
    for (const x of shown) expect(names, `${x} ska vara en världsdel`).toContain(x.trim());
    await sheet.getByRole('button', { name: tx('knapp.stang') }).click();
  });

  await test.step('Landlista: FN:s medlemsländer ger nämnaren 193 på Jag, och sedan tillbaka till alla', async () => {
    await page.goto('/vi/anpassning');
    await expect(page.getByText(tx('landlista.rubrik'))).toBeVisible();
    const alla = page.getByRole('radio', { name: new RegExp(`^${esc(tx('landlista.alla')).replace('\\{totalt\\}', '\\d+')}$`) });
    const fn = page.getByRole('radio', { name: tx('landlista.fn').replace('{totalt}', '193'), exact: true });
    let saved = page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH' && r.ok());
    await fn.check();
    await saved;
    await page.goto('/vi');
    const tile = page.locator('button.card.stat', { hasText: tx('vi.siffror.lander') }).first();
    await expect(tile.locator('.num')).toHaveText(/^\d+ av 193$/, { timeout: 20_000 });
    await page.goto('/vi/anpassning');
    saved = page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH' && r.ok());
    await alla.check();
    await saved;
    await expect(alla).toBeChecked();
  });

  await test.step('kartan: fokus Asien, helskärm med Escape, egen färg på vill åka och släckt besökt (Körning 16)', async () => {
    const patched = () => page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH' && r.ok());
    await page.goto('/karta');
    await expect(page.locator('.map canvas')).toBeVisible({ timeout: 30_000 });

    // Fokus: Asien i rullgardinen. Valet står i adressen och sparas i profilen.
    const focusBtn = page.getByRole('button', { name: new RegExp(`^${esc(tx('karta.fokus.aria'))}`) });
    await expect(focusBtn).toHaveAccessibleName(`${tx('karta.fokus.aria')} ${tx('kontinent.150')}`);
    await focusBtn.click();
    await expect(page.getByRole('heading', { name: tx('karta.fokus.rubrik.varldsdelar') })).toBeVisible();
    await expect(page.getByLabel(tx('karta.fokus.sok'))).toBeVisible();
    let saved = patched();
    await page.getByRole('button', { name: tx('kontinent.142'), exact: true }).click();
    await saved;
    await expect(page).toHaveURL(/fokus=142/);
    await expect(focusBtn).toHaveAccessibleName(`${tx('karta.fokus.aria')} ${tx('kontinent.142')}`);
    await expect(focusBtn).toBeFocused();

    // Helskärm: täcker flikraden, står i adressen och stängs med Escape. Fokus tillbaka till knappen.
    const open = page.getByRole('button', { name: tx('karta.helskarm.oppna'), exact: true });
    await open.click();
    await expect(page).toHaveURL(/helskarm=1/);
    const close = page.getByRole('button', { name: tx('karta.helskarm.stang'), exact: true });
    await expect(close).toBeVisible();
    await expect(page.locator('main.karta.fs')).toBeVisible();
    await expect(page.locator('nav.nav')).toHaveJSProperty('inert', true);
    await expect(page.getByRole('button', { name: tx('karta.helskarm.panel'), exact: true })).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/helskarm/);
    await expect(page.locator('main.karta.fs')).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(page.locator('nav.nav')).toHaveJSProperty('inert', false);

    // Egen färg på vill åka: syns i förklaringen. Sedan återställs den.
    await page.goto('/vi/anpassning');
    await expect(page.getByRole('heading', { name: tx('farger.rubrik') })).toBeVisible();
    const vill = page.getByLabel(tx('farger.valj').replace('{status}', tx('karta.status.vill-aka')), { exact: true });
    saved = patched();
    await vill.fill('#123abc');
    await saved;
    await expect(page.getByText(tx('farger.sparat'))).toBeVisible();
    const swatch = () => page.locator('.legend .lg span', { hasText: new RegExp(`^${esc(tx('karta.status.vill-aka'))}$`) }).locator('i');
    await page.goto('/karta');
    await expect(swatch()).toHaveCSS('background-color', 'rgb(18, 58, 188)');
    await page.goto('/vi/anpassning');
    saved = patched();
    await page.getByRole('button', { name: tx('farger.aterstall'), exact: true }).click();
    await saved;
    await expect(page.getByRole('button', { name: tx('farger.aterstall'), exact: true })).toBeDisabled();
    await page.goto('/karta');
    await expect(swatch()).toBeVisible();
    await expect(swatch()).not.toHaveCSS('background-color', 'rgb(18, 58, 188)');

    // Släck besökt: knappen blir släckt och ingen rad i listan har statusen besökt.
    const show = page.getByRole('group', { name: tx('karta.lista.visa.aria') });
    const besoktName = new RegExp(`^(${esc(tx('karta.status.besokt'))}|${esc(tx('karta.forklaring.sjalv'))})$`);
    const btn = show.getByRole('button', { name: besoktName });
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    const label = (await btn.textContent())!.trim();
    const list = page.locator('section.pl');
    const unfold = async () => {
      const closed = list.locator('button.pl-fold[aria-expanded=false]');
      for (let i = 0; i < 50 && (await closed.count()); i++) await closed.first().click();
    };
    await expect(list.locator('.pl-cont').first()).toBeVisible({ timeout: 20_000 });
    await unfold();
    // Röktestet har satt Besökt på en delstat i USA tidigare, så minst en rad har statusen.
    await expect(list.locator('.li .mu', { hasText: new RegExp(`^${esc(label)}$`) }).first()).toBeVisible();
    saved = patched();
    await btn.click();
    await saved;
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await unfold();
    await expect(list.locator('.li .mu', { hasText: new RegExp(`^${esc(label)}$`) })).toHaveCount(0);
    // Tänd igen, och tillbaka till Europa (afterAll lägger också tillbaka inställningarna).
    saved = patched();
    await btn.click();
    await saved;
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await focusBtn.click();
    saved = patched();
    await page.getByRole('button', { name: tx('kontinent.150'), exact: true }).click();
    await saved;
  });

  await test.step('större skärmar: menyn står till vänster från 900 px och ingen sida rullar i sidled', async () => {
    const paths = ['/karta', '/upptack', '/idag', '/listor', '/resor', '/vi', '/vi/anpassning', '/karta/SE'];
    try {
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of paths) {
          await page.goto(path);
          await expect(page.locator('nav.nav')).toBeVisible({ timeout: 20_000 });
          await page.waitForTimeout(600);
          const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(over, `${path} rullar i sidled vid ${width} px`).toBeLessThanOrEqual(0);
          if (width === 1440) {
            const nav = (await page.locator('nav.nav').boundingBox())!;
            expect(nav.x, `menyn vid ${path}`).toBe(0);
            expect(nav.width).toBeLessThan(160);
            expect(nav.height).toBeGreaterThan(800);
          }
        }
      }
      // Kartan fyller höjden till höger om menyn, och kolumnen till höger har listan.
      await page.goto('/karta');
      const map = (await page.locator('.k-map').boundingBox())!;
      const nav = (await page.locator('nav.nav').boundingBox())!;
      expect(map.x).toBeGreaterThanOrEqual(nav.width - 1);
      expect(map.height).toBeGreaterThan(880);
      await expect(page.locator('aside.k-side section.pl')).toBeVisible();
    } finally {
      await page.setViewportSize({ width: 390, height: 844 });
    }
  });

  await test.step('engelska: flikarna och inloggningssidan byter språk, och sedan tillbaka till svenska', async () => {
    await page.goto('/vi/anpassning');
    const saved = page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH' && r.ok());
    await page.getByRole('button', { name: tx('sprak.en'), exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    const nav = page.locator('nav.nav');
    for (const name of ['Map', 'Today', 'Lists', 'Trips']) await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    // Innehållet ur databasen finns bara på svenska: sägs en gång under språkvalet.
    await expect(page.getByText(txEn('sprak.innehall-svenska'))).toBeVisible();
    // Valet sparas i profilen.
    await saved;
    // Prisnivån på engelska.
    if (hasMonaco) {
      await page.goto('/karta/MC-monaco');
      await expect(page.getByRole('heading', { name: txEn('pris.rubrik'), exact: true })).toBeVisible();
      await expect(page.getByText(txEn('pris.rad.hotell-3'), { exact: true })).toBeVisible();
    }

    // Utloggad: inloggningssidan följer valt språk.
    await page.goto('/vi');
    await page.getByRole('button', { name: txEn('knapp.logga-ut') }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: txEn('login.knapp-logga-in') })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // In igen och tillbaka till svenska.
    await login(page, txEn('login.knapp-logga-in'));
    await page.goto('/vi/anpassning');
    const back = page.waitForResponse((r) => r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH' && r.ok());
    await page.getByRole('button', { name: tx('sprak.sv'), exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    for (const k of ['flik.karta', 'flik.idag', 'flik.listor', 'flik.resor'])
      await expect(nav.getByRole('link', { name: tx(k), exact: true })).toBeVisible();
    await expect(page.getByText(txEn('sprak.innehall-svenska'))).toHaveCount(0);
    await back;
  });

  expect(errors, 'Fel i sidan').toEqual([]);
});
