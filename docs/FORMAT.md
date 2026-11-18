# Innehållsformat

En JSON-fil per land i content/, till exempel content/NL.json. Filen fylls i av Claude-chatten med källor. scripts/import-content.mjs läser filerna och skriver till Supabase (upsert på id). Fälten motsvarar tabellerna i docs/schema.sql ett till ett.

## Regler
- id är små bokstäver, siffror och bindestreck. Land: ISO-kod med versaler ("NL"). Allt under landet börjar med landskoden: "NL-amsterdam", "NL-amsterdam-rijksmuseum".
- Varje faktauppgift som kan bli fel har source_url och verified_on (ÅÅÅÅ-MM-DD). Regler och åldersgränser utan källa får inte importeras.
- Text på svenska. summary högst 80 tecken, body högst 400 tecken.
- Belopp i kronor som heltal. Tider som text ("ca 15 min").
- Fält som saknas utelämnas. Skriv aldrig "okänt" eller liknande.

## Filens delar

```json
{
  "places": [],
  "facts": [],
  "items": [],
  "compendium": [],
  "ideas": [],
  "gifts": []
}
```

### places (tabell places)
| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | "NL", "NL-noord-holland", "NL-amsterdam" |
| kind | text | ja | country, region, city eller spot |
| parent_id | text | utom för land | id på platsen ovanför |
| layer | text | nej | för länder med två indelningar, t.ex. "lan" eller "landskap" |
| name | text | ja | svenskt namn |
| iso2 | text | för land | "NL" |
| lat, lon | tal | ja | mittpunkt |
| airport | text | nej | IATA-kod för sök flyg, "AMS" |
| smart_months | 12 heltal 0–5 | nej | januari först, 5 är bäst |
| data | objekt | nej | se nedan |

data på en plats:
- stay: lista med { "label", "days", "text", "recommended" } (tre längder, en rekommenderad)
- day_budget_sek: heltal per person och dag utan flyg
- areas: lista med { "name", "stay": true eller false, "text" }
- transport: lista med { "mode", "rating": "bast", "bra" eller "dyrt", "text" }
- flight_tips: lista med { "title", "text" }
- best_text: en mening om bästa tiden
- sources: lista med URL:er som stödjer data
- day_budget_note: text som förklarar vad dagsbudgeten räknar in
- own_judgment: lista med fältnamn på platsen som är Claudes egen bedömning och saknar källa (t.ex. "stay", "areas", "day_budget_sek", "best_text", "smart_months"). Visa dem gärna som "uppskattning" i appen.
- prices: prisnivå och exempelpriser i lokal valuta, se nedan. Kräver ingen databasändring (ligger i data).
- month_notes: lista med exakt 12 texter, januari först. Förklarar betyget i smart_months för varje månad. Får saknas.
- events: lista med händelser som påverkar när man bör åka, se nedan. Får saknas.
- seasons: lista med säsonger som återkommer varje år, se nedan. Får saknas. Kräver ingen databasändring (ligger i data).
- iso_3166_2: regionens kod i ISO 3166-2, till exempel "US-CA". Bara på regioner (kind region), och koden börjar med landets kod. Kopplar regionen till sin yta i kartläget Regioner (public/geo/delstater.json, byggd av `node scripts/make-regions.mjs` ur Natural Earth admin 1). Sveriges landskap har ingen kod: de kopplas till sina ytor via namnet (public/geo/landskap.json, byggd av `node scripts/make-landskap.mjs` ur perliedman/svenska-landskap), så ett landskaps name måste stå som i den filen. Regioner utan yta visas som punkter på lat och lon.

#### data.month_notes och data.events
Visas i rutan Smart månad på platsens sida (vyn Månad). Har platsen month_notes står texten smart.tryck under staplarna, och ett tryck på en månad visar månadens namn och betyg, månadens text och under smart.handelser.rubrik de händelser som börjar eller slutar i den månaden och inte har passerat. Utan month_notes ser rutan ut som förut. Läggs month_notes till och är egen bedömning: skriv "month_notes" i own_judgment.

