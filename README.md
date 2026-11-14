# Globedex

Rese-, bucketlist- och samlingsapp med solo-, par- och gruppläge. Vite, React och TypeScript, med Supabase som databas och inloggning, MapLibre med OpenFreeMap för kartan, och en PWA som går att installera och läsa offline.

Facit för utseende och flöden är `docs/prototyp.html`. Databasen är `docs/schema.sql`. Reglerna för arbetet står i `CLAUDE.md`.

## Köra lokalt

Kräver Node 20 eller senare.

1. Installera beroenden:
   ```
   npm install
   ```
2. Skapa `.env.local` i projektmappen med samma rader som `.env.example`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   TEST_EMAIL=
   TEST_PASSWORD=
   ```
   - `VITE_SUPABASE_URL` och `VITE_SUPABASE_PUBLISHABLE_KEY` används av appen.
   - `SUPABASE_SECRET_KEY` används bara av skripten (import och RLS-kontroll). Den får aldrig få prefixet `VITE_`, aldrig importeras i `src/` och aldrig läggas i Vercel.
   - `TEST_EMAIL` och `TEST_PASSWORD` är ett testkonto för röktestet. Valfria.
   - `.env.local` checkas aldrig in (står i `.gitignore`).
3. Starta:
   ```
   npm run dev
   ```
   Öppna adressen som visas (oftast http://localhost:5173). Appen är byggd för mobil: använd gärna webbläsarens mobilvy med 390 px bredd.

## Kommandon

| Kommando | Vad det gör |
|---|---|
| `npm run dev` | Startar appen lokalt |
| `npm run build` | Typkontroll och bygge till `dist/` |
| `npm run preview` | Visar bygget lokalt (med service worker och offline) |
| `npm run typecheck` | Bara typkontroll |
| `npm test` | Enhetstester (vitest) |
| `npm run test:e2e` | Röktest i webbläsare med testkontot (Playwright). Hoppas över utan `TEST_EMAIL` och `TEST_PASSWORD` |
| `npm run import:check` | Kontrollerar innehållet i `content/` utan att skriva något |
| `npm run import` | Läser in innehållet i `content/` till Supabase |
| `npm run rls:check` | Provar databasens regler som testkontot mot en annan grupps data |
| `npm run icons` | Skapar appikonerna i `public/` från `docs/logo/` |
| `npm run flags` | Kopierar landsflaggorna (flag-icons, MIT) till `public/flags/` |

Första gången du kör röktestet: `npx playwright install chromium`.

## Importera innehåll

Innehållet (länder, guider, regler, samlingsbok, bucketkatalog, idéer, presenttips) ligger som JSON i `content/`, en fil per land plus `_bucket.json`. Formatet står i `docs/FORMAT.md`. `_texter.json`, `_packlista.json` och `_innan-avresa.json` läses in i appen vid bygget och importeras inte.

1. Kontrollera filerna:
   ```
   npm run import:check
   ```
   Rätta felen som listas. Inget skrivs till databasen i det här steget.
2. Läs in:
   ```
   npm run import
   ```
   Skriptet använder `SUPABASE_SECRET_KEY` ur `.env.local`, skriver platser före det som pekar på dem och kontrollerar å, ä och ö efteråt. Raderna uppdateras på id, så det går att köra igen efter ändringar.

## Driftsätta på Vercel

`vercel.json` finns redan: den bygger med `npm run build`, serverar `dist/`, skickar alla adresser till `index.html` så att react-router fungerar, och låter service workern alltid hämtas på nytt.

1. Lägg projektet i ett GitHub-repo (utan `.env.local`).
2. I Vercel: Add New, Project, välj repot. Framework Preset: Vite (sätts av `vercel.json`).
3. Settings, Environment Variables. Lägg till för Production och Preview:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

   Inget annat. `SUPABASE_SECRET_KEY`, `TEST_EMAIL` och `TEST_PASSWORD` läggs aldrig i Vercel.
4. Deploy. Ändras en miljövariabel efteråt: gör en ny deploy, eftersom värdena byggs in i appen.
5. I Supabase: Authentication, URL Configuration. Sätt Site URL till Vercel-adressen och lägg till den under Redirect URLs.
6. Kontrollera att Confirm email fortfarande är avstängt (Authentication, Sign In / Providers, Email).
7. När alla konton är skapade: stäng av nyregistrering (Authentication, Sign In / Providers, Allow new users to sign up). Skapa konto ger då beskedet att det inte går att skapa nya konton.

## Offline

Appen går att installera (Lägg till på hemskärmen). Service workern sparar appen, kartrutor (högst 1500, i 30 dagar) och de senaste svaren från Supabase, så att senast hämtade data går att läsa utan uppkoppling. Bokningar och packlista för kommande resor hämtas i förväg när appen är uppkopplad. Skrivningar köas aldrig: utan uppkoppling stoppas de med ett besked. Valvet sparas bara som chiffertext. Allt sparat tas bort när man loggar ut.

## Mappar

- `src/config.ts`: appens namn, standardtema, platser hemma
- `src/theme/`: paletter, fonter och tema
- `src/lib/`: Supabase, texter (`t()`), kryptering, länkar, offline, logik med tester
- `src/features/`: en mapp per flik (karta, idag, listor, resor, vi)
- `src/components/`: delade delar
- `content/`: innehåll från Hugo
- `scripts/`: import, RLS-kontroll, ikoner, tester
- `e2e/`: röktestet
- `docs/`: prototyp, schema, format, idéer till fas 2
