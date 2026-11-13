# Globedex

Rese-, bucketlist- och samlingsapp. Byggs först för två personer, men som en riktig produkt med solo-, par- och gruppläge. Appen heter Globedex. Sätt APP_NAME = "Globedex" i src/config.ts och använd konstanten överallt, aldrig hårdkodat.

## Källor till sanning
1. docs/prototyp.html är facit för utseende, flöden och beteende. Öppna och läs den innan du bygger en skärm. Allt innehåll i den är exempeldata.
2. docs/schema.sql är databasen. Den är redan körd i Supabase.
3. Den här filen.
Säger de emot varandra: fråga Hugo, gissa inte.

## Logga
- docs/logo/globedex-symbol.svg: märket med genomskinlig bakgrund (sidhuvud, inloggning, tomma lägen).
- docs/logo/globedex-ikon.svg: märket på krämvit platta med rundade hörn (favicon, delningsbild).
- docs/logo/globedex-ikon-maskable.svg: helfylld kvadrat utan rundade hörn, märket inom säker zon. Använd den för PWA-ikoner (maskable) och apple-touch-icon.
- docs/logo/globedex-symbol-liten.svg och globedex-ikon-liten.svg: förenklat märke utan prickad ring. Använd det under 64 px (favicon, flikrad).
- docs/logo/globedex-symbol-mork.svg, globedex-symbol-liten-mork.svg och globedex-ikon-mork.svg: för mörkt läge.
- docs/logo/globedex-logo-liggande.svg (och -mork): märke plus ordmärke i Fraunces, som konturer. globedex-ordmarke.svg är bara texten.
- docs/logo/globedex-appikon-1024.svg: kvadrat utan rundade hörn för en framtida appbutik.
- docs/logo/globedex-favicon.svg (och -mork): bara globen, för 16 till 32 px.
- Loggans färger är fasta och följer inte användarens palett: marinblå #1D3557, krämvit #F4EBD9, korall #E4572E. Rita inte om loggan och byt inte dess färger.
- Delarna i SVG:n har id stampel, rutt, flygplan och bakgrund, så att planet kan animeras för sig.

## Regler
- Skriv ALDRIG innehållstexter (guider, fun facts, regler, åldersgränser, presenttips, priser, restider). De levereras som JSON i content/ av Hugo. Saknas innehåll: visa tomt läge, hitta inte på.
- All text i gränssnittet på svenska. Inga emojier, använd ikoner i SVG.
- Gränssnittets texter (knappar, tomma lägen, felmeddelanden, start, märken) finns i content/_texter.json i tre språkstilar. Bygg en funktion t(nyckel, värden) i src/lib/texter.ts som läser filen och vald språkstil, och använd den överallt. Skriv inte egna texter. Behövs en text som saknas: lägg nyckeln i en lista i slutrapporten så skriver Hugo den.
- Mobil först (390 px bred). Tryckytor minst 44 px. Riktiga button, a och input med label.
- Databasändringar gör du aldrig själv. Ge Hugo ett färdigt SQL-block att klistra in i Supabase.
- Inga hemligheter i koden eller i git. Nycklar ligger i .env.local. Tre variabler: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (sb_publishable_..., används i appen) och SUPABASE_SECRET_KEY (sb_secret_..., bara i skript). Använd inte de äldre anon- och service_role-nycklarna, Supabase fasar ut dem.
- Valvet (pass, hälsa, födelsedatum) krypteras i webbläsaren innan det sparas. Klartext får aldrig skickas till Supabase eller loggas.
- Lägg inte till funktioner utöver fas 1. Idéer skrivs i docs/fas2.md.
- Varje körning avslutas med att npm run build och npm run typecheck går igenom, och en kort lista över vad som är klart och vad som inte är det.

## Stack
- Vite, React, TypeScript, react-router-dom
- @supabase/supabase-js (inloggning med e-post och lösenord, minst 8 tecken; Confirm email är avstängt i Supabase, så inga mejl skickas och inget glömt lösenord i fas 1)
- maplibre-gl med OpenFreeMap som underlag, egna lager ovanpå. Kontrollera aktuell stil-URL och villkor innan du använder den.
- vite-plugin-pwa (installerbar, offline-läsning av senaste data)
- Web Crypto (AES-GCM, nyckel från användarens kod via PBKDF2) för Valvet
- Vanlig CSS med variabler. Ingen Tailwind, inget komponentbibliotek.
- Driftsätts på Vercel

## Struktur
- src/config.ts: APP_NAME, standardtema, platser hemma
- src/theme/: paletter, fonter, tema-provider som sätter CSS-variabler
- src/lib/: supabase-klient, valutakurser, kryptering, länkbyggare (flyg, boende, kartor)
- src/features/karta, idag, listor, resor, vi: en mapp per flik
- src/components/: delade delar (segment, kort, rad, bottenark, toast, konfetti)
- content/: JSON från Hugo, en fil per land. Formatet står i docs/FORMAT.md. Fält som listas i data.own_judgment är uppskattningar utan källa: visa dem märkta som uppskattning. scripts/import-content.mjs läser in till Supabase med SUPABASE_SECRET_KEY från .env.local. Den nyckeln får aldrig importeras i src/ eller få prefixet VITE_.

