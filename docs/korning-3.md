Läs CLAUDE.md, docs/schema.sql och delen Listor i docs/prototyp.html innan du gör något. Körning 1 och 2 är klara.

Gör Körning 3 (Listor):
1. Samlingsbok med vyerna Kort, Kompendium och Samlingar. Kompendium visar compendium_items med sällsynthetsfärgerna i CLAUDE.md, hittade och ej hittade, och räknare. Ett fynd sparas i finds, antingen direkt eller när en listpunkt med compendium_id bockas av. Visa samling.fynd, och för sällsynt och legendarisk respektive text med konfetti.
2. Samlingar: egna samlingar (collections, collection_entries), till exempel kaffemuggar, med plats, datum och anteckning per föremål. På en plats visas motivförslag ur gift_tips.collection_motifs för användarens samlingar.
3. Bucketlist: gruppens lista (bucket_items) med egna punkter och punkter hämtade ur bucket_catalog. Katalogen filtreras på kategori och kostnad med etiketterna bucket.kategori.* och kostnad.*. Avbockning med datum och valfri plats, räknare, och koppling till platssidan när place_ids finns.
4. Swipe med vyerna Kortbunt och Lista. Korten kommer från place_items, bucket_catalog och ideas som användaren inte röstat på. Rösterna sparas i swipe_votes. Par och grupp: visa swipe.match när alla sagt ja, och vyn Lista visar gemensamma ja. Solo: fliken heter Sortera och ett ja läggs direkt på listan. Korten ska gå att svepa med finger och med knappar.
5. Allt ska fungera med tangentbord och skärmläsare, även kortbunten.

Regler för körningen: Skriv inga innehållstexter och inga egna gränssnittstexter (använd t() och content/_texter.json, lista nycklar som saknas). Gör inga databasändringar själv: behövs en ändring ger du mig ett färdigt SQL-block och förklarar varför. Lägg inte till funktioner utöver det som står här, skriv idéer i docs/fas2.md. Avsluta med npm run build, npm run typecheck och npm test, och lista: klart, inte klart, saknade textnycklar, och vad jag behöver göra själv.
