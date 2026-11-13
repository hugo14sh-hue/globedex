Läs CLAUDE.md, docs/schema.sql och delen Vi i docs/prototyp.html innan du gör något. Körning 1 till 5 är klara.

Gör Körning 6 (Vi, Jag eller Gruppen):
1. Siffror: länder, kontinenter, svenska landskap, resor, resdagar, fynd och avbockade bucketpunkter. Varje siffra öppnar en detaljvy. Allt räknas ut i appen.
2. Märken enligt listan marken i content/_texter.json. rule beskriver vad som räknas, du skriver uträkningen i src/features/vi/marken.ts med tester för varje märke. Märken med levels visar nivå och framsteg. Märken som bara gäller par och grupp döljs i solo.
3. Wrapped för ett valt år: resor, länder, dagar, fynd och bucketpunkter som en svepbar serie skärmar. Kräver minst en resa under året, annars wrapped.tom.
4. Tidslinje över resor, fynd, märken och avbockade punkter.
5. Valvet: innehållet krypteras i webbläsaren med AES-GCM, nyckeln härleds ur användarens kod med PBKDF2 och ett salt per användare. Bara chiffertext, iv och salt sparas i vault_items. Koden och nyckeln sparas aldrig, varken lokalt eller i Supabase, och loggas aldrig. Valvet låses när appen läggs i bakgrunden och efter några minuters inaktivitet. Visa valv.varning innan koden väljs. Skriv tester: kryptera och dekryptera, fel kod ger fel, och ett test som visar att klartext aldrig ingår i det som skickas.
6. Valvets hälsa och födelsedatum styr, lokalt i webbläsaren och bara när Valvet är upplåst: förslag i packlistan (pack.fran-valvet) och Regler för dig på platssidan (regler filtrerade på min_age mot användarens ålder). Passets giltighet ger varningen valv.pass-gar-ut.
7. Guiden (reviews): betyg och anteckning per ställe, sökbar.
8. Exportera till Claude: bygg en text med resor, status, listor och omdömen. Visa hela texten före kopiering. Valvet följer aldrig med.

Regler för körningen: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block och förklarar varför. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Avsluta med npm run build, npm run typecheck och npm test, och lista: klart, inte klart, saknade textnycklar, och vad jag behöver göra själv.