```json
"month_notes": ["Januari ...", "Februari ...", "...", "December ..."],
"events": [
  { "name": "Monacos Grand Prix (Formel 1)", "start": "2027-06-04", "end": "2027-06-06", "text": "En mening.", "source": "https://..." }
]
```

| Fält i en händelse | Typ | Krav | Beskrivning |
|---|---|---|---|
| name | text | ja | händelsens namn |
| start | datum | ja | första dagen, ÅÅÅÅ-MM-DD |
| end | datum | ja | sista dagen, ÅÅÅÅ-MM-DD, samma som start för en dag. Får inte vara före start |
| text | text | ja | en kort förklaring |
| source | URL | ja | visas som länk med domännamnet (smart.handelser.kalla) |

Händelser vars sista dag har passerat visas inte. `npm run import:check` stoppar month_notes som inte är 12 texter, ogiltiga datum, end före start, saknad källa och okända fält i en händelse.

#### data.seasons
Säsonger som återkommer varje år (lunnefåglar, norrsken, badsäsong). Visas i rutan Smart månad under smart.sasonger.rubrik, mellan månadens text och smart.handelser.rubrik, för den valda månaden och i filens ordning. Varje rad har namnet i fetstil, perioden med korta månadsnamn (smart.sasong.period, bara månadens namn när from är lika med to), texten och källan som länk med domännamnet (smart.handelser.kalla). Under varje stapel med minst en pågående säsong står en liten prick. Har platsen seasons men inga month_notes går staplarna ändå att trycka på. Säsongerna visas också på resans sida, under platsens namn, för de månader resan pågår. Är säsongerna egen bedömning: skriv "seasons" i own_judgment.

```json
"seasons": [
  { "name": "Norrsken", "from": 9, "to": 3, "text": "En kort förklaring.", "source": "https://..." },
  { "name": "Tulpaner i parkerna", "from": 4, "to": 4 }
]
```

| Fält i en säsong | Typ | Krav | Beskrivning |
|---|---|---|---|
| name | text | ja | säsongens namn |
| from | heltal 1–12 | ja | första månaden, 1 är januari |
| to | heltal 1–12 | ja | sista månaden. Är from större än to går säsongen över årsskiftet (11 till 3 är november till mars). Lika med from betyder en enda månad |
| text | text | nej | en kort förklaring, visas under namnet |
| source | URL | nej | http-adress, visas som länk med domännamnet |

`npm run import:check` stoppar seasons som inte är en lista, saknat namn, from eller to som inte är heltal 1–12, source som inte är en http-adress och okända fält i en säsong.

#### data.prices
Visas som sektionen Prisnivå på stadssidan, direkt efter dagsbudgeten. Har ett land egna prices visas de på landssidan. Annars visar landssidan en rad per stad som har prices, med nivån. Städer med prices får nivån som fem små markeringar på sina rader i listorna.

```json
"prices": {
  "currency": "EUR", "level": 4, "checked": "2026-11-14", "summary": "En mening om nivån.",
  "rows": [
    { "key": "kaffe", "low": 2.5, "high": 5, "typical": 3.5 },
    { "key": "lokalresa", "typical": 2, "note": "Enkelbiljett med buss." }
  ],
  "tips": ["Ett tips."], "sources": ["https://..."], "own_judgment": ["level"]
}
```

| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| currency | text | ja | valutakod med tre versaler (ISO 4217), "EUR" |
| level | heltal 1–5 | ja | 1 billigt, 3 som hemma, 5 mycket dyrt. Texten kommer från pris.niva.<level> |
| checked | datum | ja | när priserna kontrollerades (ÅÅÅÅ-MM-DD) |
| summary | text | nej | visas under nivån |
| rows | lista | ja | rader i den ordning de ska visas, se nedan. En key får bara finnas en gång |
| tips | lista med text | nej | punktlista under pris.tips.rubrik |
| sources | lista med URL:er | ja, minst en | visas som länkar med domännamnet |
| own_judgment | lista med text | nej | det som är egen bedömning. Innehåller den "level" visas texten pris.egen-bedomning. Andra värden (t.ex. "hotell-3.low") sparas men visas inte än |

