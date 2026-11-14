# Fas 2: idéer som väntar

- Glömt lösenord: återställning via mejl. Kräver en egen e-postavsändare (custom SMTP) i Supabase och att Confirm email slås på igen.
- Kartan: färglägg Sveriges landskap (places med layer landskap) som egna ytor, inte bara länder. Kräver gränser per landskap.
- Kartan: spara kartplattor för offline-läsning (OpenFreeMap tillåter högst 3 000 plattor eller 50 MB per nedladdning).
- Samlingar: föreslå nya samlingar utifrån nycklarna i gift_tips.collection_motifs (som knapparna i prototypen).
- Swipe: ändra eller ta tillbaka en röst i vyn Lista.
- Samlingsbok: datum, plats och anteckning på ett fynd i efterhand (finds.note finns redan i databasen).
- Bucketlist och swipe: uppdatera direkt när någon annan i gruppen ändrar (Supabase Realtime).
- Resekassa: knappen Gör upp med Swish (som i prototypen) med beloppet ifyllt.
- Innan avresa: färdiga punkter per land (pass, visum, försäkring, roaming) ur content/, med källa. Kräver en innehållsfil.
- Inköpslista: koppla saker till presentmottagare (recipients) och matcha presenttips mot deras intressen.
- Resor: offline-läsning av resan, bokningar och bokningsfiler (Körning 7).
- Uppspelning: bågar för flygetapper i stället för raka linjer, och restid per etapp i uppspelningen.
- Idag: restid med bil från vald plats (en rutttjänst) i stället för avstånd fågelvägen. drive_minutes gäller bara från idéns egen plats.
- Idag: visa Nära på kartan, med vald plats och avståndsringar.
- Idag: namnet på platsen där man är (omvänd geokodning) i stället för "Där jag är nu".
- Idag: spara platser ur Nära, inte bara idéer.
- Idag: egen plats som inte finns i innehållet saknar koordinater. En sökning efter orten skulle ge Nära även där.

## Från Körning 6
- Lås upp Valvet med Face ID eller fingeravtryck (WebAuthn med PRF), som i prototypen. Fas 1 använder bara koden.
- Packförslag ur allergier och sjukdomar i Valvet (prototypen har allergikort, inhalator och liknande). Kräver innehåll från Hugo: en lista som kopplar hälsouppgifter till packrader. Fas 1 föreslår bara de egna medicinerna.
- Regler för dig utifrån hälsa (medicin, säkerhetskontroll), inte bara ålder. Kräver innehåll per land.
- Påminnelse om födelsedag under resan (prototypens "Du fyller år under resan").
- Resenärsnivå i rubriken på fliken Vi (prototypen visar "Resenärsnivå 7"), uträknad ur märkena.
- Dela Wrapped som bild.
- Märkenas datum för länder bygger på place_status.updated_at (senaste ändringen). En egen kolumn för första besöket skulle ge exakta datum.
- (Klart i Körning 7: Färdigpackad använder packing_items.packed_at.)

## Från Körning 7
- Bucketlist: ändra eller ta bort ett eget delmål. Fas 1 kan bara lägga till och bocka av.
- Bucketlist: delmål för platser som bockas av automatiskt skulle kunna visa datumet då platsen fick status.
- Offline: hämta bokningarnas filer (Storage) i förväg för kommande resor, inte bara raderna.
- Offline: en kö för skrivningar som skickas när uppkopplingen kommer tillbaka. Fas 1 stoppar skrivningar i stället, med tydligt besked.
- Säkerhet: ett andra testkonto i en egen grupp med en egen resa, så att npm run rls:check kan prova resans tabeller (bokningar, utgifter, packlista med flera) live och inte bara via reglerna.
- Röktestet kan byggas ut med par- och gruppläge (två konton som matchar i Swipe och delar utgifter).

## Från Körning 8
- Finare landsgränser på nära håll: Natural Earth 1:10 m blir 2,6 MB komprimerad som en fil (3 decimaler). Den kan delas upp per land och laddas bara för länderna i bild när man zoomar in förbi zoom 5.
- Gemensam samlingsbok för par och grupp: i dag är fynden per person (finds har ingen group_id). En delad bok skulle kräva group_id på finds och en unik regel på (group_id, compendium_id).
- Markera flera även i vyn Kompendium (i dag leder kategorierna till Kort, där läget finns).
- Språkval när fler språk finns: APP_LOCALE i src/config.ts styr redan all formatering. Innehåll ur databasen behöver översättas per språk (se slutrapporten för Körning 8).
- Licenssida i appen som visar MIT-texten för flag-icons (finns i dag som public/flags/LICENSE.txt).

## Från Körning 9
- Innehållet ur databasen på engelska (platser, fakta, listpunkter, kompendium, bucketkatalog, idéer, presenttips), till exempel ett fält per språk eller en egen tabell för översättningar. I dag visas sprak.innehall-svenska en gång under språkvalet.
- Packlistans och Innan avresas förslag (content/_packlista.json och _innan-avresa.json) på engelska.
- Kartans etiketter på valt språk (OpenFreeMap har name:en och name:sv i rutorna).
- Installationens manifest (PWA) på engelska: i dag har det lang sv.
- Språkval även på inloggningssidan (i dag följer den det sparade valet eller webbläsarens språk).
- Markera flera även i vyn Kompendium (där finns nu en ruta per kort i den utfällda kategorin).
- Prisnivå: märk enskilda belopp som uppskattning när prices.own_judgment pekar ut dem (t.ex. "hotell-3.low"). I dag visas bara märkningen för level.
- Prisnivå: visa dagsbudgeten i lokal valuta med samma kurser som content/_valutor.json.
