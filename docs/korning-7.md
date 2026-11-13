Läs CLAUDE.md innan du gör något. Körning 1 till 6 är klara.

Gör Körning 7 (Slutputs och driftsättning):
1. Offline: senast hämtade data går att läsa utan uppkoppling. Skrivningar offline stoppas med allmant.offline-skriv, inget köas i tysthet. Visa allmant.offline och allmant.online-igen. Kartans rutor cachas inom en rimlig gräns. Ny version visas med allmant.ny-version.
2. Tillgänglighet: gå igenom varje flik med tangentbord och skärmläsare. Synligt fokus, rätt rubriknivåer, label på alla fält, tryckytor minst 44 px, kontrast minst 4,5:1 i alla fem paletter i ljust och mörkt läge, och respekt för minskad rörelse (konfetti och uppspelning).
3. Prestanda på mobil: dela upp koden per flik, ladda MapLibre först när den behövs, och mät med Lighthouse i mobilläge. Redovisa siffrorna före och efter.
4. Säkerhet: sök igenom koden och git-historiken efter nycklar. Kontrollera att den hemliga nyckeln (SUPABASE_SECRET_KEY) inte finns i src/ eller i bygget. Gå igenom RLS genom att försöka läsa och skriva en annan grupps data som inloggad användare, och redovisa resultatet per tabell.
5. Driftsättning på Vercel: vercel.json med omskrivning för react-router, miljövariablerna VITE_SUPABASE_URL och VITE_SUPABASE_PUBLISHABLE_KEY, och en steg-för-steg-lista till mig över vad som ska ställas in i Vercel och i Supabase (Site URL, och att Confirm email fortfarande är avstängt).
6. Skriv en README med hur man kör lokalt, importerar innehåll och driftsätter.

Regler för körningen: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block och förklarar varför. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Avsluta med npm run build, npm run typecheck och npm test, och lista: klart, inte klart, saknade textnycklar, och vad jag behöver göra själv.
