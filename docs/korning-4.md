Läs CLAUDE.md, docs/schema.sql och delen Resor i docs/prototyp.html innan du gör något. Körning 1 till 3 är klara.

Gör Körning 4 (Resor):
1. Planera nästa resa i stegen vart, hur länge, när, datum och flyg, boende och budget. Förslag på längd kommer ur places.data.stay, månad ur smart_months och budget ur day_budget_sek (märkt som uppskattning när fältet står i own_judgment). Resultatet sparas som trip med trip_legs.
2. Resesida: nedräkning med texterna resor.nedrakning, resor.imorgon och resor.idag, resplan med etapper som går att lägga till, ändra och sortera om, och uppspelning av resan etapp för etapp på kartan.
3. Resekassa med vyerna Skulder och Budget. En utgift har belopp, valuta, vem som betalade och vilka den delas på. Kursen hämtas för utgiftens datum och sparas på raden, så att gamla utgifter inte ändras. Föreslå en gratis kurskälla utan nyckel och kontrollera dess villkor innan du använder den. Går kursen inte att hämta: visa kassa.kurs-saknas. Skulder räknas ut till så få betalningar som möjligt. Solo har ingen skulddel. Skriv tester för delning, avrundning och skulduträkning.
4. Packlista (packing_items) med egna rader och förslag. Kopplingen till Valvet byggs i Körning 6, lämna en tydlig plats för den.
5. Innan avresa (pretrip_items), redigerbar checklista. Bokningar (bookings) med typ, datum, referens och länk. Inköpslista (shopping_items), där presenttips från platssidan kan läggas till.
6. Tidigare resor och import: en avslutad resa går att lägga in i efterhand med land, datum och etapper, och sätter status besökt.
7. Behörighet följer can_trip i schemat. Kontrollera att en användare utanför gruppen inte kan läsa resan.

Regler för körningen: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block och förklarar varför. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Avsluta med npm run build, npm run typecheck och npm test, och lista: klart, inte klart, saknade textnycklar, och vad jag behöver göra själv.
