// Tillgänglighet: kör axe (WCAG 2.1 A och AA) på varje flik och undersida i 390 px mobilvy, och från Körning 17
// också på 1440 px (menyn till vänster och rutnäten).
// Läser bara, skriver ingenting. Hoppas över utan testkonto.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { credentials, hasTestAccount } from './env';

test.skip(!hasTestAccount, 'TEST_EMAIL och TEST_PASSWORD saknas i .env.local');

async function login(page: Page) {
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
}

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(600);
  const r = await new AxeBuilder({ page })
    // AXE_ALLA=1 tar med axe:s bästa praxis (rubrikordning, landmärken) för genomgång.
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', ...(process.env.AXE_ALLA ? ['best-practice'] : [])])
    // Kartans canvas och MapLibres egna kontroller ligger utanför appens kod.
    .exclude('.maplibregl-canvas')
    .exclude('.maplibregl-ctrl')
    .analyze();
  return r.violations.map(
    (v) =>
      `${path}: ${v.id} (${v.impact}) ${v.nodes.length} st: ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
}

for (const width of [390, 1440])
test(`axe på alla flikar och undersidor (${width} px)`, async ({ page }) => {
  if (width !== 390) await page.setViewportSize({ width, height: 900 });
  await login(page);
  await page.goto('/resor');
  const tripHref = await page
    .locator('a[href^="/resor/"][href$=""]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')!).find((h) => /^\/resor\/[0-9a-f-]{36}$/.test(h)));
  const paths = [
    '/karta',
    '/karta?lage=smart',
    '/karta/NL',
    '/karta/NL?vy=lista',
    '/karta/NL?vy=guide',
    '/karta/NL?vy=manad',
    '/karta/NL?vy=boka',
    '/karta/MC-monaco?vy=manad',
    '/upptack',
    '/upptack?pris=4,5',
    '/idag',
    '/listor?vy=samlingsbok',
    '/listor?vy=samlingsbok&del=kompendium',
    '/listor?vy=samlingsbok&del=samlingar',
    '/listor?vy=bucketlist',
    '/listor?vy=bucketlist&katalog=1',
    '/listor?vy=swipe',
    '/listor?vy=swipe&del=lista',
    '/resor',
    '/resor/planera',
    '/resor/importera',
    ...(tripHref
      ? [tripHref, `${tripHref}/kassa`, `${tripHref}/pack`, `${tripHref}/innan`, `${tripHref}/bokningar`, `${tripHref}/inkop`]
      : []),
    '/vi',
    '/vi?vy=wrapped',
    '/vi/anpassning',
    '/vi/valvet',
    '/vi/guide',
    '/vi/export',
  ];
  const found: string[] = [];
  for (const p of paths) found.push(...(await scan(page, p)));
  if (found.length) console.log(found.join('\n'));
  expect(found).toEqual([]);
});