En rad i rows:

| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| key | text | ja | enkel-maltid, middag-for-tva, snabbmat, ol, kaffe, lask, vatten, lokalresa, hotell-3 eller hotell-4. Radens namn kommer från texten pris.rad.<key> |
| low, high | tal ≥ 0 | nej | spannet i lokal valuta. Anges båda eller ingen, high minst low |
| typical | tal ≥ 0 | nej | det vanligaste priset |
| note | text | nej | visas i mindre text under raden |

Varje rad har typical eller både low och high. Beloppet i kronor räknas på typical, eller på mitten av spannet när typical saknas, med kursen i content/_valutor.json. Det avrundas till jämna tiotal över 100 kr och till hela kronor under. Finns ingen kurs för valutan visas bara beloppet i lokal valuta.

`npm run import:check` stoppar okänd key, level utanför 1–5, rad utan belopp, saknade sources eller checked och okända fält.

### facts (tabell place_facts): guide och regler
| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | "NL-fakta-mobil" |
| place_id | text | ja | |
| topic | text | ja | ta-sig-dit, mobil, betala, eluttag, dricks, tank-pa, fun-fact, inresa, alkohol, hyrbil, boende, medicin, turistskatt |
| is_rule | boolean | ja | true för lagar och åldersgränser |
| min_age | heltal | för åldersregler | |
| title, summary, body | text | title krävs | |
| source_url, verified_on | text | krävs när is_rule är true | |

### items (tabell place_items): checklistan
| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | "NL-amsterdam-rijksmuseum" |
| place_id | text | ja | |
| category | text | ja | mat, dryck, sevardhet, museum, natur, symbol, fotboll, upplevelse, strand, byggnad |
| name, summary, body | text | name krävs | |
| must_rank | heltal | nej | 1–10 för Missa inte-listan |
| lat, lon | tal | nej | |
| compendium_id | text | nej | kopplar avbockningen till samlingsboken |
| source_url, verified_on | text | ja | |
| wiki | text | nej | Wikipediasidan som bilden hämtas från: språkkod, kolon och sidans titel, "en:Monte Carlo Casino" |

#### Bilder på listpunkter
place_items har också fälten image_url, image_credit, image_license och image_page. De står inte i innehållsfilerna (import:check stoppar dem) och skrivs aldrig av `npm run import`, så de ligger kvar när innehållet läses in igen. De fylls av `npm run import:images`, som körs lokalt av Hugo med SUPABASE_SECRET_KEY:

- För varje listpunkt med wiki och utan image_url hämtas sidans huvudbild (800 px bred) från Wikipedias API (pageimages), och från Wikimedia Commons API (imageinfo, extmetadata) upphovsperson, licens och filsidans adress.
- Bara bilder med licensen CC0, Public domain, CC BY eller CC BY-SA sparas. Upphovsnamnet rensas från html.
- Skriptet skriver ut en lista över punkter som saknar sida, saknar bild eller har en annan licens.
- `npm run import:images -- --force` hämtar om bilderna för alla punkter med wiki.

I appen visas bilden överst på punktens sida (16:9) med upphovsperson och licens som länk till filsidan, och som en liten rund miniatyr i listan.

### compendium (tabell compendium_items)
| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | "mat-stroopwafel" (utan landskod, samma sak kan finnas i flera länder) |
| category | text | ja | mat, dryck, godis, bakverk, daggdjur, fagel, havsdjur, blomma, svamp, trad, naturfenomen, sevardhet, arena, fardmedel |
| name | text | ja | |
| rarity | text | ja | vanlig, ovanlig, sallsynt eller legendarisk |
| icon | text | nej | food, cup, paw, bird, sky, sun, ball, flower, mush, build, tram, pin |
| hint | text | nej | ledtråd som visas innan fyndet är hittat |
| place_id | text | nej | |
| source_url | text | nej | |

