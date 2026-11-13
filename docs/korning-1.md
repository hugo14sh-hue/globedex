Läs CLAUDE.md, docs/prototyp.html och docs/schema.sql innan du gör något.

Gör Körning 1 (Grund):
1. Sätt upp Vite + React + TypeScript i den här mappen enligt Stack och Struktur i CLAUDE.md. Lägg till skripten dev, build, typecheck och test.
2. Bygg temasystemet: alla CSS-variabler, de fem paletterna, egen palett med kontrastvarning, alla rubrik- och brödfonter, textstorlek, ljust och mörkt läge, rundning och språkstil. Inställningarna sparas i profiles.settings och lokalt, så att appen har rätt tema direkt vid start.
3. Bygg skalet: fem flikar längst ned med tomma skärmar, delade komponenter (segment, kort, rad, bottenark, toast, konfetti) som i prototypen, och sidan Anpassning fullt fungerande.
4. Inloggning med magisk länk via e-post mot Supabase (klienten skapas med VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY). Efter inloggning: läs profilen, låt användaren sätta visningsnamn och reseläge (solo, par, grupp), skapa grupp med create_group och bjud in med kod via group_invites och join_group. Sista fliken byter namn efter reseläge.
5. Gör appen installerbar som PWA med APP_NAME från src/config.ts (Globedex). Skapa ikonerna från docs/logo enligt avsnittet Logga i CLAUDE.md, och visa märket på inloggningssidan.

6. Bygg t(nyckel, värden) i src/lib/texter.ts enligt CLAUDE.md och använd texterna i content/_texter.json för allt i den här körningen (login, start, grupp, anpassning, allmänt). Språkstilen Romantisk går bara att välja i reseläget par.

Skriv inga innehållstexter och gör inga databasändringar. Avsluta med att köra npm run build och npm run typecheck, och lista vad som är klart, vad som inte är det och vad jag behöver göra själv.
