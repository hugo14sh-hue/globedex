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

## Gränssnittets texter
Ligger i content/_texter.json och läses in i appen vid bygget (inte till databasen). Nycklar under texter, tre språkstilar (neutral, lekfull, romantisk), märken under marken. Reglerna står i filens _om.

## Importen ska
1. Validera mot tabellerna ovan och stoppa hela filen vid fel, med filnamn, id och fält i felmeddelandet.
2. Vägra regler (is_rule) utan source_url och verified_on.
3. Skriva i ordningen places, compendium, facts, items, ideas, gifts.
4. Köras lokalt av Hugo med SUPABASE_SECRET_KEY från .env.local. Nyckeln får aldrig användas i appen.