### ideas (tabell ideas): Idag-fliken
| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | "SE-boras-skulpturpromenad" |
| place_id | text | nej | utelämnas för idéer som funkar hemma var som helst |
| kind | text | ja | hemma, i-stan, ut-en-svang, dagstripp, helg, utflykt, fotboll |
| title, body | text | title krävs | |
| duration | text | nej | "ca 2 h", "Halvdag" |
| cost_level | text | nej | gratis, billigt, medel eller dyrt |
| tags | lista | nej | inne, ute, gratis, nara |
| drive_minutes | heltal | nej | restid med bil från place_id |
| lat, lon | tal | nej | |

### gifts (tabell gift_tips)
| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | "NL-present-tulpanlokar" |
| place_id | text | ja | |
| name, body | text | name krävs | |
| for_whom | lista | ja | mamma, pappa, barn, van, mig |
| keywords | lista | nej | intressen som tipset matchar, små bokstäver |
| price_sek | heltal | nej | ungefärligt |
| min_age | heltal | nej | 18 för alkohol |
| collection_motifs | objekt | nej | { "Kaffemuggar": "motivförslag", "Shotglas": "..." } |

## Bucketlistans katalog
Ligger i content/_bucket.json som en lista med { "id", "name", "category", "cost_level", "season", "where_text", "place_ids" }. Läses in till bucket_catalog efter places. category är en av aventyr, natur, resa, mat, kultur, tillsammans, hemma, milstolpe. place_ids får vara tom (går att göra var som helst).

### checklist (valfritt): delmål
En punkt kan ha delmål i fältet checklist. Det läses in till bucket_catalog.checklist. Avbockningar som görs för hand sparas per grupp i bucket_items.parts som [{ "title", "done", "done_at" }]. Tre former:

| type | Fält | Rader | Bockas av |
|---|---|---|---|
| platser | place_ids: lista med plats-id (minst en, inga dubbletter) | en rad per plats | automatiskt när platsen har status besökt, bor eller har bott. Går inte att bocka av för hand |
| platser | parent_id + layer (båda krävs) | en rad per plats under parent_id med det lagret, i bokstavsordning | automatiskt, som ovan |
| platser | source: "besokta-lander" | en rad per land med status besökt | för hand |
| antal | metric: countries_visited eller continents_visited, target: heltal över 0 | en stapel med framsteg, samma uträkning som Siffror | automatiskt |
| delar | items: lista med titlar (minst en, högst 120 tecken, inga dubbletter) | en rad per titel | för hand |

Platser ska ha precis en av place_ids, parent_id + layer eller source. Andra fält än de som hör till formen stoppas. import:check kontrollerar också att platserna finns, och att det finns platser under parent_id med det lagret. Saknas checklist nollas kolumnen vid importen.

```json
{ "id": "bucket-alla-landskap", "name": "...", "category": "resa", "place_ids": ["SE"],
  "checklist": { "type": "platser", "parent_id": "SE", "layer": "landskap" } }
{ "id": "bucket-tio-lander", "name": "...", "category": "milstolpe", "place_ids": [],
  "checklist": { "type": "antal", "metric": "countries_visited", "target": 10 } }
{ "id": "bucket-x", "name": "...", "category": "aventyr", "place_ids": [],
  "checklist": { "type": "delar", "items": ["Första delen", "Andra delen"] } }
```

Egna bucketpunkter (utan katalog) kan få egna delmål i appen. De finns bara i bucket_items.parts.

## Packlistans förslag
Ligger i content/_packlista.json och läses in i appen vid bygget (inte till databasen), som _texter.json. Bara allmänna saker som hör till resans längd och månad. Inget om hälsa eller ålder (det kommer från Valvet i Körning 6). Saknas filen är knappen Hämta förslag avstängd.

