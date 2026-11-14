// Röktest i webbläsare: npm run test:e2e. Startar appen lokalt och kör e2e/ i en 390 px bred mobilvy.
// Testkontot (TEST_EMAIL och TEST_PASSWORD) läses ur .env.local i e2e/env.ts. Uppgifterna skrivs aldrig ut:
// trace, video och HTML-rapport är avstängda, och fälten fylls utan att värdena syns i testets steg.
// Två projekt: utveckling (vite dev) för röktestet och tillgängligheten, och bygget (vite preview,
// med service worker) för offline.
import { defineConfig } from '@playwright/test';

const DEV = 5179;
const BUILD = 5180;

export default defineConfig({
  testDir: 'e2e',
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'sv-SE',
    timezoneId: 'Europe/Stockholm',
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'dev', testIgnore: /offline\.spec/, use: { baseURL: `http://localhost:${DEV}` } },
    { name: 'bygge', testMatch: /offline\.spec/, use: { baseURL: `http://localhost:${BUILD}`, serviceWorkers: 'allow' } },
  ],
  webServer: [
    {
      command: `npx vite --port ${DEV} --strictPort`,
      url: `http://localhost:${DEV}`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx vite build && npx vite preview --port ${BUILD} --strictPort`,
      url: `http://localhost:${BUILD}`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
