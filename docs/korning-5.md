Läs CLAUDE.md, docs/schema.sql och delen Idag i docs/prototyp.html innan du gör något. Körning 1 till 4 är klara.

Gör Körning 5 (Idag):
1. Välj plats: Hemma (från profilen), sparad plats (saved_locations), egen plats eller enhetens position. Position frågas bara efter när användaren trycker på valet. Nekas den: visa idag.position-nekad.
2. Välj Idag eller I helgen.
3. Vyn Slumpa: en idé i taget ur ideas för vald plats, plus idéer utan place_id som fungerar överallt. Filtrera på kind, cost_level och tags. Idén går att spara (saved_ideas), markera som gjord och slumpa om utan att samma kommer direkt igen.
4. Vyn Nära: idéer och platser inom 1 timme, 3 timmar, en dag eller helg med bil. Använd drive_minutes när den finns. Annars räknas avstånd fågelvägen och visas som avstånd, aldrig som restid.
5. En utflykt kan göras om till resa: skapar en trip med en etapp och öppnar den i Resor.
6. Tomma lägen enligt idag.tom och idag.nara.tom.

Regler för körningen: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block och förklarar varför. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Avsluta med npm run build, npm run typecheck och npm test, och lista: klart, inte klart, saknade textnycklar, och vad jag behöver göra själv.