```json
{
  "items": [
    { "id": "laddare", "group": "Teknik", "title": "Laddare" },
    { "id": "regnjacka", "group": "Kläder", "title": "Regnjacka", "months": [3, 4, 5, 9, 10, 11] },
    { "id": "tvattmedel", "group": "Övrigt", "title": "Tvättmedel i resestorlek", "min_nights": 7 }
  ]
}
```

| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | små bokstäver, siffror och bindestreck, unikt i filen |
| group | text | ja | rubriken raden hamnar under i packlistan |
| title | text | ja | högst 60 tecken |
| min_nights | heltal | nej | föreslås bara från så här många nätter |
| max_nights | heltal | nej | föreslås bara upp till så här många nätter |
| months | lista med heltal 1–12 | nej | föreslås bara när resan börjar i någon av månaderna. Utelämnas för hela året |

En rad med min_nights, max_nights eller months föreslås bara när resan har datum. Saker som redan står på listan (samma titel) föreslås inte igen.

## Innan avresa
Ligger i content/_innan-avresa.json och läses in i appen vid bygget (inte till databasen), som _packlista.json. Knappen Hämta förslag under Innan avresa lägger till de punkter som saknas på resans lista. Saknas filen är knappen avstängd.

```json
{
  "items": [
    { "id": "forsakring", "title": "Kontrollera reseförsäkringen", "hint": "Se vad hemförsäkringen täcker.", "days_before": 30 },
    { "id": "ladda", "title": "Ladda mobil och powerbank", "days_before": 0 }
  ]
}
```

| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| id | text | ja | små bokstäver, siffror och bindestreck, unikt i filen |
| title | text | ja | högst 60 tecken, unik i filen |
| hint | text | nej | förklaring under punkten, högst 200 tecken |
| days_before | heltal 0–365 | ja | hur många dagar före avresan punkten senast bör vara gjord. 0 = avresedagen |

En punkt med samma titel som en rad som redan finns på listan (även en dold) läggs inte till igen. Listan sorteras på days_before, det som ska göras tidigast först. Egna punkter hamnar sist. days_before slås upp i filen via titeln, så byter en punkt titel i filen förlorar redan tillagda rader sin dag.

`npm run import:check` validerar både _packlista.json och _innan-avresa.json.

## Valutakurser
Ligger i content/_valutor.json och läses in i appen vid bygget (inte till databasen). Används för att visa priserna i data.prices i kronor. Uppdateras för hand.

```json
{ "checked": "2026-11-01", "source": "https://...", "sek_per": { "EUR": 11.0 } }
```

| Fält | Typ | Krav | Beskrivning |
|---|---|---|---|
| checked | datum | ja | när kurserna kontrollerades, visas i texten pris.kurs |
| source | URL | ja | var kurserna kommer ifrån |
| sek_per | objekt | ja | valutakod (tre versaler) till kronor per en enhet, över 0 |
| _om | text | nej | kommentar, används inte |

En valuta som saknas i sek_per visas bara i lokal valuta. `npm run import:check` validerar filen.

## Vilka länder som räknas
Ligger i content/_landlistor.json och läses in i appen vid bygget (inte till databasen). Styr nämnaren och vad som räknas i statistik, mål och märken, efter valet under Anpassning (FN:s medlemsländer, med observatörer, eller alla länder i appen). Kartan visar alltid alla länder.

```json
{ "_om": "...", "fn": ["AD", "AE", "..."], "fn_observatorer": ["PS", "VA"], "fn_plus_tw_xk": ["TW", "XK"], "delade": { "GB": ["GB-eng", "..."] } }
```

fn_plus_tw_xk ger valet landlista.fn-tw-xk: fn, fn_observatorer och de här koderna (197). Koderna får inte redan finnas i fn eller fn_observatorer.

`npm run import:check` stoppar okända fält, koder som inte finns bland appens länder (src/lib/countries.ts), dubbletter, en fn-lista som inte har 193 unika koder och koder som finns i båda listorna.

### delade (Körning 19)
Länder som kan räknas som flera. Nyckeln är landets kod och värdet listan med dess delar:

```json
{ "delade": { "GB": ["GB-eng", "GB-sct", "GB-wls", "GB-nir"] } }
```