## Tema och anpassning (per användare, sparas i profiles.settings)
CSS-variabler: --p primär, --a accent, --bg, --sf yta, --tx text, --mu dämpad text, --ln linje, --tr spår, --onp text på primär, --soft, --fh rubrikfont, --fb brödfont, --r rundning.
- Paletter (primär, primär mörkt läge, accent, bakgrund, bakgrund mörk, yta mörk):
  Djuphav #0F4C5C #5FB0C2 #FF6B4A #FBF7F0 #0E1A20 #172830
  Medelhav #1D4ED8 #7B9BFF #F59E0B #F8FAFC #0B1220 #141E33
  Terrakotta #C2410C #F08A5D #0D9488 #FFF7ED #1C1210 #2A1C18
  Skog och fjäll #166534 #5CCB84 #EAB308 #F7F7F2 #0F1A14 #18261D
  Nattflyg #6D28D9 #AE8BFA #22D3EE #FAF5FF #120B1F #1E1530
  Egen: användaren väljer primär, accent och bakgrund. Mörkt läge räknas ut. Varna vid kontrast under 4,5:1.
- Rubrikfonter: Fraunces, Bricolage Grotesque, Space Grotesk, Playfair Display, DM Serif Display, Outfit, Sora
- Brödfonter: DM Sans, Inter, Manrope, Nunito, Work Sans, IBM Plex Sans
- Även: textstorlek (liten, normal, stor), ljust och mörkt läge, rundning 4–26 px, språkstil (neutral, lekfull, romantisk)
- Startläge: Djuphav, Fraunces + DM Sans, ljust, 16 px rundning
- Kartstatus: bor = primär, har bott = primär 55 %, besökt #2EC4B6, planerad #F4B942, vill åka = accent 62 %, mellanlandat #B8C4C9, ej satt #E8E2D6
- Sällsynthet: vanlig #8A939B, ovanlig #3FA34D, sällsynt #3B82F6, legendarisk #E0A21B

## Reseläge
solo, par eller grupp (profiles.travel_mode, groups.kind). Sista fliken heter Jag, Vi eller Gruppen. Solo: ingen skulddel i resekassan, swipe heter Sortera och lägger ja direkt på listan. Par och grupp: utgifter delas lika på medlemmarna om inget annat anges, matchning när alla sagt ja.

## Flikar i fas 1 (detaljer i prototypen)
1. Karta: geografisk karta, lägena Ren, Upptäck, Terräng 3D och Smart månad, växling Europa och världen, statusfärger, resa som spelas upp etapp för etapp, listan Era platser. Landssida med vyerna Översikt, Lista, Guide, Månad, Boka samt Köp med hem.
2. Idag: välj plats (hemma, sparad, egen, position) och Idag eller I helgen. Vyerna Slumpa och Nära (1 h, 3 h, en dag, helg med bil). Utflykt kan göras om till resa.
3. Listor: Samlingsbok (Kort, Kompendium, Samlingar), Bucketlist, Swipe (Kortbunt, Lista).
4. Resor: Planera nästa resa (vart, hur länge, när, datum och flyg, boende, budget), nedräkning, resplan med etapper, Resekassa (Skulder, Budget), Packlista, Innan avresa (redigerbar), bokningar, inköpslista, tidigare resor, import.
5. Vi: Siffror och Wrapped, märken, tidslinje, Valvet (med hälsa och födelsedatum som styr packlista och Regler för dig), Vår guide, Anpassning, Exportera till Claude (visa texten före kopiering).
Princip: varje flik visar en översikt, och varje rad, ruta och siffra öppnar en detaljvy i ett bottenark eller en undersida.

## Länkar ut (ingen API i fas 1)
Flyg: Google Flights och Skyscanner med avreseort (GOT eller CPH) och datum. Boende: Booking och Airbnb med datum, gäster, rum, maxpris och typ. Platser: Google Maps-sökning. Bygg länkarna i src/lib/links.ts med tester. Hugo kontrollerar dem mot sajterna.

## Datamodell i korthet (se docs/schema.sql)
- Användare: profiles, groups, group_members, group_invites. Funktioner: create_group(namn, typ), join_group(kod), is_member, shares_group, can_trip.
- Innehåll (bara läsning från appen): places (land, region, stad, plats; data-jsonb med vistelselängder, områden, transport, flygtips), place_facts (guide och regler med källa och datum), place_items (checklista), compendium_items, bucket_catalog, ideas, gift_tips.
- Egen data: place_status, item_checks, finds, swipe_votes, collections, collection_entries, recipients, saved_locations, vault_items (krypterat).
- Gruppens data: bucket_items, reviews, saved_ideas, trips.
- Resans delar: trip_legs, bookings, expenses (belopp, valuta, kurs den dagen), packing_items, pretrip_items, shopping_items.
- Märken, statistik och Wrapped räknas ut i appen, de har inga tabeller.

## Körningar (en i taget, i ordning)
1. Grund: projekt, tema och Anpassning, fem flikar med tomma skärmar, inloggning, profil och reseläge, grupp och inbjudan, PWA.
2. Karta: MapLibre, statuslager, fyra lägen, landssida med alla vyer, import av innehåll.
3. Listor: samlingsbok, samlingar, bucketlist, swipe.
4. Resor: planerare, etapper och uppspelning, resekassa, packlista, innan avresa, bokningar, inköpslista.
5. Idag: plats, tid, slumpa, nära.
6. Vi: statistik, märken, Wrapped, Valvet med kryptering, regler för dig, export.
7. Offline, tillgänglighet, prestanda på mobil, driftsättning på Vercel.

## Inte i fas 1
Riktig iPhone-app, bakgrundsspårning, community-flöde, betalfunktioner, AI inne i appen, delning av Valvet mellan användare, detaljerad 3D-terräng och 3D-modeller av sevärdheter, sökresultat från flyg- och boendesajter inne i appen.
