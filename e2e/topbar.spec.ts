// Röktest för topplisten på Karta: listen har en egen rad överst, och knapparna under den
// (Min karta och Vår karta, kartlägena och Europa eller världen) täcks aldrig av den.
// Provas i bredderna 360, 390 och 430 px, med och utan safe-area (en telefon med notch simuleras
// med CSS-variabeln --safe-top, som topplisten använder före env(safe-area-inset-top)).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { credentials, hasTestAccount } from './env';

const TEXTER = (
  JSON.parse(readFileSync(join(process.cwd(), 'content/_texter.json'), 'utf8').replace(/^﻿/, '')) as {
    texter: Record<string, string | Record<string, string>>;
  }
).texter;
const tx = (key: string): string => {
  const e = TEXTER[key];
  return typeof e === 'string' ? e : e.neutral;
};

test.skip(!hasTestAccount, 'TEST_EMAIL och TEST_PASSWORD saknas i .env.local');

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

/** Varje knapp under listen: ligger nedanför den, och mittpunkten träffar knappen själv (inget ligger över). */
async function uncovered(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.topbar')!.getBoundingClientRect();
    const buttons = [...document.querySelectorAll<HTMLElement>('main .chips button, main .map .zoom button')];
    return {
      count: buttons.length,
      bad: buttons
        .map((b) => {
          const r = b.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          const ok = r.top >= bar.bottom - 0.5 && Boolean(hit && b.contains(hit));
          return ok ? null : `${b.textContent?.trim()} (topp ${Math.round(r.top)}, listen slutar ${Math.round(bar.bottom)})`;
        })
        .filter(Boolean),
    };
  });
}

test('topplisten på Karta täcker inte knapparna', async ({ page }) => {
  await login(page);
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('main .chips button').first()).toBeVisible();
  const visaMin = page.getByRole('button', { name: tx('karta.visa.min'), exact: true });
  const parOrGrupp = await visaMin.isVisible();
  if (parOrGrupp) await expect(page.getByRole('button', { name: tx('karta.visa.var'), exact: true })).toBeVisible();

  for (const safe of ['0px', '47px']) {
    await page.evaluate((v) => document.documentElement.style.setProperty('--safe-top', v), safe);
    for (const width of [360, 390, 430]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(150);
      const r = await uncovered(page);
      expect(r.count, 'Knappar under listen').toBeGreaterThan(parOrGrupp ? 7 : 5);
      expect(r.bad, `Täckta knappar vid ${width} px och safe-area ${safe}`).toEqual([]);
      // Min karta och Vår karta ligger direkt under rubriken, nedanför listen.
      if (parOrGrupp) {
        const bar = (await page.locator('.topbar').boundingBox())!;
        const btn = (await visaMin.boundingBox())!;
        expect(btn.y).toBeGreaterThanOrEqual(bar.y + bar.height);
      }
    }
  }
});