- Valet landlista.delade.val (Anpassning och knappen på kartan, sparas i profiles.settings, förvalt på) gäller med vilken lista som helst. Med valet på räknas delarna i stället för landet i varje lista där landet ingår (för GB: FN 196, FN och observatörer 198, med Taiwan och Kosovo 200, alla 240), och kartan ritar delarna som egna länder. Landet och en del räknas aldrig samtidigt. Med valet av är allt som utan fältet, och delarnas statusrader ligger kvar utan att visas.
- Delens id är landets kod, ett bindestreck och små bokstäver eller siffror ("GB-eng"). Namnet står i textfilerna under land.<id> på båda språken.
- Gränserna ligger i public/geo/delade.json och mittpunkt och utsnitt i src/lib/deladeGeo.ts. Båda byggs av `node scripts/make-delade.mjs` ur Natural Earth admin 0 map units 1:50m (public domain), som kopplar delen till ytan via GU_A3 (delens kod efter bindestrecket i versaler: GB-eng -> ENG). Kör skriptet när fältet ändras.
- Flaggor: `npm run flags` kopierar delens egen flagga från flag-icons (gb-eng). Delar i src/lib/flagParts.ts (Nordirland) visas med landets flagga.
- `npm run import` skriver delarna som platser av typen country med landet som parent_id, data.light = true och namnet ur land.<id> i _texter.json, som länderna utan landsfil. Finns landet inte bland platserna läggs det till på samma sätt. Världsdelen är landets (appen räknar den från landet).
- Fler länder delas genom att bara lägga till dem i fältet, skriva namnen i textfilerna och köra skriptet.

`npm run import:check` stoppar också: delade som inte är ett objekt, länder som inte finns bland appens länder, tomma listor, delar vars id inte börjar med landets kod och bindestreck, delar som finns två gånger, delar utan namn under land.<id> i _texter.json eller _texter.en.json och delar utan yta i src/lib/deladeGeo.ts.

## Upptäck
Ligger i content/_upptack.json och läses in till places av `npm run import` (scripts/lib/upptack.mjs). Formatet står i filens _om.
- Toppnivå: tags och climates (tillåtna värden), pli_year och pli_restaurants_hotels (Eurostats prisnivåindex för restauranger och hotell per land, EU-27 = 100), pli_world_year och pli_world (Världsbankens prisnivåindex ICP per land, världen = 100), existing, places och alternatives. pli_world och pli_world_year krävs när någon plats har basis icp.
- places: lätta platser. Blir städer (kind city) under sitt land, med fälten level, level_rule, level_note, climate, best_months, tags, gem, why och citybreak_gbp i data, och data.light = true. De får också data.pli och data.pli_year (landets värde i indexet och året) för källraden, och data.own_judgment med de fält ur _om.own_judgment som platsen har.
- basis (frivilligt, värdet icp): prisnivån bygger på Världsbankens index. Platsens land ska då finnas i pli_world, data.pli och data.pli_year kommer från pli_world och pli_world_year, data.basis = icp och källraden är upptack.index.varlden. Saknas basis gäller Eurostat: landet ska finnas i pli_restaurants_hotels och källraden är upptack.index. {plats} är landets namn, {antal} landets värde och {ar} indexets år. level_note visas som förut.
- level_rule är regelns värde ur landets index (_om.niva och _om.niva_varlden). Eurostat: under 65 = 1, 65–89 = 2, 90–114 = 3, 115–149 = 4, 150 och över = 5. Världsbanken (basis icp): under 68 = 1, 68–111 = 2, 112–134 = 3, 135–169 = 4, 170 och över = 5. Världsbankens index har decimaler och räknas mot nästa nivås undre gräns (111,6 ger 2).
- best_months skrivs i den ordning de står i filen. Månader över årsskiftet (11, 12, 1, 2) visas som nov, dec, jan, feb, och månadsfiltret matchar var och en av dem.
- Länder utan landsfil som har lätta platser läggs till som länder med data.light = true (places.parent_id kräver landet). Namnet tas från Intl.DisplayNames på svenska, och appen visar webbläsarens namn på valt språk.
- existing: befintliga städer i landsfilerna får climate, tags och why i data. why är frivilligt och följer samma regel som för places: en mening. Den visas på stadens kort i Upptäck. Prisnivån kommer från data.prices.level och bästa månader är månaderna där smart_months är 4 eller 5.
- alternatives: läggs i data.alternatives ({ place, why, cheaper }) på platsen i for.

`npm run import:check` stoppar: okända delar och fält, id som inte är landskod, bindestreck och små bokstäver eller som krockar med en landsfil, länder som inte finns i src/lib/countries.ts, level och level_rule utanför 1–5, basis med annat värde än icp, en plats vars land saknas i pli_world (basis icp) eller pli_restaurants_hotels (utan basis), level_rule som inte följer regeln för indexet, länder i pli_world som inte finns i src/lib/countries.ts, level_note som saknas när level avviker från level_rule (eller finns när de är lika), climate och tags som inte finns i listorna, why som är tom eller inte är text (i places och existing), månader utanför 1–12, existing som inte är en stad i landsfilerna, for och place som inte finns bland places eller existing, alternativ med högre prisnivå än platsen de hör till, och cheaper som inte stämmer med nivåerna.

En lätt plats har ingen kompendium, inga saker och inga priser. Den räknas inte bland städer med innehåll (hemort i Idag) och visas som stadsprick på kartan först när den har en status.

## Engelska texter (content/en/)
Svenskan i content/ är originalet. content/en/ innehåller bara översatta texter, aldrig siffror, id:n, datum, koordinater eller källor. Allt som inte är text kommer alltid från den svenska filen.

`npm run import` skriver de engelska texterna till kolumnen en i places, place_facts, place_items, compendium_items, bucket_catalog, ideas och gift_tips (docs/schema.sql). Kolumnen har samma fältnamn som den svenska raden. Saknas engelska för en rad blir en null, så att en borttagen översättning också försvinner i databasen. Importen går att köra om utan att något dubbleras (upsert på id).

I appen väljer src/lib/innehallSprak.ts texten för en rad och ett fält efter valt språk. Saknas en engelsk text (en fil, en rad, ett fält eller en post i en lista) visas den svenska, fält för fält. Landsnamn kommer som förut från webbläsaren på valt språk och från land.<id> i textfilerna. Sökfältet för plats hittar platser på båda språken oavsett valt språk.

Gemensamt för alla filer:
- En text får inte vara tom. Utelämna fältet i stället.
- Ett fält som saknas på svenska får inte finnas på engelska.
- Platshållare ({namn}) får bara finnas om de finns i den svenska texten.
- Listor har samma längd och ordning som i den svenska filen. En post utan text är ett tomt objekt ({}), och i en lista med bara texter (month_notes, prices.tips, checklist_items) är en saknad text null.
- Saknade översättningar är inte fel. `npm run import:check` skriver ut en sammanställning per fil: antal översatta texter av totalt antal svenska texter.

### en/_upptack.json
```json
{
  "places": { "PT-lissabon": { "why": "...", "name": "Lisbon" }, "ES-barcelona": { "why": "...", "level_note": "..." } },
  "existing": { "MC-monaco": { "why": "..." } },
  "alternatives": { "MC-monaco>FR-nice": "..." }
}
```
- places: id ur places i _upptack.json. why, name (bara när namnet skiljer sig från det svenska) och level_note (bara när den svenska platsen har en).
- existing: id ur existing i _upptack.json, med why (bara när den svenska har why).
- alternatives: nyckeln är for, tecknet > och place ur alternativet i den svenska filen. Värdet är alternativets why.
- I kolumnen en hamnar why och level_note under data, och alternativen som data.alternatives: en lista i samma ordning som den svenska, med { "why" } eller {}. name räknas inte i sammanställningen.

### en/_bucket.json
```json
{ "bucket-norrsken": { "name": "...", "season": "...", "where_text": "..." }, "bucket-x": { "name": "...", "checklist_items": ["...", "..."] } }
```
checklist_items finns bara för delmål av typen delar och har samma antal och ordning som items i den svenska filen. I kolumnen en blir den checklist.items. Avbockade delmål sparas med den svenska titeln (bucket_items.parts), så en bock gäller på båda språken. Punkter ur katalogen visas med katalogens namn på valt språk.

### en/_packlista.json
```json
{ "groups": { "Dokument": "Documents" }, "items": { "pass": { "title": "..." } } }
```
groups: svenskt gruppnamn ur _packlista.json till engelskt. items: id till { title }. Läses in i appen vid bygget. Hämta förslag lägger till sakerna på det språk som är valt just då, och befintliga rader ändras inte. Gruppnamnen sparas på svenska och översätts när raden visas, om gruppen är en av grupperna i mallen. En sak som redan står på listan på något av språken föreslås inte igen.

### en/_innan-avresa.json
```json
{ "items": { "forsakring": { "title": "...", "hint": "..." } } }
```
id till { title, hint }. Läses in i appen vid bygget. Punkterna läggs till på det språk som är valt just då. days_before slås upp via titeln på båda språken, och en punkt som redan finns på något av språken läggs inte till igen.

### en/<landskod>.json
Samma toppnycklar som landsfilen, men som objekt med id som nyckel. Filen kräver content/<landskod>.json, och id:t ska finnas i samma del där.

```json
{
  "places": { "PT-lissabon": { "name": "Lisbon", "data": { "best_text": "...", "month_notes": [null, null, "...", null, null, null, null, null, null, null, null, null] } } },
  "facts": { "PT-fakta-mobil": { "title": "...", "summary": "...", "body": "..." } },
  "items": { "PT-lissabon-belem": { "name": "...", "summary": "...", "body": "..." } },
  "compendium": { "mat-pastel-de-nata": { "name": "...", "hint": "..." } },
  "ideas": { "PT-x": { "title": "...", "body": "...", "duration": "..." } },
  "gifts": { "PT-present-x": { "name": "...", "body": "..." } }
}
```

data under places speglar den svenska data men har bara textfälten:

| Fält | Form |
|---|---|
| best_text, day_budget_note | text |
| flight_tips | lista med { title, text } |
| stay | lista med { label, text } (samma fältnamn som på svenska) |
| areas | lista med { name, text } |
| transport | lista med { mode, text } |
| month_notes | 12 texter (null för en saknad) |
| events, seasons | lista med { name, text } |
| prices | { summary, tips: [texter], rows: [{ note }] } |

Samma kort i samlingsboken kan stå i flera landsfiler. Står det i flera engelska filer måste texterna vara lika.

`npm run import:check` stoppar: okända filer i content/en/, okända delar och fält, id:n som inte finns i den svenska filen, listor med fel längd, tomma texter, platshållare som inte finns i den svenska texten, fält som finns på engelska men saknas på svenska, checklist_items på delmål som inte är av typen delar, och ett kort i samlingsboken med olika engelska texter i två filer.

## Gränssnittets texter
Ligger i content/_texter.json och läses in i appen vid bygget (inte till databasen). Nycklar under texter, tre språkstilar (neutral, lekfull, romantisk), märken under marken. Reglerna står i filens _om.

## Importen ska
1. Validera mot tabellerna ovan och stoppa hela filen vid fel, med filnamn, id och fält i felmeddelandet.
2. Vägra regler (is_rule) utan source_url och verified_on.
3. Skriva i ordningen places, compendium, facts, items, ideas, gifts.
4. Köras lokalt av Hugo med SUPABASE_SECRET_KEY från .env.local. Nyckeln får aldrig användas i appen.
5. Aldrig skriva place_items bildfält (image_url, image_credit, image_license, image_page). De skrivs bara av `npm run import:images`.
6. Skriva kolumnen en för de sju tabellerna ur content/en/, eller null när raden saknar engelska.
